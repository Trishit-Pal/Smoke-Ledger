import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/store/session';

// RealtimeRefresher (mobile) — the React Native port of the web component.
// Subscribes once-per-session to the three tables whose changes must surface
// across devices/screens without a manual refresh, and maps each table to the
// matching session-store refresh action (debounced):
//   - cigarette_logs (user_id) → refreshLogs
//   - goals          (user_id) → refreshGoals
//   - user_profiles  (id)      → refreshProfile
//   - brands         (user_id) → refreshBrands
//   - brand_variants (user_id) → refreshBrands (favorites / new brands / price edits)
//
// Mobile WebSockets drop when the app is backgrounded, so on return to the
// foreground we re-attach the channel AND run a full refresh to reconcile any
// changes missed while away. Re-attaches on auth transitions; tears down on
// unmount. Mount ONCE at the app root (app/_layout.tsx).

const DEBOUNCE_MS = 400;
type Slice = 'logs' | 'goals' | 'profile' | 'brands';

export function RealtimeRefresher() {
  React.useEffect(() => {
    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let currentUserId: string | null = null;
    const timers: Record<Slice, ReturnType<typeof setTimeout> | null> = {
      logs: null,
      goals: null,
      profile: null,
      brands: null,
    };

    const refreshFor: Record<Slice, () => Promise<void>> = {
      logs: () => useSession.getState().refreshLogs(),
      goals: () => useSession.getState().refreshGoals(),
      profile: () => useSession.getState().refreshProfile(),
      brands: () => useSession.getState().refreshBrands(),
    };

    const schedule = (slice: Slice) => {
      if (timers[slice]) clearTimeout(timers[slice] as ReturnType<typeof setTimeout>);
      timers[slice] = setTimeout(() => {
        timers[slice] = null;
        void refreshFor[slice]().catch(() => undefined);
      }, DEBOUNCE_MS);
    };

    const clearTimers = () => {
      (Object.keys(timers) as Slice[]).forEach((slice) => {
        if (timers[slice]) {
          clearTimeout(timers[slice] as ReturnType<typeof setTimeout>);
          timers[slice] = null;
        }
      });
    };

    // Serialize attach/detach so the initial getSession() attach and the
    // onAuthStateChange INITIAL_SESSION attach can't interleave into a
    // double-subscribe. Each op runs only after the previous one settles.
    let opChain: Promise<unknown> = Promise.resolve();
    const enqueue = (fn: () => Promise<void>) => {
      opChain = opChain.catch(() => undefined).then(fn);
      return opChain;
    };

    const detach = async () => {
      clearTimers();
      if (channel) {
        const c = channel;
        channel = null;
        try {
          await supabase.removeChannel(c);
        } catch {
          // Tear-down errors are non-fatal — Supabase cleans up on reconnect.
        }
      }
    };

    const attach = async (userId: string) => {
      await detach();
      if (cancelled) return;
      currentUserId = userId;
      channel = supabase
        .channel(`user-${userId}-realtime`)
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'cigarette_logs', filter: `user_id=eq.${userId}` },
          () => schedule('logs'),
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
          () => schedule('goals'),
        )
        .on(
          // user_profiles is never deleted (account erase soft-deletes via
          // UPDATE), so UPDATE is the only event that can fire here.
          'postgres_changes' as never,
          { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` },
          () => schedule('profile'),
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'brands', filter: `user_id=eq.${userId}` },
          () => schedule('brands'),
        )
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table: 'brand_variants', filter: `user_id=eq.${userId}` },
          () => schedule('brands'),
        )
        .subscribe();
    };

    // Attach immediately if a session already exists (the common case).
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const uid = data.session?.user?.id;
      if (uid) void enqueue(() => attach(uid));
    });

    // Re-attach on sign-in / token refresh; detach on sign-out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) {
        void enqueue(() => attach(uid));
      } else {
        currentUserId = null;
        void enqueue(() => detach());
      }
    });

    // Foreground reconcile — re-open the (likely dropped) socket and full-refresh.
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && currentUserId) {
        const uid = currentUserId;
        void enqueue(() => attach(uid));
        void useSession.getState().refreshAll().catch(() => undefined);
      }
    };
    const appStateSub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      appStateSub.remove();
      void detach();
    };
  }, []);

  return null;
}

export default RealtimeRefresher;
