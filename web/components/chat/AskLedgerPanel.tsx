'use client';

/*
 * Ask the ledger — a slide-over page of the journal, not a chat bubble.
 *
 * Right sheet on desktop, bottom sheet on mobile (Radix Dialog: focus trap,
 * Escape, scroll lock, focus return). Starters open the panel; each turn prints
 * the question in italic display type, the figures as hairline MetricRows, and
 * the model's narration as plain paragraphs. Figures are masked at the render
 * site when totals are hidden, tap to reveal, exactly as on Home. Consent is
 * asked the first time an answer would leave the app, inside the panel, and
 * the one tap saves it and sends the pending question.
 */

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnalyticsEvents } from '@/constants/events';
import { setSetting } from '@/db/repositories/settings';
import type { Starter } from '@/domain/ledgerChat/starters';
import {
  CHAT_HISTORY_MAX_TURNS,
  CHAT_HISTORY_TEXT_MAX,
  CHAT_QUESTION_MAX,
  type ChatErrorCode,
  type ChatHistoryTurn,
  type ChatResponse,
  type Row,
} from '@/domain/ledgerChat/types';
import { isHomeTotalsHidden, maskCount, maskInr, maskNumbers } from '@/lib/discreet';
import { formatMoney } from '@/lib/format';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { localeForCountry } from '@/lib/regions';
import { track } from '@/services/analytics';
import { recordAuditEvent } from '@/services/audit';
import type { UserProfile } from '@/types';
import { INPUT_STYLE } from '@web/lib/auth/inputStyle';
import { sessionUserId } from '@web/lib/goals/sessionUserId';
import { getSupabase } from '@web/lib/supabase/client';
import { Button } from '@web/components/ui/Button';
import { InlineRule, MetricRow, SectionLabel } from '@web/components/visual';
import { LEDGER_CHAT_NOTICE } from '@web/components/chat/notice';
import {
  loadTranscript,
  saveTranscript,
  type TranscriptTurn,
} from '@web/components/chat/transcriptStore';

export interface AskLedgerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  starters: Starter[];
}

type Status = 'idle' | 'loading' | 'consent' | 'rate_limited' | 'disabled' | 'error';

interface Pending {
  question: string;
  starter: boolean;
}

const COPY = {
  description:
    "Answers are written by an AI model from your ledger's own figures. Your conversation is kept only on this device.",
  empty: 'Log a few days first; then ask how your week compares.',
  loading: 'Reading the ledger…',
  rateLimited: "You've reached today's limit. The ledger is still here tomorrow.",
  disabled: 'Ask the ledger is resting for now.',
  error: "The ledger couldn't be read just now. The charts behind this panel still can.",
  footnote: 'Not medical advice. A daily limit applies.',
} as const;

const LINK_BUTTON =
  'inline-flex min-h-11 items-center text-left underline underline-offset-4 decoration-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:cursor-not-allowed';

/** The last few exchanges, as alternating turns the route accepts. */
function historyFor(turns: readonly TranscriptTurn[]): ChatHistoryTurn[] {
  const recent = turns.slice(-Math.floor(CHAT_HISTORY_MAX_TURNS / 2));
  return recent.flatMap((t): ChatHistoryTurn[] => [
    { role: 'user', text: t.question.slice(0, CHAT_HISTORY_TEXT_MAX) },
    { role: 'assistant', text: t.answer.slice(0, CHAT_HISTORY_TEXT_MAX) },
  ]);
}

/** Same helpers Home uses, so the mask glyph and rules stay in one place. */
function rowDisplay(row: Row, masked: boolean, money: (n: number) => string): string {
  if (row.unit === 'money') return typeof row.value === 'number' ? maskInr(row.value, masked, money) : String(row.value);
  if (row.unit === 'sticks') return maskCount(row.value, masked);
  if (row.unit === 'percent') return `${row.value}%`;
  return String(row.value);
}

