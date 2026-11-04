import * as React from 'react';
import { Sidebar } from '@web/components/layout/Sidebar';
import { BottomNav } from '@web/components/layout/BottomNav';
// CHARACTER: mount the milestone modal + logout farewell portals once at the
// app-shell layer so they capture events from anywhere in the authenticated
// area. Both render nothing until an event fires; zero cost when idle.
import { MilestoneCelebration } from '@web/components/character/MilestoneCelebration';
import { LogoutFarewell } from '@web/components/character/LogoutFarewell';
import { GoalMoment } from '@web/components/character/GoalMoment';
// REALTIME: mounted once at the (app) layout — keeps one WebSocket per
// session and calls router.refresh() (debounced) when any of the current
// user's cigarette_logs / goals / user_profiles rows change. Cross-tab and
// cross-device updates flow through here.
import { RealtimeRefresher } from '@web/components/realtime/RealtimeRefresher';
// One shared fixed WebGL backdrop for the whole authenticated app. Mounted once
// here (not per-page) so it survives in-app navigation without rebuilding, and
// covers dashboard/log/trends/history/goals/settings uniformly. Quiet tier
// (dimmed, no bloom) so task-focused pages stay legible.
import { SceneBackdrop } from '@web/components/marketing/SceneBackdrop';
// Ask the ledger on every reading page (hidden on Log). The layout passes the
// server flag only; the dock reads its own state on every open. Where the dock
// shows, --ask-dock-clear (globals.css) pads main and lifts page-level fixed
// controls (History's New log, its toast) clear of it; 0 when off and on Log.
import { AskLedgerDock } from '@web/components/chat/AskLedgerDock';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';
import { getServerProfile } from '@web/lib/server/data';
import { isDiscreetMode } from '@/lib/discreet';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Discreet readers get a neutral haze only (no lungs, no sign). The loader is
  // React-cached, so the page's own call shares this read and still performs
  // any login redirect; the layout itself must never throw or redirect here.
  const discreet = await getServerProfile().then(isDiscreetMode).catch(() => false);
  return (
    <div data-app-shell className="relative flex min-h-dvh bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-lg focus:top-lg focus:z-[60] focus:rounded-md focus:bg-card focus:px-lg focus:py-md focus:text-small focus:text-text focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <SceneBackdrop intensity="quiet" discreet={discreet} />
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 min-h-dvh outline-none pb-[calc(5rem+env(safe-area-inset-bottom)+var(--ask-dock-clear,0px))] short-landscape:pb-[calc(3.5rem+env(safe-area-inset-bottom)+var(--ask-dock-clear,0px))] md:short-landscape:pb-[var(--ask-dock-clear,0px)] md:pb-[var(--ask-dock-clear,0px)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pl-0">
        {/* Translucent veil (z-1) over the fixed z-0 canvas so body text keeps
            WCAG-AA contrast over the moving scene. */}
        <div
          className="relative min-h-dvh"
          style={{ zIndex: 1, background: 'color-mix(in srgb, var(--bg) 91%, transparent)' }}
        >
          {children}
        </div>
      </main>
      {/* The wrapper carries the safe-area inset (and a matching bg so the inset
          strip is filled) so the nav itself stays a fixed 4rem of touch targets
          — it can't grow under system font scaling and clip page content. */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <BottomNav />
      </div>
      {/* CHARACTER: event-driven overlays. Order doesn't matter — both portal
          to document.body and fire only on their respective custom events. */}
      <AskLedgerDock enabled={isLedgerChatEnabled()} />
      <MilestoneCelebration />
      <LogoutFarewell />
      <GoalMoment />
      <RealtimeRefresher />
    </div>
  );
}
