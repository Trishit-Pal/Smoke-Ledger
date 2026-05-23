import * as React from 'react';
import { GoToHomepageLink } from '@web/components/layout/GoToHomepageLink';

export interface EditorialPageShellProps {
  children: React.ReactNode;
  maxWidth?: number;
  showGoHome?: boolean;
  centered?: boolean;
}

export function EditorialPageShell({
  children,
  maxWidth = 640,
  showGoHome = true,
  centered = false,
}: EditorialPageShellProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div
        aria-hidden
        className="paper-noise"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth,
          margin: '0 auto',
          padding: 'clamp(32px, 6vw, 72px) clamp(20px, 5vw, 48px)',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: centered ? 'center' : 'flex-start',
        }}
      >
        <div
          className="editorial-stage"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {children}
        </div>
      </main>
      {showGoHome ? <GoToHomepageLink /> : null}
    </div>
  );
}

export default EditorialPageShell;
