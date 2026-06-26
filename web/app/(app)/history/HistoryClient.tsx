'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  History — "Quiet editorial · the printed ledger"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Aesthetic direction: History is the back-of-the-paper section of the daily
 *  report — every entry, set in type, held together by hairline rules. There
 *  are no Card containers: each day is a typographic movement headed by its
 *  date in small caps with the day's stick count as a small editorial numeral
 *  on the right. Entries within a day are a dl-like list of rows separated by
 *  hairlines: the brand+variant in body weight, time+quantity captioned, the
 *  price right-aligned in tabular figures.
 *
 *  The hero editorial numeral (.editorial-numeral) is reserved for the
 *  Dashboard. History uses .editorial-numeral--small for day totals so it
 *  reads as the Dashboard's sibling, not a copy.
 *
 *  Today and yesterday get a single Fraunces italic day-name label above the
 *  numeric date — a small editorial flourish that helps the eye land on the
 *  most recent activity without resorting to badges.
 *
 *  Motion: .editorial-stage staggers the masthead (0), then each day group
 *  (1..N), then the load-more / end-mark line (last). Reduced-motion users
 *  see everything immediately via the global @media rule in globals.css.
 *
 *  Data path is unchanged. The F1b load-more state machine (cursor +
 *  useTransition + captured cursor at request time) is preserved exactly.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { formatInr, formatPerStick } from '@/lib/format';
import { formatIndianDate, formatTime, todayIst, daysAgoIst } from '@/lib/date';
import { deleteLog } from '@/db/repositories/logs';
import dayjs from 'dayjs';
import type { Brand, BrandVariant, CigaretteLog, UserProfile } from '@/types';
import type { LogCursor } from '@web/lib/server/data';
import { isDiscreetMode, maskBrandName, maskInr } from '@/lib/discreet';
import { revalidateAppViews } from '../_actions/revalidate';
import { toSafeErrorMessage } from '@/lib/errors';
import { LogEditModal } from '@web/components/modals/LogEditModal';
import { ConfirmDialog } from '@web/components/ui/ConfirmDialog';
import { fetchMoreHistoryLogs } from './actions';

type Group = {
  date: string;
  rows: CigaretteLog[];
  totalSpend: number;
  totalSticks: number;
};

