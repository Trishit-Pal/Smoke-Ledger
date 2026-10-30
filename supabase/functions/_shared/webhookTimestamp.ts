// Standard Webhooks replay window. The signature covers the timestamp, but a
// captured request stays validly signed forever unless the receiver also checks
// the timestamp is recent. Kept free of Deno globals so jest can import it.

export const WEBHOOK_TOLERANCE_SEC = 300;

/** `raw` is the `webhook-timestamp` header: whole seconds since the epoch. */
export function isFreshWebhookTimestamp(
  raw: string,
  nowMs: number,
  toleranceSec: number = WEBHOOK_TOLERANCE_SEC,
): boolean {
  if (!/^\d{1,12}$/.test(raw)) return false;
  return Math.abs(nowMs / 1000 - Number(raw)) <= toleranceSec;
}
