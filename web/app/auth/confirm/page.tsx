import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { maskAccount, readAuthLink } from '@/lib/authLink';
import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { SceneBackdrop } from '@web/components/marketing/SceneBackdrop';
import { sanitizeCallbackNextPath } from '@web/lib/auth/callbackNextPath';
import { PRIMARY_CTA_STYLE } from '@web/lib/auth/inputStyle';
import { createClient, isSupabaseServerConfigured } from '@web/lib/supabase/server';
import { confirmEmailLinkAction } from './actions';

// Never cache: the page reads the current session to warn about an account switch.
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/**
 * Opening a sign-in link lands here instead of signing the browser in. The
 * token is only redeemed when the person on this device presses Continue
 * (a POST to confirmEmailLinkAction). Security scan F6.
 */
export default async function ConfirmEmailLinkPage({ searchParams }: { searchParams: SearchParams }) {
  const link = readAuthLink(
    new URLSearchParams({ token_hash: first(searchParams.token_hash), type: first(searchParams.type) }),
  );
  if (link.kind !== 'confirm' || !isSupabaseServerConfigured()) {
    redirect('/login?error=invalid_or_expired_link');
  }
  const nextPath = sanitizeCallbackNextPath(first(searchParams.next) || null);

  const {
    data: { user },
  } = await createClient().auth.getUser();
  // Any existing session counts (phone-only included), so the warning cannot be skipped.
  const signedInAs = maskAccount(user);

  return (
    <EditorialPageShell maxWidth={520} backdrop={<SceneBackdrop intensity="full" />}>
      <EditorialMasthead
        caption="Account · Sign-in link"
        title={
          <>
            Continue to <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>your</span> ledger.
          </>
        }
        subtitle="This link signs you in on this device. Continue only if you asked for it."
      />

      {signedInAs ? (
        <p role="status" className="mt-md" style={{ fontSize: 13, color: 'var(--warn-earth)' }}>
          You&apos;re signed in as {signedInAs}. If this link is for a different account, continuing switches to it.
        </p>
      ) : null}

      <form action={confirmEmailLinkAction} className="flex flex-col">
        <input type="hidden" name="token_hash" value={link.tokenHash} />
        <input type="hidden" name="type" value={link.type} />
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <button type="submit" className="focus-ring mt-lg" style={PRIMARY_CTA_STYLE}>
          Continue →
        </button>
      </form>

      <Link
        href={signedInAs ? '/dashboard' : '/login'}
        className="mt-md"
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
        }}
      >
        Not now
      </Link>

      <EditorialClosingSignet align="left">Quietly entered.</EditorialClosingSignet>
    </EditorialPageShell>
  );
}
