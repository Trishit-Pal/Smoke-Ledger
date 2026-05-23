import * as React from 'react';

export interface EditorialClosingSignetProps {
  children: React.ReactNode;
  align?: 'left' | 'center';
}

export function EditorialClosingSignet({
  children,
  align = 'center',
}: EditorialClosingSignetProps) {
  return (
    <footer
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align === 'center' ? 'center' : 'left',
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--rule)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
          maxWidth: 520,
        }}
      >
        {children}
      </span>
    </footer>
  );
}

export default EditorialClosingSignet;
