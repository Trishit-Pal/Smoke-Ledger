'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@web/lib/supabase/client';

// RealtimeRefresher subscribes once-per-session to the tables whose changes need
// to surface across tabs/devices:
//   - cigarette_logs / goals / brands / brand_variants (filtered by user_id)
//   - user_profiles (filtered by id)
// On any change it debounces ~400ms (trailing) and calls router.refresh(), which
// re-runs the current route's server components (revalidatePath in the mutation
// server actions has already invalidated the router cache, so the refresh refetches).
//
// Foreground reconcile: a backgrounded tab can have its socket suspended/dropped
// and miss events. ONLY on a real hidden→visible transition (a true backgrounding)
// do we re-open the channel and schedule a single refresh — never on ordinary
// in-page focus changes, which would spam router.refresh() on every tab click.
//
// Keep this in PARITY with the React Native port at
// src/components/realtime/RealtimeRefresher.tsx — same channel name, same table
// subscriptions, same opChain serialization (the foreground trigger differs:
// AppState on mobile, visibilitychange here). Mount this ONCE at the (app)
// layout — NOT per page, or every navigation tears down + re-opens the socket.

const DEBOUNCE_MS = 400;

export function RealtimeRefresher() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let refreshTimer: number | null = null;
    let cancelled = false;
    let currentUid: string | null = null;

    // Serialize attach/detach so the initial getUser() attach, the
    // onAuthStateChange attach, and the foreground reconcile can't interleave
    // into a double-subscribe / orphaned channel. Mirrors the mobile port.
    let opChain: Promise<unknown> = Promise.resolve();
    const enqueue = (fn: () => Promise<void>) => {
      opChain = opChain.catch(() => undefined).then(fn);
      return opChain;
    };

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
      channel = supabase
        .channel(`user-${userId}-realtime`)
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'cigarette_logs', filter: `user_id=eq.${userId}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` },
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
    };

    // Attach immediately if the user is already signed in (the common case for
    // any (app) route — the auth gate above us already enforced it).
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id;
      if (uid) void enqueue(() => attach(uid));
    });

    // Re-attach on sign-in / re-auth; detach + clear uid on sign-out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) {
        void enqueue(() => attach(uid));
      } else {
        currentUid = null;
        void enqueue(() => detach());
      }
    });

    // Foreground reconcile — only on a real hidden→visible transition, so we
    // don't refresh on ordinary in-page focus churn. Re-open the (possibly
    // suspended) socket unconditionally — a backgrounded WebSocket can still
    // report `joined` while dead, so don't trust its state — then schedule one
    // refresh to catch anything missed while hidden.
    let wasHidden = document.visibilityState === 'hidden';
    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return; // became visible without a real backgrounding
      wasHidden = false;
      if (currentUid) {
        const uid = currentUid;
        void enqueue(() => attach(uid));
        scheduleRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      void enqueue(() => detach());
    };
  }, [router]);

  return null;
}

export default RealtimeRefresher;
