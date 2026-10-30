// Supabase Auth → MSG91 Send-SMS Hook receiver.
//
// Supabase Auth POSTs `{ user, sms: { otp, phone } }` to this function whenever
// it needs to deliver a phone OTP. We verify the webhook signature, defense-in-
// depth rate-limit by phone, then forward to MSG91. Returns 200 on success;
// non-200 surfaces back to the user as a generic auth error.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { hashWithPepper } from '../_shared/hash.ts';
import { createLogger } from '../_shared/log.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { isFreshWebhookTimestamp } from '../_shared/webhookTimestamp.ts';
import { verifyWebhookSignature } from './webhook.ts';
import { sendOtpViaMsg91 } from './msg91.ts';

const log = createLogger('send-sms-otp');

interface AuthSmsHookPayload {
  user: { id?: string; phone?: string; [key: string]: unknown };
  sms: { otp: string; phone: string };
}

function isHookPayload(value: unknown): value is AuthSmsHookPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!v.user || typeof v.user !== 'object') return false;
  if (!v.sms || typeof v.sms !== 'object') return false;
  const sms = v.sms as Record<string, unknown>;
  return typeof sms.otp === 'string' && typeof sms.phone === 'string';
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', request_id: requestId }, 405);
  }

  const secret = Deno.env.get('SUPABASE_SMS_HOOK_SECRET') ?? '';
  const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY') ?? '';
  const msg91TemplateId = Deno.env.get('MSG91_TEMPLATE_ID') ?? '';
  const msg91SenderId = Deno.env.get('MSG91_SENDER_ID') ?? '';
  // Keys the phone rate-limit bucket. Without it the stored hash of a 10-digit
  // number is reversible by enumeration, so refuse rather than downgrade.
  const pepper = Deno.env.get('AUDIT_PEPPER');
  if (!secret || !msg91AuthKey || !msg91TemplateId || !msg91SenderId || !pepper) {
    log.error('misconfigured', {
      request_id: requestId,
      missing_secret: !secret,
      missing_auth_key: !msg91AuthKey,
      missing_template: !msg91TemplateId,
      missing_sender: !msg91SenderId,
      missing_pepper: !pepper,
    });
    return json({ error: 'server_misconfigured', request_id: requestId }, 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('webhook-signature') ?? '';
  const webhookId = req.headers.get('webhook-id') ?? '';
  const webhookTimestamp = req.headers.get('webhook-timestamp') ?? '';

  // A captured, validly signed request must not be replayable later.
  if (!isFreshWebhookTimestamp(webhookTimestamp, Date.now())) {
    log.warn('stale_webhook_timestamp', { request_id: requestId });
    return json({ error: 'unauthorized', request_id: requestId }, 401);
  }

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signatureOk = await verifyWebhookSignature({
    secret,
    payload: signedPayload,
    signature,
  });
  if (!signatureOk) {
    log.warn('signature_mismatch', { request_id: requestId });
    return json({ error: 'unauthorized', request_id: requestId }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_json', request_id: requestId }, 400);
  }
  if (!isHookPayload(payload)) {
    log.warn('invalid_payload_shape', { request_id: requestId });
    return json({ error: 'invalid_payload', request_id: requestId }, 400);
  }

  const phone = payload.sms.phone;

  // The counters table must not hold raw phone numbers.
  const { ok } = await checkRateLimit({
    kind: 'send-sms-otp',
    key: `phone:${await hashWithPepper(phone, pepper)}`,
    max: 3,
    windowSec: 600,
  });
  if (!ok) {
    log.warn('rate_limit_exceeded', { request_id: requestId });
    return json({ error: 'rate_limited', request_id: requestId }, 429);
  }

  try {
    await sendOtpViaMsg91({
      phone,
      otp: payload.sms.otp,
      authKey: msg91AuthKey,
      templateId: msg91TemplateId,
      senderId: msg91SenderId,
    });
    log.info('sms_dispatched', { request_id: requestId });
    return json({}, 200);
  } catch (err) {
    log.error('sms_dispatch_failed', {
      request_id: requestId,
      error: err instanceof Error ? String(err.message).slice(0, 200) : 'unknown',
    });
    return json({ error: 'sms_dispatch_failed', request_id: requestId }, 500);
  }
});
