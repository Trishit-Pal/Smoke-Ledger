import * as React from 'react';
import { GoToHomepageLink } from '@web/components/layout/GoToHomepageLink';

export interface PublicPageShellProps {
  children: React.ReactNode;
  /**
   * Optional pinned backdrop (e.g. the fixed WebGL SceneBackground). Rendered as
   * a sibling BEFORE the content so its fixed canvas (z-0) stays behind. When
   * present, the content rides a translucent `--bg` veil (z-1) so text keeps its
   * WCAG-AA contrast over the moving scene. Absent → the page renders exactly as
   * before (legal pages are unaffected).
   */
  backdrop?: React.ReactNode;
}

export function PublicPageShell({ children, backdrop }: PublicPageShellProps) {
  return (
    <div className="relative min-h-screen bg-bg text-text">
      {backdrop}
      <div
        className="relative"
        style={
          backdrop
            ? { zIndex: 1, background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }
            : undefined
        }
      >
        {children}
      </div>
      <GoToHomepageLink />
    </div>
  );
}
