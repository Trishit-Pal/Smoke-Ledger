import { formatMoney, formatPerStick } from '@/lib/format';
import type { CurrencyCode } from '@/lib/regions';

/**
 * Live price hint for a log entry form. The typed value is always the per-stick
 * price; this returns the resulting total alongside the per-stick rate so there
 * is no ambiguity before saving. Returns an error string for invalid input, or
 * `null` when nothing is typed. Pure (no React) so it can be unit-tested.
 */
export function buildPricePreview(
  priceText: string,
  quantity: string | number,
  currency: CurrencyCode = 'INR',
  locale?: string,
): string | null {
  if (!priceText) return null;
  const perStick = Number(priceText);
  if (!Number.isFinite(perStick) || perStick < 0) return 'Enter a valid price per stick.';
  const qty = Math.max(1, Number(quantity) || 1);
  return `= ${formatMoney(perStick * qty, currency, { locale })} total · ${formatPerStick(perStick, { currency, locale })}`;
}
