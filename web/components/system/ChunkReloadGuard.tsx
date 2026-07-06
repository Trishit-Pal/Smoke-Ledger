'use client';

/*
 * ChunkReloadGuard — self-heals a stale-build (deployment-skew) session.
 *
 * When a browser keeps an old build open and a newer deployment goes live, the
 * old build's code-split chunks (and RSC / server-action requests) no longer
 * exist on the new deployment, so dynamic imports reject with ChunkLoadError /
 * "Failed to fetch dynamically imported module" and navigation silently breaks.
 * Rather than leaving the app wedged, reload ONCE to pull the fresh build.
 *
 * Loop guard: reload attempts are BOUNDED (MAX_RELOADS per WINDOW_MS, tracked
 * in sessionStorage). Skew heals on the first reload; a *persistent* failure
 * (a broken deploy, not skew) stops reloading after the cap instead of
 * looping forever — the app's error boundaries take it from there. The
 * counter window resets itself, so a genuinely-later second skew can still
 * heal.
 *
 * Vercel Skew Protection (next.config `deploymentId`) prevents the skew at the
 * platform; this is the client-side safety net.
 */

import * as React from 'react';

const KEY = 'skew-reloads';
const COOLDOWN_MS = 15_000; // min spacing between reloads
const WINDOW_MS = 10 * 60_000; // counter window
const MAX_RELOADS = 3; // per window — then give up (broken deploy, not skew)

function isChunkLoadError(reason: unknown): boolean {
  const msg =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? '');
  return (
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

export function ChunkReloadGuard() {
  React.useEffect(() => {
    const reloadOnce = () => {
      const now = Date.now();
      let state = { count: 0, firstAt: now, lastAt: 0 };
      try {
        const parsed = JSON.parse(sessionStorage.getItem(KEY) || '');
        if (parsed && typeof parsed.count === 'number') state = parsed;
      } catch {
        // sessionStorage blocked or empty — fall through, best effort.
      }
      if (now - state.firstAt > WINDOW_MS) state = { count: 0, firstAt: now, lastAt: 0 };
      if (state.count >= MAX_RELOADS) return; // persistent failure — stop looping
      if (now - state.lastAt < COOLDOWN_MS) return; // recently reloaded — don't thrash
      try {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({ count: state.count + 1, firstAt: state.firstAt, lastAt: now }),
        );
      } catch {
        // ignore
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error ?? e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadOnce();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
