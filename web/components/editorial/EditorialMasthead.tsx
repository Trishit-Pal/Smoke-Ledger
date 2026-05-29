import * as React from 'react';

/*
 * EditorialMasthead — extended with an optional `companion` slot.
 *
 * INTEGRATION CHANGES vs the existing file in web/components/editorial/:
 *   + Added optional `companion?: React.ReactNode` prop.
 *   + If present, renders companion in the top-right corner of the masthead
 *     header via absolute positioning. The masthead becomes `position:
 *     relative` to host it.
 *   + No change to existing call sites — all current usages keep working
 *     since `companion` is optional.
 *
 * Pass <CharacterCompanion size={88} /> through this slot from any page that
 * uses an EditorialMasthead. The DashboardClient uses its own header layout
 * so it mounts CharacterCompanion directly rather than via this slot.
 */

export interface EditorialMastheadProps {
  caption: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  effectiveDate?: string;
  align?: 'left' | 'center';
  ruleWidth?: number;
  /** Optional figure / illustration slot pinned to the masthead's top-right.
   *  Hidden on viewports narrower than 640px so it never crowds the headline. */
  companion?: React.ReactNode;
}

export function EditorialMasthead({
  caption,
  title,
  subtitle,
  effectiveDate,
  align = 'left',
  ruleWidth = 60,
  companion,
}: EditorialMastheadProps) {
  return (
    <header
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align === 'center' ? 'center' : 'left',
      }}
    >
      {companion ? (
        <div
          aria-hidden={false}
          className="masthead-companion-slot"
          style={{
            position: 'absolute',
            top: -8,
            right: 0,
            pointerEvents: 'none',
          }}
        >
          {companion}
        </div>
      ) : null}

      <span className="editorial-caption">{caption}</span>
      <h1
        className="editorial-headline"
        style={{
          fontSize: 'clamp(26px, 3.4vw, 40px)',
          margin: 0,
          color: 'var(--text)',
        }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 520,
          }}
        >
          {subtitle}
        </p>
      ) : null}
      {effectiveDate ? (
        <span className="editorial-caption-tight" style={{ color: 'var(--text-faint)' }}>
          {effectiveDate}
        </span>
      ) : null}
      <div
        className="rule-draw"
        style={{
          borderTop: '1px solid var(--rule-strong)',
          width: ruleWidth,
          marginTop: 4,
        }}
      />
    </header>
  );
}

export default EditorialMasthead;
