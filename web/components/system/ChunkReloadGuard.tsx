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
 * Loop guard: a short cooldown stamped in sessionStorage means a *persistent*
 * failure (a real bug, not skew) reloads at most once per cooldown window
 * instead of thrashing, while a genuinely-later skew can still heal.
 *
 * Vercel Skew Protection (next.config `deploymentId`) prevents the skew at the
 * platform; this is the client-side safety net.
 */

import * as React from 'react';

const KEY = 'skew-reload-at';
const COOLDOWN_MS = 15000;

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
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) || '0');
      } catch {
        // sessionStorage blocked — fall through, best effort.
      }
      const now = Date.now();
      if (now - last < COOLDOWN_MS) return; // recently reloaded — don't thrash
      try {
        sessionStorage.setItem(KEY, String(now));
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

export default ChunkReloadGuard;
