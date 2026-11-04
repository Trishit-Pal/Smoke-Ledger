'use client';

import * as React from 'react';
import Link from 'next/link';
import { Stamp } from '@web/components/onboarding/Stamp';
import { LEGAL_LINKS } from '@web/lib/legal';
import { LEDGER_CHAT_NOTICE } from '@web/components/chat/notice';
import {
  AGREEMENT_LABEL_PARTS,
  AGREEMENT_SUB,
  HEALTH_CONSENT_LABEL,
  HEALTH_CONSENT_SUB,
} from '@/lib/healthConsent';

// The consent rows, shared by the onboarding privacy step and the /consent
// re-consent screen so the wording and links cannot drift.

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

interface TickRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  number: string;
  rotate: number;
  label: React.ReactNode;
  sub: string;
}

/** One unticked line: checkbox, its words, the stamp and the printed number. */
function TickRow({ checked, onChange, number, rotate, label, sub }: TickRowProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--rule)',
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
        <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>{sub}</span>
      </div>
      <div style={{ minWidth: 96, display: 'flex', justifyContent: 'flex-end' }}>
        <Stamp show={checked} rotate={rotate}>
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
  );
}

export interface TickRowOwnProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The printed row number, e.g. "01". */
  number: string;
}

/** Tick 1: age, Terms, Privacy Policy and the medical-advice note, in one line. */
export function AgreementRow({ checked, onChange, number }: TickRowOwnProps) {
  const { before, terms, middle, privacy, after } = AGREEMENT_LABEL_PARTS;
  return (
    <TickRow
      checked={checked}
      onChange={onChange}
      number={number}
      rotate={-7}
      sub={AGREEMENT_SUB}
      label={
        <>
          {before}
          <Link href={LEGAL_LINKS.terms} style={linkStyle}>
            {terms}
          </Link>
          {middle}
          <Link href={LEGAL_LINKS.privacy} style={linkStyle}>
            {privacy}
          </Link>
          {after}
        </>
      }
    />
  );
}

/** Tick 2: the unticked Art 9 consent, on its own line. */
export function HealthConsentRow({ checked, onChange, number }: TickRowOwnProps) {
  return (
    <TickRow
      checked={checked}
      onChange={onChange}
      number={number}
      rotate={-5}
      label={HEALTH_CONSENT_LABEL}
      sub={HEALTH_CONSENT_SUB}
    />
  );
}

export interface ChatChoiceRowProps {
  /** null until the reader chooses; there is no default. */
  answer: boolean | null;
  onAnswer: (turnOn: boolean) => void;
  number: string;
}

const noticeText: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  lineHeight: 1.55,
  maxWidth: '52ch',
  margin: 0,
};

function ChoiceButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="focus-ring hit-target min-h-11"
      style={{
        flex: 1,
        padding: '0 16px',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        color: 'var(--text)',
        fontWeight: pressed ? 600 : 400,
        border: `1px solid ${pressed ? 'var(--accent-ink)' : 'var(--rule-strong)'}`,
        boxShadow: pressed ? 'inset 0 0 0 1px var(--accent-ink)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

/** Ask the ledger: the full notice (lead up front, the rest folded) and an equal Yes / No pair. */
export function ChatChoiceRow({ answer, onAnswer, number }: ChatChoiceRowProps) {
  const headingId = React.useId();
  const { lead, scope, sent, discreet, retention, device } = LEDGER_CHAT_NOTICE;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--rule)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <p id={headingId} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, margin: 0, flex: 1 }}>
          Turn on Ask the ledger? <span style={{ color: 'var(--text-muted)' }}>{lead}</span>
        </p>
        <div style={{ minWidth: 96, display: 'flex', justifyContent: 'flex-end' }}>
          <Stamp show={answer !== null} rotate={-4}>
            Answered
          </Stamp>
        </div>
        <span
          className="editorial-caption-tight nums-tabular"
          style={{
            color: answer === null ? 'var(--text-faint)' : 'var(--accent-ink)',
            minWidth: 22,
            textAlign: 'right',
          }}
        >
          {number}
        </span>
      </div>
      <details>
        <summary
          className="focus-ring editorial-caption"
          style={{ cursor: 'pointer', color: 'var(--text-muted)', minHeight: 44, display: 'flex', alignItems: 'center' }}
        >
          Read the details
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
          <p style={noticeText}>{scope}</p>
          <p style={noticeText}>{sent}</p>
          <p style={noticeText}>{discreet}</p>
          <p style={noticeText}>{retention}</p>
          <p style={noticeText}>
            {device}{' '}
            <Link href={LEGAL_LINKS.privacy} style={linkStyle}>
              Privacy policy
            </Link>
          </p>
        </div>
      </details>
      <div style={{ display: 'flex', gap: 12 }}>
        <ChoiceButton pressed={answer === true} onClick={() => onAnswer(true)}>
          Yes, turn it on
        </ChoiceButton>
        <ChoiceButton pressed={answer === false} onClick={() => onAnswer(false)}>
          No, thanks
        </ChoiceButton>
      </div>
    </div>
  );
}
