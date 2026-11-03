'use client';

import * as React from 'react';
import Link from 'next/link';
import { Stamp } from '@web/components/onboarding/Stamp';
import { LEGAL_LINKS } from '@web/lib/legal';
import {
  HEALTH_CONSENT_LABEL,
  HEALTH_CONSENT_SUB,
  HEALTH_DECLINE_LABEL,
  HEALTH_DECLINE_NOTE,
  HEALTH_DECLINE_NOTE_EXISTING,
} from '@/lib/healthConsent';

// The consent rows, shared by the onboarding privacy step and the /consent
// re-consent screen so the wording, links and decline path cannot drift.

export type RequiredKey = 'age' | 'terms' | 'privacy' | 'medical' | 'dataProcessing';

export interface ConsentRow {
  id: RequiredKey;
  label: React.ReactNode;
  sub?: string;
}

const linkStyle: React.CSSProperties = {
  color: 'var(--accent-ink)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

export const REQUIRED_ROWS: ConsentRow[] = [
  {
    id: 'age',
    label: 'I confirm I am 18 or older.',
    sub: 'Smoke Ledger is for adults. Required by law.',
  },
  {
    id: 'terms',
    label: (
      <>
        I agree to the{' '}
        <Link href={LEGAL_LINKS.terms} style={linkStyle}>
          Terms of Service
        </Link>
        .
      </>
    ),
  },
  {
    id: 'privacy',
    label: (
      <>
        I acknowledge the{' '}
        <Link href={LEGAL_LINKS.privacy} style={linkStyle}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    id: 'medical',
    label: 'I understand this app does not provide medical advice.',
    sub: 'For health decisions, please consult a clinician.',
  },
  {
    id: 'dataProcessing',
    label: 'I consent to processing my data for account, sync, and security.',
  },
];

export interface ConsentCheckRowProps {
  row: ConsentRow;
  /** Zero-based position, used for the printed number and the stamp tilt. */
  index: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ConsentCheckRow({ row, index, checked, onChange }: ConsentCheckRowProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--rule)',
        cursor: 'pointer',
        transition: 'background 160ms ease',
      }}
    >
      <input
        type="checkbox"
        className="ed-checkbox focus-ring"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{row.label}</span>
        {row.sub ? (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>{row.sub}</span>
        ) : null}
      </div>
      <div
        style={{
          minWidth: 96,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          minHeight: 22,
        }}
      >
        <Stamp show={checked} rotate={-6 + (index % 2 === 0 ? -2 : 3)}>
          Acknowledged
        </Stamp>
      </div>
      <span
        className="editorial-caption-tight nums-tabular"
        style={{
          color: checked ? 'var(--accent-ink)' : 'var(--text-faint)',
          marginTop: 4,
          minWidth: 22,
          textAlign: 'right',
          transition: 'color 200ms ease',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
    </label>
  );
}

export interface HealthConsentRowProps {
  checked: boolean;
  declined: boolean;
  /** Ticking gives consent; the decline button passes false. */
  onChange: (given: boolean) => void;
  /** The printed row number, e.g. "06". */
  number: string;
  /** True on the re-consent screen, where the reader already has a ledger. */
  existingLedger?: boolean;
}

/** The unticked Art 9 row, with a decline control the same size as the accept one. */
export function HealthConsentRow({ checked, declined, onChange, number, existingLedger = false }: HealthConsentRowProps) {
  return (
    <div style={{ borderBottom: '1px solid var(--rule)' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '14px 0 8px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          className="ed-checkbox focus-ring"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            {HEALTH_CONSENT_LABEL}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            {HEALTH_CONSENT_SUB}
          </span>
        </div>
        <div style={{ minWidth: 96, display: 'flex', justifyContent: 'flex-end' }}>
          <Stamp show={checked} rotate={-5}>
            Acknowledged
          </Stamp>
        </div>
        <span
          className="editorial-caption-tight nums-tabular"
          style={{
            color: checked ? 'var(--accent-ink)' : 'var(--text-faint)',
            marginTop: 4,
            minWidth: 22,
            textAlign: 'right',
          }}
        >
          {number}
        </span>
      </label>
      <div style={{ paddingBottom: 12, paddingLeft: 32 }}>
        <button
          type="button"
          aria-pressed={declined}
          onClick={() => onChange(false)}
          className="focus-ring hit-target"
          style={{
            minHeight: 44,
            padding: '0 4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            textDecoration: declined ? 'underline' : 'none',
            textUnderlineOffset: 4,
          }}
        >
          {HEALTH_DECLINE_LABEL}
        </button>
        {declined ? (
          <p
            role="status"
            style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.55 }}
          >
            {existingLedger ? HEALTH_DECLINE_NOTE_EXISTING : HEALTH_DECLINE_NOTE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
