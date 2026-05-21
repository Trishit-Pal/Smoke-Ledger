import * as React from 'react';
import { GoToHomepageLink } from '@web/components/layout/GoToHomepageLink';

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      {children}
      <GoToHomepageLink />
    </div>
  );
}
