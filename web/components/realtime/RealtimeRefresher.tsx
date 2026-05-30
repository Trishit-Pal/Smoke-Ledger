'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@web/lib/supabase/client';

// RealtimeRefresher subscribes once-per-session to the three tables whose
// changes need to surface across tabs/devices:
//   - cigarette_logs (any INSERT/UPDATE/DELETE for the current user)
//   - goals          (any INSERT/UPDATE/DELETE for the current user)
//   - user_profiles  (any UPDATE for the current user's profile row)
//
// On any change it debounces by ~400ms (trailing) and calls router.refresh(),
// which re-runs the current route's server components. revalidatePath in the
// mutation server actions has already invalidated the router cache, so the
// refresh re-fetches.
//
// Mount this once at the (app) layout level — NOT per page. Mounting per
// page tears down + re-opens the WebSocket on every navigation, which is
// wasteful and defeats the purpose.
//
// Channel teardown: the cleanup function calls supabase.removeChannel before
// unmount AND when the auth state changes (sign-out, user switch). The next
// auth state change re-attaches the channel for the new user.

const DEBOUNCE_MS = 400;

export function RealtimeRefresher() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let refreshTimer: number | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, DEBOUNCE_MS);
    };

    const detach = async () => {
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      if (channel) {
        const c = channel;
        channel = null;
        try {
          await supabase.removeChannel(c);
        } catch {
          // Tear-down errors are non-fatal — Supabase cleans up on next reconnect.
        }
      }
    };

    const attach = async (userId: string) => {
      await detach();
      if (cancelled) return;
      const next = supabase
        .channel(`user-${userId}-realtime`)
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'cigarette_logs',
            filter: `user_id=eq.${userId}`,
          },
          scheduleRefresh,
        )
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'goals',
            filter: `user_id=eq.${userId}`,
          },
          scheduleRefresh,
        )
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${userId}`,
          },
          scheduleRefresh,
        )
        .subscribe();
      channel = next;
    };

    // Attach immediately if the user is already signed in (the common case
    // for any (app) route — the auth gate above us already enforced it).
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id;
      if (uid) void attach(uid);
    });

    // Re-attach on auth state transitions so a sign-in after first render
    // (e.g. via re-auth flow) doesn't leave the page subscription-less.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) {
        void attach(uid);
      } else {
        void detach();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      void detach();
    };
  }, [router]);

  return null;
}

export default RealtimeRefresher;
