'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Log · the morning extract from the printed ledger
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Sibling of History — shows the same hairline-row typography but scoped to
 *  what was written today + the most recent thirty entries. The page exists
 *  for two readers: someone who just logged something via QuickLog and wants
 *  to verify the line landed correctly, and someone who wants to add a
 *  detailed entry (the persistent "Write new entry" affordance up top).
 *
 *  This is intentionally a slim view. The deep ledger lives at /history.
 *  Anything more substantial than "what did I just write?" belongs there.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { todayIst, formatTime } from '@/lib/date';
import { formatInr, formatPerStick } from '@/lib/format';
import { triggerLabel } from '@/constants/triggers';
import type { CigaretteLog, UserProfile } from '@/types';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';
import { SectionLabel } from '@web/components/visual';

export interface LogClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
}

function formatIndianDateShort(ymd: string): string {
  const [, month, day] = ymd.split('-');
  return `${day}/${month}`;
}

export function LogClient({ profile, logs }: LogClientProps) {
  const router = useRouter();
  const today = todayIst();
  const discreet = isDiscreetMode(profile);

  const todaysLogs = React.useMemo(
    () =>
      [...logs]
        .filter((l) => l.localDate === today)
        .sort((a, b) => b.tsUtc.localeCompare(a.tsUtc)),
    [logs, today],
  );

  const recentLogs = React.useMemo(
    () => [...logs].sort((a, b) => b.tsUtc.localeCompare(a.tsUtc)).slice(0, 30),
    [logs],
  );

  const todayTotalSticks = React.useMemo(
    () => todaysLogs.reduce((acc, l) => acc + l.quantity, 0),
    [todaysLogs],
  );
  const todayTotalSpend = React.useMemo(
    () => todaysLogs.reduce((acc, l) => acc + (l.totalPriceInr ?? 0), 0),
    [todaysLogs],
  );

  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="relative mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-xxxl md:pt-xxl md:px-xxl">
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col gap-xxl">
        {/* ── Masthead ── */}
        <header style={idx(0)} className="flex flex-col gap-sm">
          <div className="flex items-center gap-md">
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
            <span className="editorial-caption nums-tabular">Log · Recent</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
          </div>
          <p className="text-small text-text-muted text-center italic">
            What you&apos;ve written so far.
          </p>
          <div className="flex justify-center mt-sm">
            <button
              type="button"
              onClick={() => router.push('/log/new')}
              className="inline-flex items-center min-h-[44px] px-lg rounded-md bg-text text-bg font-medium text-body hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Write a new entry
            </button>
          </div>
        </header>

        {/* ── Today ── */}
        <section style={idx(1)} aria-labelledby="today-heading" className="flex flex-col">
          <header className="rule-hair-strong grid grid-cols-[1fr_auto] items-baseline gap-md pt-md pb-md">
            <div>
              <SectionLabel id="today-heading" spacing="none">
                Today
              </SectionLabel>
              <p className="text-small text-text-muted nums-tabular mt-xs">
                {todaysLogs.length === 0
                  ? 'Nothing logged today.'
                  : maskInr(todayTotalSpend, discreet, (n) =>
                      formatInr(n, { compact: true }),
                    )}
              </p>
            </div>
            <div
              className="editorial-numeral--small nums-tabular text-right"
              aria-label={
                discreet
                  ? "Today's total: hidden"
                  : `Today's total: ${todayTotalSticks} ${
                      todayTotalSticks === 1 ? 'cigarette' : 'cigarettes'
                    }`
              }
            >
              {discreet ? '••' : todayTotalSticks}
              <span className="text-small text-text-faint font-sans ml-xs">
                {todayTotalSticks === 1 ? 'stick' : 'sticks'}
              </span>
            </div>
          </header>

          {todaysLogs.length === 0 ? (
            <p className="text-body text-text-muted py-md max-w-[42ch]">
              The home tab&apos;s quick-log is the fastest way in, or write a
              detailed entry above.
            </p>
          ) : (
            <ul>
              {todaysLogs.map((log) => (
                <li
                  key={log.id}
                  className="rule-hair grid grid-cols-[1fr_auto] items-baseline gap-md py-md"
                >
                  <div className="min-w-0">
                    <p className="text-body text-text truncate">
                      {maskBrandName(log.brandNameSnap ?? 'Unbranded', discreet)}
                      {log.triggerTag && !discreet ? (
                        <span className="text-text-muted">
                          {' · '}
                          {triggerLabel(log.triggerTag)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-small text-text-muted nums-tabular">
                      {formatTime(log.tsUtc)}
                      {' · '}
                      {discreet
                        ? '•••'
                        : `${log.quantity} stick${log.quantity > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-small text-text-muted nums-tabular">
                      {log.totalPriceInr != null
                        ? maskInr(log.totalPriceInr, discreet, (n) =>
                            formatInr(n, { compact: true }),
                          )
                        : '—'}
                    </p>
                    {log.unitPriceInr != null ? (
                      <p className="text-caption text-text-faint nums-tabular">
                        {maskInr(log.unitPriceInr, discreet, (n) =>
                          formatPerStick(n, { compact: true }),
                        )}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Recent (last 30 entries) ── */}
        {recentLogs.length > 0 ? (
          <section style={idx(2)} aria-labelledby="recent-heading" className="flex flex-col">
            <header className="rule-hair-strong pt-md pb-md">
              <SectionLabel id="recent-heading" spacing="none">
                The last thirty entries
              </SectionLabel>
              <p className="text-small text-text-muted italic mt-xs">
                Reverse chronological. The deeper archive is at{' '}
                <button
                  type="button"
                  onClick={() => router.push('/history')}
                  className="underline underline-offset-4 decoration-1 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
                  style={{ textDecorationColor: 'var(--rule-strong)' }}
                >
                  /history
                </button>
                .
              </p>
            </header>
            <ul>
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="rule-hair grid grid-cols-[auto_1fr_auto] items-baseline gap-md py-sm"
                >
                  <span className="text-small text-text-faint nums-tabular w-[3rem]">
                    {formatIndianDateShort(log.localDate)}
                  </span>
                  <span className="text-small text-text truncate">
                    {maskBrandName(log.brandNameSnap ?? '—', discreet)}
                    <span className="text-text-muted nums-tabular">
                      {' '}
                      ×{discreet ? '•' : log.quantity}
                    </span>
                  </span>
                  <span className="text-small text-text-muted nums-tabular text-right flex flex-col items-end">
                    <span>
                      {log.totalPriceInr != null
                        ? maskInr(log.totalPriceInr, discreet, (n) =>
                            formatInr(n, { compact: true }),
                          )
                        : '—'}
                    </span>
                    {log.unitPriceInr != null ? (
                      <span className="text-caption text-text-faint">
                        {maskInr(log.unitPriceInr, discreet, (n) =>
                          formatPerStick(n, { compact: true }),
                        )}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Empty state ── */}
        {recentLogs.length === 0 && todaysLogs.length === 0 ? (
          <section style={idx(1)} className="rule-hair pt-lg flex flex-col gap-sm">
            <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">
              Nothing logged yet.
            </p>
            <p className="text-body text-text-muted max-w-[42ch]">
              One line is enough to start a record. Write your first entry
              above, or use quick-log from the home tab.
            </p>
          </section>
        ) : null}

        {/* ── Footer ── */}
        <footer style={idx(3)} className="rule-hair pt-md flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/history')}
            className="text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
            style={{ textDecorationColor: 'var(--rule-strong)' }}
          >
            Open the full archive →
          </button>
          <span className="text-caption text-text-faint italic">
            The line gets written by you.
          </span>
        </footer>
      </div>
    </div>
  );
}
