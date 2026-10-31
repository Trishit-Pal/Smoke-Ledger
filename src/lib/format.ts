// Money formatters. INR keeps lakh/crore. EUR uses the caller's BCP-47 locale.
import type { CurrencyCode } from '@/lib/regions';

export function formatMoney(
  value: number | null | undefined,
  currency: CurrencyCode = 'INR',
  opts?: { compact?: boolean; locale?: string },
): string {
  if (currency === 'INR') return formatInr(value, opts);
  if (value == null || !Number.isFinite(value)) return '—';
  const n = Math.round(value * 100) / 100;
  const negative = n < 0;
  const abs = Math.abs(n);
  if (opts?.compact && abs >= 1000) {
    const compact = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` : `${(abs / 1000).toFixed(1)}k`;
    return `${negative ? '-' : ''}€${compact}`;
  }
  return new Intl.NumberFormat(opts?.locale ?? 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

/** Parses a typed amount; euro-locale keypads type the decimal as a comma. */
export function parseDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

export function formatInr(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const n = Math.round(value * 100) / 100;
  const negative = n < 0;
  const abs = Math.abs(n);
  if (opts?.compact && abs >= 1000) {
    const compact =
      abs >= 10_000_000
        ? `${(abs / 10_000_000).toFixed(1)}Cr`
        : abs >= 100_000
        ? `${(abs / 100_000).toFixed(1)}L`
        : `${(abs / 1000).toFixed(1)}k`;
    return `${negative ? '-' : ''}₹${compact}`;
  }
  // Indian numbering: 1,00,000
  const [intPart, frac] = abs.toFixed(2).split('.');
  let withCommas: string;
  if (intPart.length <= 3) {
    withCommas = intPart;
  } else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  const fracTrim = frac === '00' ? '' : `.${frac}`;
  return `${negative ? '-' : ''}₹${withCommas}${fracTrim}`;
}

/**
 * Per-stick price label, e.g. "₹20 / stick". Use everywhere a unit price is shown
 * so the per-stick rate is always explicit. Returns `fallback` for missing prices.
 */
export function formatPerStick(
  unitPrice: number | null | undefined,
  opts?: { fallback?: string; compact?: boolean; currency?: CurrencyCode; locale?: string },
): string {
  if (unitPrice == null || !Number.isFinite(unitPrice)) return opts?.fallback ?? '—';
  return `${formatMoney(unitPrice, opts?.currency ?? 'INR', { compact: opts?.compact, locale: opts?.locale })} / stick`;
}

export function formatCompactInt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatDelta(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
