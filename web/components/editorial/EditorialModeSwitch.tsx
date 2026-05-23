'use client';

import * as React from 'react';

export interface EditorialModeSwitchOption<T extends string> {
  value: T;
  label: string;
}

export interface EditorialModeSwitchProps<T extends string> {
  options: EditorialModeSwitchOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}

export function EditorialModeSwitch<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: EditorialModeSwitchProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <React.Fragment key={opt.value}>
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(opt.value)}
              className="focus-ring"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: selected ? 600 : 500,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: selected ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                borderBottom: selected
                  ? '1px solid var(--accent)'
                  : '1px solid transparent',
                transition: 'color 160ms ease, border-color 160ms ease',
              }}
            >
              {opt.label}
            </button>
            {i < options.length - 1 ? (
              <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                ·
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default EditorialModeSwitch;
