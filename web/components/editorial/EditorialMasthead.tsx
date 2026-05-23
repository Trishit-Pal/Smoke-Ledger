import * as React from 'react';

export interface EditorialMastheadProps {
  caption: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  effectiveDate?: string;
  align?: 'left' | 'center';
  ruleWidth?: number;
}

export function EditorialMasthead({
  caption,
  title,
  subtitle,
  effectiveDate,
  align = 'left',
  ruleWidth = 60,
}: EditorialMastheadProps) {
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align === 'center' ? 'center' : 'left',
      }}
    >
      <span className="editorial-caption">{caption}</span>
      <h1
        className="editorial-headline"
        style={{
          fontSize: 'clamp(32px, 4vw, 48px)',
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
            fontSize: 16,
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
