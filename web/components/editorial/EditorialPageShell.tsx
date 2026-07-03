import * as React from 'react';
import { GoToHomepageLink } from '@web/components/layout/GoToHomepageLink';
// CHARACTER: import the companion. It mounts once, listens for character:mood events.
import { CharacterCompanion } from '@web/components/character/CharacterCompanion';

export interface EditorialPageShellProps {
  children: React.ReactNode;
  maxWidth?: number;
  showGoHome?: boolean;
  centered?: boolean;
  /**
   * Optional pinned backdrop (e.g. the fixed WebGL SceneBackground). Rendered
   * behind everything; when present, the content column rides a translucent
   * `--bg` veil so text keeps WCAG-AA contrast over the moving scene. Absent →
   * the shell renders exactly as before (legal/static callers are unaffected).
   */
  backdrop?: React.ReactNode;
}

export function EditorialPageShell({
  children,
  maxWidth = 640,
  showGoHome = true,
  centered = false,
  backdrop,
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
      {backdrop}
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
          // Veil the content column over the fixed scene (brand tier → 85%).
          background: backdrop ? 'color-mix(in srgb, var(--bg) 85%, transparent)' : undefined,
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

      {/*
       * CHARACTER: companion lives in the page background, right of the form
       * column. Positions itself just outside the maxWidth column so it never
       * overlaps the form on any viewport. Hidden below md (768px) so narrow
       * screens aren't cluttered.
       *
       * The calculation: half the page minus half the form column minus 116px
       * (character width + gutter) gives clearance from the form's right edge.
       * The max(1rem, …) floor stops it bleeding off-screen on small laptops.
       */}
      <div
        className="hidden md:block"
        style={{
          position: 'absolute',
          top: 'clamp(28px, 6vw, 64px)',
          right: `max(1rem, calc(50% - ${maxWidth / 2}px - 116px))`,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <CharacterCompanion size={96} showCaption={true} />
      </div>

      {showGoHome ? <GoToHomepageLink /> : null}
    </div>
  );
}

export default EditorialPageShell;
