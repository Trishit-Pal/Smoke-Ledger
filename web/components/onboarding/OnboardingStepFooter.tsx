'use client';

import * as React from 'react';

export interface OnboardingStepFooterProps {
  onBack?: () => void;
  backLabel?: string;
  caption?: React.ReactNode;
  secondary?: { label: string; onPress: () => void; disabled?: boolean };
  primary: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
}

export function OnboardingStepFooter({
  onBack,
  backLabel = '← Back',
  caption,
  secondary,
  primary,
}: OnboardingStepFooterProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginTop: 8,
        flexWrap: 'wrap',
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="focus-ring"
          style={{
            height: 44,
            padding: '0 16px',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'border-color 140ms ease, color 140ms ease',
          }}
        >
          {backLabel}
        </button>
      ) : (
        <span aria-hidden style={{ width: 1 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {caption ? (
          <span
            className="editorial-caption-tight nums-tabular"
            style={{ color: 'var(--text-faint)' }}
          >
            {caption}
          </span>
        ) : null}
        {secondary ? (
          <button
            type="button"
            onClick={secondary.onPress}
            disabled={secondary.disabled}
            className="focus-ring"
            style={{
              height: 44,
              padding: '0 16px',
              border: '1px solid var(--rule)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 14,
              cursor: secondary.disabled ? 'not-allowed' : 'pointer',
              opacity: secondary.disabled ? 0.45 : 1,
            }}
          >
            {secondary.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={primary.onPress}
          disabled={primary.disabled || primary.loading}
          className="focus-ring"
          style={{
            height: 44,
            padding: '0 20px',
            border: 'none',
            borderRadius: 10,
            background: 'var(--accent-ink)',
            color: 'var(--on-accent)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 14,
            cursor: primary.disabled || primary.loading ? 'not-allowed' : 'pointer',
            opacity: primary.disabled || primary.loading ? 0.45 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'opacity 140ms ease',
          }}
        >
          {primary.loading ? (
            <span
              aria-hidden
              className="animate-spin"
              style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
              }}
            />
          ) : null}
          {primary.label}
        </button>
      </div>
    </div>
  );
}

export default OnboardingStepFooter;
