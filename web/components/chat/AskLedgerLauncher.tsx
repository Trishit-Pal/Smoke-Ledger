'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { buildToolContext } from '@/domain/ledgerChat/context';
import { starterQuestions } from '@/domain/ledgerChat/starters';
import type { DailySummaryRow } from '@/domain/periodSummary';
import { daysAgoInZone } from '@/lib/date';
import { timezoneForCountry } from '@/lib/regions';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { cn } from '@web/components/ui/cn';

// The panel (Radix dialog, settings and audit calls) loads only when the
// launcher renders, so pages carry none of it while the feature is off.
const AskLedgerPanel = dynamic(
  () => import('@web/components/chat/AskLedgerPanel').then((m) => m.AskLedgerPanel),
  { ssr: false },
);

export interface AskLedgerLauncherProps {
  /** Server flag: the feature is off until the operator turns it on. */
  enabled: boolean;
  profile: UserProfile;
  logs: CigaretteLog[];
  rows: DailySummaryRow[];
  goals: Goal[];
  today: string;
  className?: string;
}

const SUMMARY_WINDOW_DAYS = 365;

/** A quiet underlined entry, styled like "View full history →", that opens the panel. */
export function AskLedgerLauncher({ enabled, profile, logs, rows, goals, today, className }: AskLedgerLauncherProps) {
  const [open, setOpen] = React.useState(false);
  // Starters come from the ledger's own state (goal, days of data, moods),
  // computed from the props the page already holds: no extra query.
  const starters = React.useMemo(
    () =>
      starterQuestions(
        buildToolContext({
          profile,
          logs,
          rows,
          goals,
          today,
          summarySinceYmd: daysAgoInZone(SUMMARY_WINDOW_DAYS, timezoneForCountry(profile.country)),
        }),
      ),
    [profile, logs, rows, goals, today],
  );

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center rounded-sm text-small text-text-muted underline decoration-1 underline-offset-4 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          className,
        )}
        style={{ textDecorationColor: 'var(--rule-strong)' }}
      >
        Ask the ledger →
      </button>
      <AskLedgerPanel open={open} onOpenChange={setOpen} profile={profile} starters={starters} />
    </>
  );
}
