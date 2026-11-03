import * as React from 'react';

export interface EditorialFieldRowProps {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  optional?: boolean;
  strong?: boolean;
}

export function EditorialFieldRow({
  label,
  hint,
  error,
  children,
  optional,
  strong = false,
}: EditorialFieldRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: `1px solid var(--${strong ? 'rule-strong' : 'rule'})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span className="editorial-caption-tight">{label}</span>
        {optional ? (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 11,
              color: 'var(--text-faint)',
            }}
          >
            optional
          </span>
        ) : null}
      </div>
      <div>{children}</div>
      {error ? (
        <span
          role="alert"
          style={{ fontSize: 12, color: 'var(--warn-earth-ink)', lineHeight: 1.5 }}
        >
          {error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{hint}</span>
      ) : null}
    </div>
  );
}

export default EditorialFieldRow;
