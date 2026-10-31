// Money for native screens, in the signed-in ledger's currency. Web screens get
// the profile as a prop and call formatMoney directly; native screens read the
// session store, so this is the one place they resolve currency and locale.

import { formatMoney } from '@/lib/format';
import { currencyFor, localeForCountry, type CurrencyCode } from '@/lib/regions';
import { useSession } from '@/store/session';

/** The ledger currency: the profile country's, INR when there is none. */
export function ledgerCurrency(): CurrencyCode {
  return currencyFor(useSession.getState().profile?.country);
}

/** Formats an amount in the ledger currency and locale (`—` when missing). */
export function ledgerMoney(value: number | null | undefined, opts?: { compact?: boolean }): string {
  const country = useSession.getState().profile?.country;
  return formatMoney(value, currencyFor(country), { ...opts, locale: localeForCountry(country) });
}
