export type CurrencyCode = 'INR' | 'EUR';
export type MarketCode = 'IN' | 'EU';

export interface Region {
  country: string;
  name: string;
  currency: CurrencyCode;
  market: MarketCode;
  locale: string;
  timezone: string;
  /** Major units per stick. Null until a cited source exists. */
  stickHint: number | null;
}

/** India plus the 27 EU member states. EU stick hints stay empty until WAP is cited. */
export const REGIONS: readonly Region[] = [
  { country: 'IN', name: 'India', currency: 'INR', market: 'IN', locale: 'en-IN', timezone: 'Asia/Kolkata', stickHint: 18 },
  { country: 'AT', name: 'Austria', currency: 'EUR', market: 'EU', locale: 'de-AT', timezone: 'Europe/Vienna', stickHint: null },
  { country: 'BE', name: 'Belgium', currency: 'EUR', market: 'EU', locale: 'nl-BE', timezone: 'Europe/Brussels', stickHint: null },
  { country: 'BG', name: 'Bulgaria', currency: 'EUR', market: 'EU', locale: 'bg-BG', timezone: 'Europe/Sofia', stickHint: null },
  { country: 'HR', name: 'Croatia', currency: 'EUR', market: 'EU', locale: 'hr-HR', timezone: 'Europe/Zagreb', stickHint: null },
  { country: 'CY', name: 'Cyprus', currency: 'EUR', market: 'EU', locale: 'el-CY', timezone: 'Asia/Nicosia', stickHint: null },
  { country: 'CZ', name: 'Czechia', currency: 'EUR', market: 'EU', locale: 'cs-CZ', timezone: 'Europe/Prague', stickHint: null },
  { country: 'DK', name: 'Denmark', currency: 'EUR', market: 'EU', locale: 'da-DK', timezone: 'Europe/Copenhagen', stickHint: null },
  { country: 'EE', name: 'Estonia', currency: 'EUR', market: 'EU', locale: 'et-EE', timezone: 'Europe/Tallinn', stickHint: null },
  { country: 'FI', name: 'Finland', currency: 'EUR', market: 'EU', locale: 'fi-FI', timezone: 'Europe/Helsinki', stickHint: null },
  { country: 'FR', name: 'France', currency: 'EUR', market: 'EU', locale: 'fr-FR', timezone: 'Europe/Paris', stickHint: null },
  { country: 'DE', name: 'Germany', currency: 'EUR', market: 'EU', locale: 'de-DE', timezone: 'Europe/Berlin', stickHint: null },
  { country: 'GR', name: 'Greece', currency: 'EUR', market: 'EU', locale: 'el-GR', timezone: 'Europe/Athens', stickHint: null },
  { country: 'HU', name: 'Hungary', currency: 'EUR', market: 'EU', locale: 'hu-HU', timezone: 'Europe/Budapest', stickHint: null },
  { country: 'IE', name: 'Ireland', currency: 'EUR', market: 'EU', locale: 'en-IE', timezone: 'Europe/Dublin', stickHint: null },
  { country: 'IT', name: 'Italy', currency: 'EUR', market: 'EU', locale: 'it-IT', timezone: 'Europe/Rome', stickHint: null },
  { country: 'LV', name: 'Latvia', currency: 'EUR', market: 'EU', locale: 'lv-LV', timezone: 'Europe/Riga', stickHint: null },
  { country: 'LT', name: 'Lithuania', currency: 'EUR', market: 'EU', locale: 'lt-LT', timezone: 'Europe/Vilnius', stickHint: null },
  { country: 'LU', name: 'Luxembourg', currency: 'EUR', market: 'EU', locale: 'fr-LU', timezone: 'Europe/Luxembourg', stickHint: null },
  { country: 'MT', name: 'Malta', currency: 'EUR', market: 'EU', locale: 'en-MT', timezone: 'Europe/Malta', stickHint: null },
  { country: 'NL', name: 'Netherlands', currency: 'EUR', market: 'EU', locale: 'nl-NL', timezone: 'Europe/Amsterdam', stickHint: null },
  { country: 'PL', name: 'Poland', currency: 'EUR', market: 'EU', locale: 'pl-PL', timezone: 'Europe/Warsaw', stickHint: null },
  { country: 'PT', name: 'Portugal', currency: 'EUR', market: 'EU', locale: 'pt-PT', timezone: 'Europe/Lisbon', stickHint: null },
  { country: 'RO', name: 'Romania', currency: 'EUR', market: 'EU', locale: 'ro-RO', timezone: 'Europe/Bucharest', stickHint: null },
  { country: 'SK', name: 'Slovakia', currency: 'EUR', market: 'EU', locale: 'sk-SK', timezone: 'Europe/Bratislava', stickHint: null },
  { country: 'SI', name: 'Slovenia', currency: 'EUR', market: 'EU', locale: 'sl-SI', timezone: 'Europe/Ljubljana', stickHint: null },
  { country: 'ES', name: 'Spain', currency: 'EUR', market: 'EU', locale: 'es-ES', timezone: 'Europe/Madrid', stickHint: null },
  { country: 'SE', name: 'Sweden', currency: 'EUR', market: 'EU', locale: 'sv-SE', timezone: 'Europe/Stockholm', stickHint: null },
];

const INDIA = REGIONS[0]!;

/** Null or blank country is the existing India ledger. An unknown code is not a region. */
export function regionFor(country: string | null | undefined): Region | null {
  if (country == null || country === '') return INDIA;
  return REGIONS.find((r) => r.country === country) ?? null;
}

export function currencyFor(country: string | null | undefined): CurrencyCode {
  return regionFor(country)?.currency ?? 'INR';
}

export function timezoneForCountry(country: string | null | undefined): string {
  return regionFor(country)?.timezone ?? INDIA.timezone;
}

export function localeForCountry(country: string | null | undefined): string {
  return regionFor(country)?.locale ?? INDIA.locale;
}

export function regionOptions(): { value: string; label: string }[] {
  const rest = REGIONS.filter((r) => r.country !== 'IN').sort((a, b) => a.name.localeCompare(b.name));
  return [INDIA, ...rest].map((r) => ({ value: r.country, label: r.name }));
}

/** Off unless the deploy explicitly sets the flag. Redeploy is the kill switch. */
export function isRegionPickerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REGION_PICKER === 'true';
}
