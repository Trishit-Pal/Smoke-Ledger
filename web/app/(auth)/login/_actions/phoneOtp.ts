'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkRateLimits, getClientIp } from '@web/lib/auth/rateLimit';
import {
  getCountryByCode,
  isPhoneOtpEnabled,
  toE164,
} from '@web/lib/auth/phone';
import { sanitizeNextPath } from '@web/lib/auth/redirect';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';
import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isSupabaseAuthCookie,
  type AuthCookieOptions,
} from '@web/lib/supabase/cookieOptions';
import type { PhoneOtpActionState } from '../phoneOtpState';

const sendSchema = z.object({
  countryCode: z.string().min(2).max(3),
  localNumber: z.string().trim().min(7).max(15),
  captchaToken: z.string().min(1).optional(),
});

const verifySchema = z.object({
  countryCode: z.string().min(2).max(3),
  localNumber: z.string().trim().min(7).max(15),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  next: z.string().optional().nullable(),
});

function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

const NEUTRAL_SENT_MESSAGE =
  'If this number is registered, an OTP was sent. Enter the 6-digit code to continue.';

export async function sendPhoneOtpAction(
  _prev: PhoneOtpActionState,
  formData: FormData,
): Promise<PhoneOtpActionState> {
  if (!isPhoneOtpEnabled()) {
    return { code: 'disabled', message: 'Phone sign-in is temporarily unavailable.' };
  }

  const parsed = sendSchema.safeParse({
    countryCode: formData.get('countryCode'),
    localNumber: formData.get('localNumber'),
    captchaToken: formData.get('captchaToken') || undefined,
  });
  if (!parsed.success) {
    return { code: 'invalid', message: 'Enter a valid phone number.' };
  }

  const country = getCountryByCode(parsed.data.countryCode);
  if (!country) {
    return { code: 'invalid', message: 'Unsupported country.' };
  }
  if (!country.regex.test(parsed.data.localNumber)) {
    return {
      code: 'invalid',
      message: `Enter a ${country.localLength}-digit ${country.code} number.`,
    };
  }

  const e164 = toE164(country, parsed.data.localNumber);
  const ip = await getClientIp();

  const okLimit = await checkRateLimits([
    { kind: 'phone_otp_send_ip', key: ip, max: 10, windowSec: 600 },
    { kind: 'phone_otp_send_phone', key: e164, max: 3, windowSec: 600 },
  ]);
  if (!okLimit) {
    return {
      code: 'rate_limited',
      message: 'Too many OTP requests. Please wait a few minutes before trying again.',
    };
  }

  const supabaseUrl = readSupabaseUrl();
  const anonKey = readSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    return { code: 'unavailable', message: 'Sign-in is temporarily unavailable.' };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // OTP send never establishes a session.
      },
    },
  });

  await supabase.auth.signInWithOtp({
    phone: e164,
    options: {
      shouldCreateUser: false,
      ...(parsed.data.captchaToken ? { captchaToken: parsed.data.captchaToken } : {}),
    },
  });

  return { code: 'sent', message: NEUTRAL_SENT_MESSAGE };
}

export async function verifyPhoneOtpAction(
  _prev: PhoneOtpActionState,
  formData: FormData,
): Promise<PhoneOtpActionState> {
  if (!isPhoneOtpEnabled()) {
    return { code: 'disabled', message: 'Phone sign-in is temporarily unavailable.' };
  }

  let nextPath: string | null = null;

  try {
    const parsed = verifySchema.safeParse({
      countryCode: formData.get('countryCode'),
      localNumber: formData.get('localNumber'),
      code: formData.get('code'),
      next: formData.get('next'),
    });
    if (!parsed.success) {
      return {
        code: 'invalid',
        message: 'Enter a valid phone number and 6-digit code.',
      };
    }

    const country = getCountryByCode(parsed.data.countryCode);
    if (!country || !country.regex.test(parsed.data.localNumber)) {
      return { code: 'invalid', message: 'Enter a valid phone number.' };
    }

    const e164 = toE164(country, parsed.data.localNumber);

    const okLimit = await checkRateLimits([
      { kind: 'phone_otp_verify_phone', key: e164, max: 5, windowSec: 600 },
    ]);
    if (!okLimit) {
      return {
        code: 'rate_limited',
        message:
          'Too many verification attempts. Please request a fresh OTP shortly.',
      };
    }

    const supabaseUrl = readSupabaseUrl();
    const anonKey = readSupabaseAnonKey();
    if (!supabaseUrl || !anonKey) {
      return { code: 'unavailable', message: 'Sign-in is temporarily unavailable.' };
    }

    nextPath = sanitizeNextPath(parsed.data.next ?? null);

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: AuthCookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) => {
              const policy = isSupabaseAuthCookie(name)
                ? applyAuthCookiePolicy(options, false)
                : hardenCookieOptions(options);
              cookieStore.set(name, value, policy);
            });
          } catch {
            // read-only cookie context — session refreshes on next request
          }
        },
      },
    });

    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: parsed.data.code,
      type: 'sms',
    });

    if (error) {
      return {
        code: 'invalid',
        message: 'The code is invalid or has expired. Try sending a fresh OTP.',
      };
    }
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return {
      code: 'error',
      message: 'Could not verify the code. Please try again.',
    };
  }

  if (nextPath) redirect(nextPath);
  return {
    code: 'error',
    message: 'Verification completed but no redirect target.',
  };
}
