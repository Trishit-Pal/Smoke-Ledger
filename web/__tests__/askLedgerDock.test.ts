import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ path: '/dashboard' }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.path }));
// The panel is a lazy client chunk; a static render never reaches it.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/services/analytics', () => ({ track: vi.fn() }));

(globalThis as { React?: typeof React }).React = React;

const { AskLedgerDock, DOCK_MINIMISED_KEY, dockPage, isDockHidden, readDockMinimised, writeDockMinimised } =
  await import('@web/components/chat/AskLedgerDock');

const web = join(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(web, ...parts), 'utf8');
const dock = read('components', 'chat', 'AskLedgerDock.tsx');
const layout = read('app', '(app)', 'layout.tsx');

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const render = (enabled: boolean) => renderToStaticMarkup(React.createElement(AskLedgerDock, { enabled }));

beforeEach(() => {
  mocks.path = '/dashboard';
});

describe('where the dock shows', () => {
  test('hidden on /log and anything under it, shown on the reading pages', () => {
    expect(isDockHidden('/log')).toBe(true);
    expect(isDockHidden('/log/edit/abc')).toBe(true);
    for (const p of ['/dashboard', '/trends', '/history', '/goals', '/settings']) expect(isDockHidden(p)).toBe(false);
    // A page that merely starts with the letters is not Log.
    expect(isDockHidden('/logbook')).toBe(false);
  });

  test('names the page by its route group for analytics', () => {
    expect(dockPage('/dashboard')).toBe('dashboard');
    expect(dockPage('/history/2026-11-01')).toBe('history');
    expect(dockPage('')).toBe('unknown');
  });

  test('renders nothing while the feature is off, or on Log', () => {
    expect(render(false)).toBe('');
    mocks.path = '/log';
    expect(render(true)).toBe('');
  });

  test('desktop box is a labelled form; phone shows an Ask pill instead', () => {
    const html = render(true);
    expect(html).toContain('<form');
    expect(html).toMatch(/<label[^>]*class="sr-only"[^>]*>Ask the ledger<\/label>/);
    expect(html).toContain('placeholder="Ask the ledger…"');
    expect(html).toMatch(/<form[^>]*class="[^"]*hidden[^"]*md:flex/);
    expect(html).toMatch(/<button[^>]*class="[^"]*md:hidden[^"]*"[^>]*>Ask<\/button>/);
  });
});

describe('minimise, remembered per device', () => {
  test('round-trips through its own localStorage key', () => {
    const store = fakeStorage();
    expect(DOCK_MINIMISED_KEY).toBe('sl_chat_dock_minimised');
    expect(readDockMinimised(store)).toBe(false);
    writeDockMinimised(store, true);
    expect(store.getItem(DOCK_MINIMISED_KEY)).toBe('1');
    expect(readDockMinimised(store)).toBe(true);
    writeDockMinimised(store, false);
    expect(store.getItem(DOCK_MINIMISED_KEY)).toBeNull();
  });

  test('a missing or throwing storage reads as not minimised and never throws', () => {
    expect(readDockMinimised(null)).toBe(false);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readDockMinimised(broken as unknown as Storage)).toBe(false);
    expect(() => writeDockMinimised(broken as unknown as Storage, true)).not.toThrow();
  });
});

describe('dock source pins', () => {
  test('the (app) layout mounts it once with the server flag only', () => {
    expect(layout.match(/<AskLedgerDock /g)?.length).toBe(1);
    expect(layout).toContain('<AskLedgerDock enabled={isLedgerChatEnabled()} />');
  });

  test('opened is tracked through the opt-in wrapper with surface and page, never the question', () => {
    expect(dock).toContain("from '@/services/analytics'");
    expect(dock).toMatch(/track\(AnalyticsEvents\.LEDGER_CHAT_OPENED, \{ surface, page: dockPage\(pathname\) \}\)/);
  });

  test('sits under dialogs (z-60) and the bottom nav (z-50), above the page veil', () => {
    expect(dock).toMatch(/const POSITION =\s*'fixed right-lg z-40 /);
    // No class string (quoted) lifts it to the nav's or the dialogs' layer.
    expect(dock).not.toMatch(/'[^'\n]*\bz-(50|\[6)/);
    // The pill clears the nav's height and the safe-area inset.
    expect(dock).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom)+theme(spacing.md))]');
    expect(dock).toContain('short-landscape:bottom-[calc(3rem+env(safe-area-inset-bottom)+theme(spacing.md))]');
  });

  test('Escape in the box clears it, and every control has a focus-visible ring', () => {
    expect(dock).toMatch(/e\.key === 'Escape'/);
    expect(dock).toMatch(/const FOCUS_RING =\s*'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/);
    // Minimise, restore tab, Ask submit, Ask pill.
    expect(dock.match(/FOCUS_RING,/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  test('the old page launcher and its page props are gone', () => {
    for (const parts of [
      ['app', '(app)', 'dashboard', 'DashboardClient.tsx'],
      ['app', '(app)', 'trends', 'TrendsClient.tsx'],
      ['app', '(app)', 'dashboard', 'page.tsx'],
      ['app', '(app)', 'trends', 'page.tsx'],
      ['lib', 'server', 'data.ts'],
    ]) {
      const src = read(...parts);
      expect(src).not.toContain('AskLedgerLauncher');
      expect(src).not.toContain('ledgerChatEnabled');
    }
  });
});
