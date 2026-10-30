'use server';

import { redirect } from 'next/navigation';
import { readAuthLink } from '@/lib/authLink';
import { sanitizeCallbackNextPath } from '@web/lib/auth/callbackNextPath';
import { POST_AUTH_PROFILE_COLUMNS, postAuthDestination } from '@web/lib/auth/postAuthDestination';
import { createClient } from '@web/lib/supabase/server';

const INVALID_LINK = '/login?error=invalid_or_expired_link';

/**
 * The only place a token_hash sign-in link is redeemed on the web. It runs on
 * the POST from the confirm page's button, never on opening the link, and Next
 * rejects server-action POSTs from another origin, so an attacker's page cannot
 * submit it for the victim (security scan F6).
 */
export async function confirmEmailLinkAction(formData: FormData): Promise<void> {
  const link = readAuthLink(
    new URLSearchParams({
      token_hash: String(formData.get('token_hash') ?? ''),
      type: String(formData.get('type') ?? ''),
    }),
  );
  if (link.kind !== 'confirm') redirect(INVALID_LINK);

  const nextPath = sanitizeCallbackNextPath(String(formData.get('next') ?? '') || null);
  const supabase = createClient();

  const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  if (error) redirect(INVALID_LINK);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=session_missing');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(POST_AUTH_PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  redirect(postAuthDestination(profile, link.type, nextPath));
}
