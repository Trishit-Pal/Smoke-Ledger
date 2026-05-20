import * as React from 'react';
import { Sidebar } from '@web/components/layout/Sidebar';
import { BottomNav } from '@web/components/layout/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-20 md:pb-0">{children}</main>
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50">
        <BottomNav />
      </div>
    </div>
  );
}
