'use client';
import { useEffect } from 'react';
import { getSupabase } from '@web/lib/supabase/client';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { maybeSyncDefaultBrandCatalog } from '@/lib/catalogSync';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';
import { clearWebDevice } from '@web/lib/privacy/clearDevice';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setInitialized } = useAuth();
  const { reset } = useSession();

  useEffect(() => {
    const sb = getSupabase();
    // The web app renders every page from server components (per-request,
    // per-user server-side fetch), so we deliberately do NOT run the
    // React-Native `useSession.boot()` here. boot() re-fetched
    // logs/brands/goals/profile through the client repos — duplicating the
    // server fetch and making several concurrent getUser() calls contend for
    // the gotrue navigator lock (the "Lock 'sb-…-auth-token' was not released
    // within 5000ms" warnings, doubled under React Strict Mode). We keep only
    // the once-per-session default-catalog sync as fire-and-forget, and still
    // clear the in-memory session store on sign-out for clean account switches.
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
      if (session) void maybeSyncDefaultBrandCatalog().catch(() => {});
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        void maybeSyncDefaultBrandCatalog().catch(() => {});
      } else {
        // Clean account-switch isolation: drop in-memory session data, the
        // (user-keyed) analytics-consent cache, and the on-device stores the
        // lifecycle registry lists for sign-out (chat transcript, first-suggestion
        // stamp) on every null session, so nothing carries to the next user on a
        // shared computer, e.g. a browser closed without Remember me.
        reset();
        invalidateAnalyticsConsentCache();
        // Only an explicit SIGNED_OUT also expires the auth cookies: INITIAL_SESSION arrives
        // with a null session on a cold or offline start too, and wiping the cookies then
        // would sign the reader out for good.
        if (event === 'SIGNED_OUT') void clearWebDevice('signOut');
        else void clearWebDevice('signOut', undefined, ['web.authCookie']);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
