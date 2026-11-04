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
 *
 * The panel reads its own state (opt-in, masking, currency, starters) from
 * GET /api/ledger-chat on every open, so the dock needs no page data. An
 * initial question from the dock is sent once per open when the reader has
 * opted in, and waits behind the consent notice when they have not.
 */

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnalyticsEvents } from '@/constants/events';
import { setSetting } from '@/db/repositories/settings';
import {
  CHAT_HISTORY_MAX_TURNS,
  CHAT_HISTORY_TEXT_MAX,
  CHAT_QUESTION_MAX,
  type ChatErrorCode,
  type ChatHistoryTurn,
  type ChatResponse,
  type ChatStateResponse,
  type Row,
} from '@/domain/ledgerChat/types';
import { maskCount, maskInr, maskNumbers, spokenMask } from '@/lib/discreet';
import { formatMoney } from '@/lib/format';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { track } from '@/services/analytics';
import { recordAuditEvent } from '@/services/audit';
import { INPUT_STYLE } from '@web/lib/auth/inputStyle';
import { sessionUserId } from '@web/lib/goals/sessionUserId';
import { getSupabase } from '@web/lib/supabase/client';
import { Button } from '@web/components/ui/Button';
import { InlineRule, MetricRow, SectionLabel } from '@web/components/visual';
import { LEDGER_CHAT_NOTICE, LEDGER_CHAT_NOTICE_VERSION, chatOptInValue } from '@web/components/chat/notice';
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
  transcriptClearCount,
  type TranscriptTurn,
} from '@web/components/chat/transcriptStore';

export interface AskLedgerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A question typed into the dock: pre-filled, and sent once per open when opted in. */
  initialQuestion?: string;
  /** Where focus goes on close. The dock owns the controls that opened the panel; Radix has no Trigger to return to. */
  returnFocus?: () => void;
}

type Status = 'idle' | 'loading' | 'consent' | 'outdated' | 'rate_limited' | 'disabled' | 'error';

/** Statuses a fresh clean GET proves out of date. Never 'loading': that is an answer in flight. */
const STALE_ON_CLEAN_GET: ReadonlySet<Status> = new Set(['disabled', 'outdated', 'error']);

interface Pending {
  question: string;
  starter: boolean;
}

const COPY = {
  description:
    "Answers are written by an AI model from your ledger's own figures. Your conversation is kept only on this device.",
  empty: 'Log a few days first; then ask how your week compares.',
  // Before opt-in the panel knows nothing of the ledger, so it claims nothing about it.
  invite: 'Ask about your week, your spend or your goals.',
  loading: 'Reading the ledger…',
  rateLimited: "You've reached today's limit. The ledger is still here tomorrow.",
  disabled: 'Ask the ledger is resting for now.',
  outdated: 'Your agreements changed. Review them to keep asking.',
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

/** One mapping from a refusal to what the panel says, for GET and POST alike. */
function statusFor(httpStatus: number, error: ChatErrorCode | undefined): Status {
  if (httpStatus === 403 && error === 'consent_required') return 'consent';
  if (httpStatus === 403 && error === 'consent_outdated') return 'outdated';
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus === 503) return 'disabled';
  return 'error';
}

interface LoadedState {
  state: ChatStateResponse | null;
  /** Only refusals that also stop a question: the feature resting, or agreements out of date. */
  blocked: Status | null;
}

/** Never throws: an unreadable state leaves the panel usable, masked, and asking the server. */
async function loadChatState(): Promise<LoadedState> {
  try {
    const res = await fetch('/api/ledger-chat', { method: 'GET' });
    if (res.ok) return { state: (await res.json()) as ChatStateResponse, blocked: null };
    const body = (await res.json().catch(() => null)) as { error?: ChatErrorCode } | null;
    const status = statusFor(res.status, body?.error);
    return { state: null, blocked: status === 'disabled' || status === 'outdated' ? status : null };
  } catch {
    return { state: null, blocked: null };
  }
}