export function AskLedgerPanel({ open, onOpenChange, profile, starters }: AskLedgerPanelProps) {
  const inputId = React.useId();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [status, setStatus] = React.useState<Status>('idle');
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [draft, setDraft] = React.useState('');
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(() => new Set());

  const hidden = isHomeTotalsHidden(profile);
  const money = React.useCallback(
    (value: number) => formatMoney(value, profile.currency, { locale: localeForCountry(profile.country) }),
    [profile.currency, profile.country],
  );
  const busy = status === 'loading';

  // The transcript key needs the user id, which the profile does not carry.
  // getSession() reads the local session; no network round-trip.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void sessionUserId(() => getSupabase().auth.getSession()).then((id) => {
      if (cancelled) return;
      setUserId(id);
      setTurns(id ? loadTranscript(id) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const send = React.useCallback(
    async (question: string, starter: boolean) => {
      const q = question.trim();
      if (!q) return;
      setPending({ question: q, starter });
      setStatus('loading');
      try {
        const res = await fetch('/api/ledger-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, history: historyFor(turns) }),
        });
        if (res.ok) {
          const body = (await res.json()) as ChatResponse;
          const turn: TranscriptTurn = {
            id: `${Date.now().toString(36)}-${turns.length}`,
            question: q,
            answer: body.answer,
            rows: body.rows,
            at: new Date().toISOString(),
          };
          const next = [...turns, turn];
          setTurns(userId ? saveTranscript(userId, next) : next);
          setPending(null);
          setDraft('');
          setStatus('idle');
          void track(AnalyticsEvents.LEDGER_CHAT_ASKED, { starter, tools: body.toolsUsed.length });
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: ChatErrorCode } | null;
        if (res.status === 403 && body?.error === 'consent_required') {
          setStatus('consent');
          return;
        }
        setPending(null);
        if (res.status === 429) setStatus('rate_limited');
        else if (res.status === 503) setStatus('disabled');
        else setStatus('error');
      } catch {
        setPending(null);
        setStatus('error');
      }
    },
    [turns, userId],
  );

  const onTurnOnAndAsk = async () => {
    if (!pending) return;
    setStatus('loading');
    try {
      await setSetting('consent.ledgerChatOptIn', true);
    } catch {
      setStatus('error');
      setPending(null);
      return;
    }
    try {
      await recordAuditEvent('ledger_chat_consent_toggled', 'privacy', {
        enabled: true,
        privacyVersion: LEGAL_VERSIONS.privacy,
      });
    } catch {
      // Consent is already saved. The audit row is best-effort here: the edge
      // allowlist may lag a deploy, and that must never block the answer.
    }
    await send(pending.question, pending.starter);
  };

  const onNotNow = () => {
    setPending(null);
    setStatus('idle');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(draft, false);
  };

  const reveal = (key: string) => setRevealed((prev) => new Set(prev).add(key));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content className="ask-sheet fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col rounded-t-lg border-t border-border bg-card shadow-xl md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[min(100vw,28rem)] md:rounded-none md:border-l md:border-t-0">
          <header className="flex shrink-0 items-start justify-between gap-md px-lg pt-lg">
            <div className="flex min-w-0 flex-col gap-xs">
              <Dialog.Title asChild>
                <h2 className="editorial-headline text-[clamp(1.25rem,2.4vw,1.5rem)] text-text">Ask the ledger</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="max-w-[40ch] text-small text-text-muted">{COPY.description}</p>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5 text-text-muted" />
              </button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-lg pb-md">
            {starters.length > 0 ? (
              <section className="rule-hair-strong mt-lg flex flex-col gap-xs pt-md">
                <SectionLabel spacing="none">To begin</SectionLabel>
                <ul className="flex flex-col">
                  {starters.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void send(s.text, true)}
                        className={`${LINK_BUTTON} text-body text-text hover:text-text-muted`}
                        style={{ textDecorationColor: 'var(--rule-strong)' }}
                      >
                        {s.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="rule-hair-strong mt-lg pt-md text-small text-text-muted">{COPY.empty}</p>
            )}

            {turns.map((turn) => {
              // The narration is a render site too: a verified figure the model
              // repeats is masked exactly like the row beside it, tap to reveal.
              const proseKey = `${turn.id}:answer`;
              const proseMasked = hidden && !revealed.has(proseKey);
              const paragraphs = turn.answer.split(/\n+/).map((paragraph, i) => (
                <p key={i} className="text-body text-text">
                  {maskNumbers(paragraph, proseMasked)}
                </p>
              ));
              return (
              <article key={turn.id} className="rule-hair mt-md flex flex-col gap-sm pt-md">
                <p className="editorial-pullquote text-[clamp(1rem,2vw,1.125rem)] text-text">{turn.question}</p>
                {turn.rows.length > 0 ? (
                  <dl className="flex flex-col">
                    {turn.rows.map((row, i) => {
                      const key = `${turn.id}:${row.id}`;
                      const maskable = row.unit === 'money' || row.unit === 'sticks';
                      const masked = hidden && maskable && !revealed.has(key);
                      const display = rowDisplay(row, masked, money);
                      return (
                        <MetricRow
                          key={row.id}
                          variant={i === 0 ? 'first' : 'default'}
                          label={row.label}
                          value={display}
                          tone={row.tone}
                          ariaLabel={masked ? `${row.label} hidden, tap to reveal` : `${row.label} ${display}`}
                          onClick={masked ? () => reveal(key) : undefined}
                        />
                      );
                    })}
                  </dl>
                ) : null}
                {proseMasked ? (
                  <button
                    type="button"
                    onClick={() => reveal(proseKey)}
                    aria-label="Answer with figures hidden, tap to reveal"
                    className="flex flex-col gap-sm rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {paragraphs}
                  </button>
                ) : (
                  paragraphs
                )}
              </article>
              );
            })}

            <div aria-live="polite" className="flex flex-col gap-sm">
              {pending && status !== 'idle' ? (
                <p className="editorial-pullquote mt-md text-[clamp(1rem,2vw,1.125rem)] text-text">{pending.question}</p>
              ) : null}
              {status === 'loading' ? (
                <div className="flex flex-col gap-sm" role="status">
                  <InlineRule animate="draw" />
                  <p className="text-caption italic text-text-faint">{COPY.loading}</p>
                </div>
              ) : null}
              {status === 'consent' ? (
                <section className="rule-hair-strong flex flex-col gap-sm pt-md">
                  <SectionLabel spacing="none">Before the first answer</SectionLabel>
                  <p className="text-body text-text">{LEDGER_CHAT_NOTICE.lead}</p>
                  <p className="max-w-[52ch] text-small text-text-muted">{LEDGER_CHAT_NOTICE.sent}</p>
                  <p className="max-w-[52ch] text-small text-text-muted">{LEDGER_CHAT_NOTICE.discreet}</p>
                  <p className="max-w-[52ch] text-small text-text-muted">{LEDGER_CHAT_NOTICE.retention}</p>
                  <p className="max-w-[52ch] text-small text-text-muted">
                    {LEDGER_CHAT_NOTICE.device}{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-1 underline-offset-4 text-text hover:text-text-muted"
                      style={{ textDecorationColor: 'var(--rule-strong)' }}
                    >
                      Privacy policy
                    </a>
                  </p>
                  <div className="flex flex-wrap gap-md pt-xs">
                    <Button title="Turn on and ask" onPress={() => void onTurnOnAndAsk()} />
                    <Button title="Not now" variant="ghost" onPress={onNotNow} />
                  </div>
                </section>
              ) : null}
              {status === 'rate_limited' ? <p className="text-small text-text-muted">{COPY.rateLimited}</p> : null}
              {status === 'disabled' ? <p className="text-small text-text-muted">{COPY.disabled}</p> : null}
              {status === 'error' ? <p className="text-small text-text-muted">{COPY.error}</p> : null}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex shrink-0 flex-col gap-sm border-t border-border px-lg pb-[calc(1rem+env(safe-area-inset-bottom))] pt-md"
          >
            <div className="flex items-end gap-md">
              <label htmlFor={inputId} className="sr-only">
                Ask your ledger
              </label>
              <input
                id={inputId}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask your ledger…"
                maxLength={CHAT_QUESTION_MAX}
                autoComplete="off"
                enterKeyHint="send"
                disabled={busy}
                style={INPUT_STYLE}
                className="min-w-0 flex-1 placeholder:text-text-faint focus:border-b-[var(--rule-strong)]"
              />
              <Button type="submit" title="Ask" size="sm" variant="ghost" disabled={busy || draft.trim().length === 0} />
            </div>
            <p className="text-caption italic text-text-faint">{COPY.footnote}</p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