function groupLogs(logs: CigaretteLog[]): Group[] {
  const map = new Map<string, Group>();
  for (const log of logs) {
    const group = map.get(log.localDate) ?? {
      date: log.localDate,
      rows: [],
      totalSpend: 0,
      totalSticks: 0,
    };
    group.rows.push(log);
    group.totalSpend += log.totalPriceInr ?? 0;
    group.totalSticks += log.quantity;
    map.set(log.localDate, group);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Returns a short editorial label for "today" / "yesterday", null otherwise. */
function relativeDayLabel(ymd: string, today: string, yesterday: string): string | null {
  if (ymd === today) return 'Today';
  if (ymd === yesterday) return 'Yesterday';
  return null;
}

/** Compute a date-span subtitle for the masthead, e.g. "Mar — May 2026". When
 *  the range spans a single month, collapses to "May 2026". */
function dateSpanLabel(groups: Group[]): string | null {
  if (groups.length === 0) return null;
  // Groups are sorted DESC by date — index 0 is the newest, last is the oldest.
  const newest = dayjs(groups[0]!.date);
  const oldest = dayjs(groups[groups.length - 1]!.date);
  if (newest.isSame(oldest, 'month')) {
    return newest.format('MMM YYYY');
  }
  if (newest.isSame(oldest, 'year')) {
    return `${oldest.format('MMM')} — ${newest.format('MMM YYYY')}`;
  }
  return `${oldest.format('MMM YYYY')} — ${newest.format('MMM YYYY')}`;
}

export interface HistoryClientProps {
  profile: UserProfile;
  logs: CigaretteLog[];
  brands: (Brand & { variants: BrandVariant[] })[];
  /**
   * Initial pagination cursor from the SSR fetch. Non-null means there are
   * older logs beyond the initial 200-row / 60-day window. The "Load older"
   * button uses this to drive the `fetchMoreHistoryLogs` server action; once
   * the action returns `null` for `nextCursor`, the button hides itself.
   */
  nextCursor?: LogCursor | null;
}

export function HistoryClient({
  profile,
  logs: initialLogs,
  brands,
  nextCursor: initialCursor,
}: HistoryClientProps) {
  const router = useRouter();
  const discreet = isDiscreetMode(profile);

  // F1b: keep accumulated logs + cursor in state so the "Load older" button
  // can append additional pages without a full route navigation. Initial
  // values come from the SSR-provided props so the first paint is unchanged.
  const [logs, setLogs] = React.useState<CigaretteLog[]>(initialLogs);
  const [cursor, setCursor] = React.useState<LogCursor | null>(initialCursor ?? null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Edit/delete modals
  const [editingLog, setEditingLog] = React.useState<CigaretteLog | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CigaretteLog | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    const logId = deleteTarget.id;
    setDeleteTarget(null);
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLog(logId);
      await revalidateAppViews();
      router.refresh();
    } catch (err) {
      setDeleteError(toSafeErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const groups = React.useMemo(() => groupLogs(logs), [logs]);

  const today = React.useMemo(() => todayIst(), []);
  const yesterday = React.useMemo(() => daysAgoIst(1), []);
  const spanLabel = React.useMemo(() => dateSpanLabel(groups), [groups]);

  const handleLoadMore = React.useCallback(() => {
    if (!cursor || isPending) return;
    const requestedCursor = cursor;
    setLoadError(null);
    startTransition(async () => {
      try {
        const result = await fetchMoreHistoryLogs(requestedCursor);
        setLogs((prev) => [...prev, ...result.logs]);
        setCursor(result.nextCursor);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load older entries.');
      }
    });
  }, [cursor, isPending]);

  // Editorial-stage index helper: drives the stagger reveal via --ed-index.
  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  // Index allocation:
  //   0 = masthead
  //   1..N = day groups (one per day, in order)
  //   N+1 = trailing affordance (load-more OR end-mark)
  const trailingIndex = groups.length + 1;

  return (
    <div className="relative mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-32 md:pt-xxl md:px-xxl">
      {/* Atmospheric paper noise — purely decorative, behind everything. */}
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col section-gap">
        {/* ─────────────── Masthead ─────────────── */}
        <header style={idx(0)} className="flex flex-col group-tight">
          <div className="flex items-center gap-md">
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={idx(0)}
            />
            <span className="editorial-caption nums-tabular">
              {spanLabel ? `History · ${spanLabel}` : 'History'}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={idx(0)}
            />
          </div>
          <p className="text-small text-text-muted text-center italic">
            The printed ledger
          </p>
        </header>

        {groups.length === 0 ? (
          /* ─────────────── Empty state — a quiet invitation ─────────────── */
          <section style={idx(1)} className="rule-hair pt-lg flex flex-col subsection-gap">
            <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">
              No entries yet.
            </p>
            <p className="text-body text-text-muted max-w-[40ch]">
              The first log opens the ledger. From there it remembers every
              cigarette, every rupee, and the days you skipped.
            </p>
            <button
              type="button"
              onClick={() => router.push('/log/new')}
              className="self-start mt-sm inline-flex items-center min-h-[44px] px-lg rounded-md bg-text text-bg font-medium text-body hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Log your first
            </button>
          </section>
        ) : (
          <>
            {/* ─────────────── Day groups — typographic ledger ─────────────── */}
            {groups.map((group, gi) => {
              const relLabel = relativeDayLabel(group.date, today, yesterday);
              const sortedRows = [...group.rows].sort((a, b) =>
                b.tsUtc.localeCompare(a.tsUtc),
              );
              return (
                <section
                  key={group.date}
                  style={idx(gi + 1)}
                  aria-labelledby={`day-${group.date}`}
                  className="flex flex-col"
                >
                  {/* Day header — date + spend + sticks numeral, no Card. */}
                  <div className="rule-hair-strong grid grid-cols-[1fr_auto] items-end gap-md pt-md pb-sm">
                    <div className="flex flex-col gap-xs">
                      {relLabel ? (
                        <span
                          className="editorial-headline italic text-text"
                          style={{ fontSize: 'clamp(1rem,1.6vw,1.125rem)', lineHeight: 1 }}
                        >
                          {relLabel}
                        </span>
                      ) : null}
                      <h2
                        id={`day-${group.date}`}
                        className="editorial-caption nums-tabular"
                      >
                        {formatIndianDate(group.date)}
                      </h2>
                      <span className="text-small text-text-muted nums-tabular">
                        {maskInr(group.totalSpend, discreet, (n) => formatInr(n))}
                        <span className="text-text-faint"> spent</span>
                      </span>
                    </div>
                    <div
                      className="editorial-numeral--small nums-tabular text-right"
                      aria-label={
                        discreet
                          ? 'Day total hidden'
                          : `${group.totalSticks} ${group.totalSticks === 1 ? 'cigarette' : 'cigarettes'} on this day`
                      }
                    >
                      {discreet ? '••' : group.totalSticks}
                      <span className="text-small text-text-faint font-sans ml-xs">
                        {group.totalSticks === 1 ? 'stick' : 'sticks'}
                      </span>
                    </div>
                  </div>

                  {/* Entries — hairline rows, no nested chrome. */}
                  <dl className="flex flex-col">
                    {sortedRows.map((log) => {
                      const brand = maskBrandName(
                        log.brandNameSnap ?? 'Unbranded',
                        discreet,
                      );
                      const qtyText = discreet
                        ? '•••'
                        : `${log.quantity} stick${log.quantity > 1 ? 's' : ''}`;
                      return (
                        <div
                          key={log.id}
                          className="rule-hair grid grid-cols-[1fr_auto_auto] items-baseline gap-md py-md"
                        >
                          <div className="min-w-0 flex flex-col">
                            <dt className="text-body text-text truncate">
                              {brand}
                              {log.variantSnap && !discreet ? (
                                <span className="text-text-muted">
                                  {' · '}
                                  {log.variantSnap}
                                </span>
                              ) : null}
                            </dt>
                            <dd className="text-small text-text-muted nums-tabular">
                              <span className="nums-tabular">{formatTime(log.tsUtc)}</span>
                              <span className="text-text-faint"> · </span>
                              <span>{qtyText}</span>
                            </dd>
                          </div>
                          <dd className="text-body text-text nums-tabular text-right flex flex-col items-end">
                            <span>{maskInr(log.totalPriceInr, discreet, (n) => formatInr(n))}</span>
                            {log.unitPriceInr != null ? (
                              <span className="text-caption text-text-faint">
                                {maskInr(log.unitPriceInr, discreet, (n) => formatPerStick(n))}
                              </span>
                            ) : null}
                          </dd>
                          <button
                            type="button"
                            aria-label={`Edit ${brand}`}
                            onClick={() => setEditingLog(log)}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-text-muted hover:bg-bg hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent -mr-sm"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}

            {/* ─────────────── Trailing affordance — load more OR end-mark ───── */}
            <footer
              style={idx(trailingIndex)}
              className="rule-hair pt-md flex flex-col items-center gap-sm"
            >
              {loadError ? (
                <p
                  role="alert"
                  className="text-small text-center"
                  style={{ color: 'var(--warn-earth)' }}
                >
                  {loadError}
                </p>
              ) : null}

              {cursor !== null ? (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isPending}
                  aria-busy={isPending}
                  className="text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ textDecorationColor: 'var(--rule-strong)' }}
                >
                  {isPending ? 'Loading older entries…' : 'Load older entries →'}
                </button>
              ) : (
                <span className="text-caption text-text-faint italic">
                  End of the ledger.
                </span>
              )}
            </footer>
          </>
        )}
      </div>

      {/* ─────────────── Persistent "New log" action ───────────────
          The one explicit call-to-action on this page. Reshaped from the
          accent-teal pill to the dark inverse used on the Dashboard empty
          state — it stays distinct without breaking the editorial register. */}
      <div className="fixed right-lg bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-lg z-10">
        <Link
          href="/log/new"
          className="inline-flex items-center min-h-[44px] px-lg rounded-md bg-text text-bg font-medium text-body shadow-lg hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          New log
        </Link>
      </div>

      {/* ─────────────── Edit modal ─────────────────────────────────── */}
      <LogEditModal
        open={editingLog !== null}
        log={editingLog}
        brands={brands}
        onOpenChange={(open) => {
          if (!open) setEditingLog(null);
        }}
        onSaved={() => {
          setEditingLog(null);
        }}
        onDelete={(log) => {
          setDeleteTarget(log);
        }}
      />

      {/* ─────────────── Delete confirmation ──────────────────────────── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete "${deleteTarget.brandNameSnap ?? 'entry'}"?` : 'Delete entry?'}
        description="This entry will be removed from your history. You can't undo this."
        confirmLabel="Delete entry"
        destructive
        loading={isDeleting}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />

      {/* Show delete error if any */}
      {deleteError && (
        <div className="fixed bottom-8 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 p-md bg-bg border border-[var(--warn-earth)] rounded-md shadow-lg">
          <p className="text-small text-[var(--warn-earth)]">{deleteError}</p>
        </div>
      )}
    </div>
  );
}
