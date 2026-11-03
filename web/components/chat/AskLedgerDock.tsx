'use client';

/*
 * Ask the ledger, on every reading page: a docked text box bottom-right on
 * desktop, an "Ask" pill above the bottom nav on phones. Either opens the
 * panel; the box opens it with its question. Both fold away to a small tab,
 * remembered on this device. Mounted once in the (app) layout, which passes
 * only the server flag; the panel loads on first open and re-reads its state on every open.
 *
 * Stacking: z-40 sits above the page veil (z-1) and under the bottom nav
 * (z-50), dialogs (z-50+, portalled) and the skip link (z-60). The pill rides
 * above the nav's height plus the safe-area inset, so it never covers a nav
 * target. A server-rendered [data-ask-dock] marker turns on --ask-dock-clear
 * (globals.css), which pads the page and lifts other fixed controls clear.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { MessageSquareText, Minus } from 'lucide-react';
import { AnalyticsEvents } from '@/constants/events';
import { CHAT_QUESTION_MAX } from '@/domain/ledgerChat/types';
import { track } from '@/services/analytics';
import { INPUT_STYLE } from '@web/lib/auth/inputStyle';
import { cn } from '@web/components/ui/cn';

// The panel (Radix dialog, settings and audit calls) loads on first open only.
const AskLedgerPanel = dynamic(
  () => import('@web/components/chat/AskLedgerPanel').then((m) => m.AskLedgerPanel),
  { ssr: false },
);

export const DOCK_MINIMISED_KEY = 'sl_chat_dock_minimised';

type Surface = 'dock' | 'pill';

/** Log is for writing an entry, not reading the ledger: no dock there or below it. */
export function isDockHidden(pathname: string): boolean {
  return pathname === '/log' || pathname.startsWith('/log/');
}

/** The route group a page belongs to ("dashboard", "history"…), for analytics. */
export function dockPage(pathname: string): string {
  return pathname.split('/')[1] || 'unknown';
}

export function readDockMinimised(store: Storage | null): boolean {
  try {
    return store?.getItem(DOCK_MINIMISED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeDockMinimised(store: Storage | null, minimised: boolean): void {
  try {
    if (minimised) store?.setItem(DOCK_MINIMISED_KEY, '1');
    else store?.removeItem(DOCK_MINIMISED_KEY);
  } catch {
    // A preference that cannot be saved just lasts for this visit.
  }
}

function deviceStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

/** Phone: above the 4rem nav (3rem in short landscape) and the safe area. Desktop: the corner. */
const POSITION =
  'fixed right-lg z-40 bottom-[calc(4rem+env(safe-area-inset-bottom)+theme(spacing.md))] short-landscape:bottom-[calc(3rem+env(safe-area-inset-bottom)+theme(spacing.md))] md:bottom-lg md:short-landscape:bottom-lg';

export interface AskLedgerDockProps {
  /** Server flag: the feature is off until the operator turns it on. */
  enabled: boolean;
}

export function AskLedgerDock({ enabled }: AskLedgerDockProps) {
  const pathname = usePathname() ?? '';
  const [minimised, setMinimised] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState<string | undefined>(undefined);
  const [panelLoaded, setPanelLoaded] = React.useState(false);
  // The controls wait for the stored minimise choice, so a folded dock never
  // flashes open on load; the dock rises in after hydration either way.
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMinimised(readDockMinimised(deviceStorage()));
    setMounted(true);
  }, []);

  if (!enabled || isDockHidden(pathname)) return null;

  const onAsk = (surface: Surface, q?: string) => {
    setQuestion(q);
    setPanelLoaded(true);
    setOpen(true);
    void track(AnalyticsEvents.LEDGER_CHAT_OPENED, { surface, page: dockPage(pathname) });
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuestion(undefined);
  };

  const onMinimise = (value: boolean) => {
    setMinimised(value);
    writeDockMinimised(deviceStorage(), value);
  };

  return (
    <>
      <span data-ask-dock hidden />
      {mounted ? <DockControls minimised={minimised} onMinimise={onMinimise} onAsk={onAsk} /> : null}
      {panelLoaded ? <AskLedgerPanel open={open} onOpenChange={onOpenChange} initialQuestion={question} /> : null}
    </>
  );
}

export interface DockControlsProps {
  minimised: boolean;
  onMinimise: (minimised: boolean) => void;
  onAsk: (surface: Surface, question?: string) => void;
}

/** The visible dock: the desktop box and phone pill, or the folded tab. */
export function DockControls({ minimised, onMinimise, onAsk }: DockControlsProps) {
  const inputId = React.useId();
  const [text, setText] = React.useState('');

  if (minimised) {
    return (
      <button
        type="button"
        onClick={() => onMinimise(false)}
        aria-label="Show Ask the ledger"
        className={cn(
          POSITION,
          'ask-dock inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-card text-text-muted shadow-sm transition-colors hover:text-text',
          FOCUS_RING,
        )}
      >
        <MessageSquareText className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    setText('');
    onAsk('dock', q || undefined);
  };

  const minimiseButton = (
    <button
      type="button"
      onClick={() => onMinimise(true)}
      aria-label="Minimise Ask the ledger"
      className={cn(
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text',
        FOCUS_RING,
      )}
    >
      <Minus className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={cn(
          POSITION,
          'ask-dock hidden w-[22rem] items-end gap-sm rounded-md border border-border bg-card py-xs pl-md pr-xs shadow-lg md:flex',
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask the ledger
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setText('');
          }}
          placeholder="Ask the ledger…"
          maxLength={CHAT_QUESTION_MAX}
          autoComplete="off"
          enterKeyHint="send"
          style={INPUT_STYLE}
          // Focus: the global input:focus-visible rule (globals.css) draws a 2px
          // accent outline with !important, over INPUT_STYLE's inline outline:none.
          className="min-w-0 flex-1 placeholder:text-text-faint"
        />
        <button
          type="submit"
          className={cn(
            'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-sm text-small font-medium text-text-muted transition-colors hover:text-text',
            FOCUS_RING,
          )}
        >
          Ask
        </button>
        {minimiseButton}
      </form>
      <div className={cn(POSITION, 'ask-dock flex items-center gap-xs md:hidden')}>
        {minimiseButton}
        <button
          type="button"
          onClick={() => onAsk('pill')}
          className={cn(
            'inline-flex min-h-11 items-center rounded-full border border-border bg-card px-xl text-small font-medium text-text shadow-lg transition-colors hover:bg-bg md:hidden',
            FOCUS_RING,
          )}
        >
          Ask
        </button>
      </div>
    </>
  );
}
