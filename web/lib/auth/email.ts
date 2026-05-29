import * as React from 'react';
import { z } from 'zod';
import disposableDomainsRaw from 'disposable-email-domains';

const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set(
  disposableDomainsRaw.map((d) => d.toLowerCase()),
);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export const emailZodStrict = z
  .string()
  .trim()
  .min(5, 'Enter a valid email')
  .max(254, 'Email is too long')
  .email('Enter a valid email')
  .refine((value) => !isDisposableEmail(value), {
    message: 'Disposable email addresses are not allowed',
  });

export type EmailValidity =
  | { state: 'idle' }
  | { state: 'invalid'; message: string }
  | { state: 'valid' };

export function useDebouncedEmailValidity(
  value: string | undefined,
  delayMs = 400,
): EmailValidity {
  const [validity, setValidity] = React.useState<EmailValidity>({ state: 'idle' });

  React.useEffect(() => {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length === 0) {
      setValidity({ state: 'idle' });
      return;
    }
    const handle = window.setTimeout(() => {
      const result = emailZodStrict.safeParse(trimmed);
      if (result.success) {
        setValidity({ state: 'valid' });
      } else {
        setValidity({
          state: 'invalid',
          message: result.error.issues[0]?.message ?? 'Enter a valid email',
        });
      }
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return validity;
}
