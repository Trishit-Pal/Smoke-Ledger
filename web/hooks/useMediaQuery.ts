'use client';
import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Mirrors the matchMedia pattern of
 * useReduceMotion. Initial server/first-paint value is `false`; it corrects on
 * mount. Safe for charts (dynamic-imported with ssr:false) — no hydration risk.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** True at Tailwind's `lg` breakpoint (>=1024px) and up. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
