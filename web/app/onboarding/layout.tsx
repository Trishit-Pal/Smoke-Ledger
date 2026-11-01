import * as React from 'react';
import { OnboardingProgress, OnboardingRail } from '@web/components/onboarding/OnboardingRail';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          minHeight: '100dvh',
          zIndex: 1,
        }}
      >
        <OnboardingRail />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'clamp(28px, 4vw, 56px) clamp(20px, 5vw, 72px)',
            position: 'relative',
            overflowX: 'hidden',
          }}
        >
          <OnboardingProgress />
          {children}
        </main>
      </div>
    </div>
  );
}
