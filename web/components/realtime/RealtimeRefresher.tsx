'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@web/lib/supabase/client';

// RealtimeRefresher subscribes once-per-session to the tables whose changes need
// to surface across tabs/devices:
//   - cigarette_logs (any INSERT/UPDATE/DELETE for the current user)
//   - goals          (any INSERT/UPDATE/DELETE for the current user)
//   - user_profiles  (any UPDATE for the current user's profile row)
//   - brands         (favorites / new brands for the current user)
//   - brand_variants (price edits for the current user)
//
// Foreground reconcile: a backgrounded tab can miss events (or have its socket
// dropped/throttled). On visibilitychange→visible or window focus we re-open the
// channel ONLY if it actually dropped, then schedule a refresh to catch anything
// missed while hidden. This is the web analogue of the mobile AppState reconcile.
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
    let currentUid: string | null = null;

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
      currentUid = userId;
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
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'brands', filter: `user_id=eq.${userId}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'brand_variants', filter: `user_id=eq.${userId}` },
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
        currentUid = uid;
        void attach(uid);
      } else {
        currentUid = null;
        void detach();
      }
    });

    // Foreground reconcile: when the tab becomes visible/focused, re-open the
    // channel only if it actually dropped while hidden, then refresh to catch
    // anything missed. Cheap when the socket survived (no teardown).
    const reconcile = () => {
      if (cancelled || !currentUid) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!channel || channel.state !== 'joined') {
        void attach(currentUid);
      }
      scheduleRefresh();
    };
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('focus', reconcile);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('focus', reconcile);
      void detach();
    };
  }, [router]);

  return null;
}

export default RealtimeRefresher;
