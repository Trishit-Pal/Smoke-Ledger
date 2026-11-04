import type { SupabaseClient } from '@supabase/supabase-js';
import type { AllowedEmailOtpType } from '@/lib/emailOtpType';
import { POST_AUTH_PROFILE_COLUMNS, postAuthDestination } from '@web/lib/auth/postAuthDestination';

/**
 * Where a just-signed-in reader goes: the consent/onboarding gate's own answer,
 * decided here so the redirect lands on the final URL. A server-action redirect
 * to a gated page makes Next follow the middleware's 307 silently and render
 * /consent under the old URL. Shared by every sign-in path.
 *
 * `next` is the sanitized requested path, or null when none was given. A failed
 * profile read is not "not onboarded": go to next (or the dashboard) and let the
 * middleware decide, never into onboarding.
 */
export async function resolvePostSignInPath(
  supabase: SupabaseClient,
  userId: string,
  next: string | null,
  type: AllowedEmailOtpType | null = null,
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select(POST_AUTH_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) return next ?? '/dashboard';
  return postAuthDestination(profile, type, next);
}
