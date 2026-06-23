import { formatInr, formatPerStick } from '@/lib/format';

/**
 * Live price hint for the new-log form. The typed value IS the per-stick price,
 * so the preview shows the resulting total alongside the per-stick rate to remove
 * any ambiguity before saving. Returns an error string for invalid input, or
 * `null` when nothing is typed. Pure (no React) so it can be unit-tested.
 */
export function buildPricePreview(
  priceText: string,
  quantity: string | number,
): string | null {
  if (!priceText) return null;
  const perStick = Number(priceText);
  if (!Number.isFinite(perStick) || perStick < 0) return 'Enter a valid price per stick.';
  const qty = Math.max(1, Number(quantity) || 1);
  return `= ${formatInr(perStick * qty)} total · ${formatPerStick(perStick)}`;
}