/** Same helpers Home uses, so the mask glyph and rules stay in one place. */
function rowDisplay(row: Row, masked: boolean, money: (n: number) => string): string {
  if (row.unit === 'money') return typeof row.value === 'number' ? maskInr(row.value, masked, money) : String(row.value);
  if (row.unit === 'sticks') return maskCount(row.value, masked);
  if (row.unit === 'percent') return `${row.value}%`;
  return String(row.value);
}

export function AskLedgerPanel({ open, onOpenChange, initialQuestion, returnFocus }: AskLedgerPanelProps) {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // The newest answer that arrived while the panel was open: the one the live region announces.
  const [announcedId, setAnnouncedId] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [turns, setTurnsState] = React.useState<TranscriptTurn[]>([]);
  // send() awaits the network; it must append to the turns as they are when the
  // answer lands, not as they were when it started, or a Clear in between is undone.
  const turnsRef = React.useRef<TranscriptTurn[]>([]);
  const setTurns = React.useCallback((next: TranscriptTurn[]) => {
    turnsRef.current = next;
    setTurnsState(next);
  }, []);
  const [status, setStatus] = React.useState<Status>('idle');
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [draft, setDraft] = React.useState('');
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(() => new Set());

  const [state, setState] = React.useState<ChatStateResponse | null>(null);
  // Set once the session and the GET state have both landed for this open.
  const [ready, setReady] = React.useState(false);
  // This open's GET, shared by a StrictMode re-run so the state cap is spent once per open.
  // Cleared on close, never in the effect cleanup, or the re-run would fetch twice.
  const stateLoadRef = React.useRef<Promise<LoadedState> | null>(null);
  const consumedRef = React.useRef(false);
  // Bumped on every close, so a consent-then-send that was started in an earlier open stops there.
  const openEpochRef = React.useRef(0);

  // Until the state is read, figures stay masked: the safe default.
  const hidden = state ? state.hideTotals : true;
  const starters = state?.starters ?? [];
  // ponytail: a failed GET formats a revealed figure as INR; carry currency on POST if EUR readers hit it.
  const money = React.useCallback(
    (value: number) => formatMoney(value, state?.currency ?? 'INR', { locale: state?.locale }),
    [state?.currency, state?.locale],
  );
  const busy = status === 'loading';
  const announced = turns.find((t) => t.id === announcedId);
  // Same rule as the prose on screen, so discreet mode never reads a figure aloud.
  const announcedMasked = announced ? hidden && !revealed.has(`${announced.id}:answer`) : true;

  // Radix would focus the first tabbable, the confirm-free Clear button once there are turns,
  // and a stray Enter would wipe the conversation. The question box is the right start.
  // A disabled box (an answer still in flight) falls back to the dialog itself.
  const onOpenFocus = (e: Event) => {
    e.preventDefault();
    const input = inputRef.current;
    (input && !input.disabled ? input : contentRef.current)?.focus({ preventScroll: true });
  };
  const onCloseFocus = (e: Event) => {
    e.preventDefault();
    returnFocus?.();
  };

  // The box and starters are disabled while an answer is in flight, which drops focus to the dialog.
  // When it ends, put focus back in the box, unless the reader has moved to another control.
  // Not on touch: it would raise the keyboard over each new answer in the short sheet.
  const wasBusyRef = React.useRef(false);
  React.useEffect(() => {
    if (wasBusyRef.current && !busy && open && !window.matchMedia('(pointer: coarse)').matches) {
      const active = document.activeElement;
      const lost =
        !active || active === document.body || active === contentRef.current || active === inputRef.current || active.closest('[data-starters]');
      if (lost) inputRef.current?.focus({ preventScroll: true });
    }
    wasBusyRef.current = busy;
  }, [busy, open]);

  // The transcript key needs the user id: getSession() reads the local session,
  // no network round-trip. The panel state is read from GET on every open: the dock
  // outlives Settings changes (Hide totals, discreet, country), so a kept copy goes stale.
  React.useEffect(() => {
    if (!open) {
      setReady(false);
      consumedRef.current = false;
      stateLoadRef.current = null;
      openEpochRef.current += 1;
      // Unknown state masks every figure, and a figure the reader revealed stays revealed only for that open.
      setState(null);
      setRevealed(new Set());
      setAnnouncedId(null);
      return;
    }
    let cancelled = false;
    stateLoadRef.current ??= loadChatState();
    void Promise.all([sessionUserId(() => getSupabase().auth.getSession()), stateLoadRef.current]).then(([id, loaded]) => {
      if (cancelled) return;
      setUserId(id);
      setTurns(id ? loadTranscript(id) : []);
      setState(loaded.state);
      // A refusal or error from an earlier open is stale once this GET is clean (the reader may have
      // just reviewed the agreements); loading and rate_limited are left alone here. A consent card
      // from an earlier open is moot once the server says consented (opted in elsewhere, e.g.
      // Settings). That is decided here, on the GET alone: the optimistic consented flag set by
      // onTurnOnAndAsk must never drop the card when the POST then answers consent_required.
      // The stale pending question stays hidden (it only shows while status is not idle) and the next send replaces it.
      setStatus((prev) => {
        if (loaded.blocked) return loaded.blocked;
        if (!loaded.state) return prev;
        if (STALE_ON_CLEAN_GET.has(prev) || (prev === 'consent' && loaded.state.consented)) return 'idle';
        return prev;
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, setTurns]);

  const send = React.useCallback(
    async (question: string, starter: boolean) => {
      const q = question.trim();
      if (!q) return;
      setPending({ question: q, starter });
      setStatus('loading');
      const clearsAtStart = transcriptClearCount();
      try {
        const res = await fetch('/api/ledger-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, history: historyFor(turnsRef.current) }),
        });
        if (res.ok) {
          const body = (await res.json()) as ChatResponse;
          // Cleared while the answer was in flight (Clear, sign-out, discreet on, chat turned off):
          // the policy says those empty the device, so the late answer is dropped, never saved.
          if (transcriptClearCount() !== clearsAtStart) {
            setTurns([]);
            setPending(null);
            setStatus('idle');
            return;
          }
          const current = turnsRef.current;
          const turn: TranscriptTurn = {
            id: `${Date.now().toString(36)}-${current.length}`,
            question: q,
            answer: body.answer,
            rows: body.rows,
            at: new Date().toISOString(),
          };
          const next = [...current, turn];
          setTurns(userId ? saveTranscript(userId, next) : next);
          setAnnouncedId(turn.id);
          setPending(null);
          setDraft('');
          setStatus('idle');
          void track(AnalyticsEvents.LEDGER_CHAT_ASKED, { starter, tools: body.toolsUsed.length });
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: ChatErrorCode } | null;
        const next = statusFor(res.status, body?.error);
        if (next !== 'consent') setPending(null);
        setStatus(next);
      } catch {
        setPending(null);
        setStatus('error');
      }
    },
    [setTurns, userId],
  );

  // The dock's question, once per open, after the session and state are read.
  React.useEffect(() => {
    if (!open || !ready || consumedRef.current) return;
    consumedRef.current = true;
    const q = initialQuestion?.trim();
    if (!q || status === 'disabled' || status === 'outdated') return;
    setDraft(q);
    // An answer still in flight: leave the question in the box, never send two at once.
    if (status === 'loading') return;
    if (state && !state.consented) {
      setPending({ question: q, starter: false });
      setStatus('consent');
      return;
    }
    void send(q, false);
  }, [open, ready, initialQuestion, state, status, send]);

  const onTurnOnAndAsk = async () => {
    if (!pending) return;
    const openLoad = stateLoadRef.current;
    const openEpoch = openEpochRef.current;
    setStatus('loading');
    try {
      // The notice version, not `true`: the consent covers only the words shown here.
      await setSetting('consent.ledgerChatOptIn', chatOptInValue(true));
    } catch {
      setStatus('error');
      setPending(null);
      return;
    }
    try {
      await recordAuditEvent('ledger_chat_consent_toggled', 'privacy', {
        enabled: true,
        privacyVersion: LEGAL_VERSIONS.privacy,
        noticeVersion: LEDGER_CHAT_NOTICE_VERSION,
      });
    } catch {
      // Consent is already saved. The audit row is best-effort here: the edge
      // allowlist may lag a deploy, and that must never block the answer.
    }
    // Closed during the consent writes: the consent is saved, but the panel is gone, so no question
    // is sent and no answer is saved; status and pending are reset. The reader asks again on the next open.
    // ponytail: resets status even if the panel was reopened meanwhile; that open re-derives it from its own GET.
    if (openEpochRef.current !== openEpoch) {
      setStatus('idle');
      setPending(null);
      return;
    }
    setState((prev) => (prev ? { ...prev, consented: true } : prev));
    await send(pending.question, pending.starter);
    // Opted in now: read the state again so the starters appear without a reload.
    const loaded = await loadChatState();
    // Closed (ref cleared) or reopened (a newer GET) in the meantime: that open's state wins.
    if (loaded.state && stateLoadRef.current === openLoad) setState(loaded.state);
  };

  const onNotNow = () => {
    setPending(null);
    setStatus('idle');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(draft, false);
  };

  // Plain and confirm-free: the only thing lost is something the reader can ask again.
  const onClear = () => {
    clearTranscript(userId ?? undefined);
    setTurns([]);
    setRevealed(new Set());
  };

  const reveal = (key: string) => setRevealed((prev) => new Set(prev).add(key));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content
          ref={contentRef}
          onOpenAutoFocus={onOpenFocus}
          onCloseAutoFocus={onCloseFocus}
          className="ask-sheet fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col rounded-t-lg border-t border-border bg-card shadow-xl md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[min(100vw,28rem)] md:rounded-none md:border-l md:border-t-0"
        >
          <header className="flex shrink-0 items-start justify-between gap-md px-lg pt-lg">
            <div className="flex min-w-0 flex-col gap-xs">
              <Dialog.Title asChild>
                <h2 className="editorial-headline text-[clamp(1.25rem,2.4vw,1.5rem)] text-text">Ask the ledger</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="max-w-[40ch] text-small text-text-muted">{COPY.description}</p>
              </Dialog.Description>
              {turns.length > 0 && !busy ? (
                <button
                  type="button"
                  onClick={onClear}
                  className={`${LINK_BUTTON} self-start text-small text-text-muted hover:text-text`}
                  style={{ textDecorationColor: 'var(--rule-strong)' }}
                >
                  Clear conversation
                </button>
              ) : null}
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
            {!ready && !state ? (
              <p className="rule-hair-strong mt-lg pt-md text-caption italic text-text-faint">{COPY.loading}</p>
            ) : starters.length > 0 ? (
              <section data-starters className="rule-hair-strong mt-lg flex flex-col gap-xs pt-md">
                <SectionLabel spacing="none">To begin</SectionLabel>
                <ul className="flex flex-col">
                  {starters.map((text) => (
                    <li key={text}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void send(text, true)}
                        className={`${LINK_BUTTON} text-body text-text hover:text-text-muted`}
                        style={{ textDecorationColor: 'var(--rule-strong)' }}
                      >
                        {text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="rule-hair-strong mt-lg pt-md text-small text-text-muted">
                {state?.consented ? COPY.empty : COPY.invite}
              </p>
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
                <p className="editorial-caption text-text-faint">Written by AI</p>
              </article>
              );
            })}

            <div aria-live="polite" className="flex flex-col gap-sm">
              {/* The transcript above is outside this region, so the newest answer is mirrored here as hidden text.
                  ponytail: a screen reader's browse mode can read it twice (here and in the transcript); aria-hide the
                  transcript's newest article if that proves noisy. */}
              {announced ? <p className="sr-only">{spokenMask(announced.answer, announcedMasked)}</p> : null}
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
                  <p className="max-w-[52ch] text-small text-text-muted">{LEDGER_CHAT_NOTICE.scope}</p>
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
              {status === 'outdated' ? (
                <p className="text-small text-text-muted">
                  {COPY.outdated}{' '}
                  <a
                    href="/consent"
                    className="underline decoration-1 underline-offset-4 text-text hover:text-text-muted"
                    style={{ textDecorationColor: 'var(--rule-strong)' }}
                  >
                    Review agreements
                  </a>
                </p>
              ) : null}
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
                ref={inputRef}
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
