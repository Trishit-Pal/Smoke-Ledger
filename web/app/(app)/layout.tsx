import * as React from 'react';
import { Sidebar } from '@web/components/layout/Sidebar';
import { BottomNav } from '@web/components/layout/BottomNav';
// CHARACTER: mount the milestone modal + logout farewell portals once at the
// app-shell layer so they capture events from anywhere in the authenticated
// area. Both render nothing until an event fires; zero cost when idle.
import { MilestoneCelebration } from '@web/components/character/MilestoneCelebration';
import { LogoutFarewell } from '@web/components/character/LogoutFarewell';
// REALTIME: mounted once at the (app) layout — keeps one WebSocket per
// session and calls router.refresh() (debounced) when any of the current
// user's cigarette_logs / goals / user_profiles rows change. Cross-tab and
// cross-device updates flow through here.
import { RealtimeRefresher } from '@web/components/realtime/RealtimeRefresher';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-20 md:pb-0">{children}</main>
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50">
        <BottomNav />
      </div>
      {/* CHARACTER: event-driven overlays. Order doesn't matter — both portal
          to document.body and fire only on their respective custom events. */}
      <MilestoneCelebration />
      <LogoutFarewell />
      <RealtimeRefresher />
    </div>
  );
}
