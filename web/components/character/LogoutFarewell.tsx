'use client';

/*
 * LogoutFarewell — full-screen farewell overlay fired by dispatchFarewell().
 *
 * Listens for `character:farewell` events. Renders a paper-noise overlay with
 * the goodbye-waving figure + "Until tomorrow." copy. Holds for ~1.8s, then
 * lets the parent navigate (the supabase signOut() and router.push('/login')
 * happen on the caller side — this is purely a visual flourish to bridge the
 * gap so the user doesn't watch a blank flash).
 *
 * Usage in your logout handler:
 *   import { dispatchFarewell } from '@web/lib/character/mood';
 *   dispatchFarewell();
 *   // give the overlay ~1.6s to play before the sign-out completes
 *   await new Promise((r) => setTimeout(r, 1600));
 *   await supabase.auth.signOut();
 *   router.push('/login');
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Figure } from '@web/components/character/Figure';
import { CHARACTER_FAREWELL_EVENT } from '@web/lib/character/mood';

export function LogoutFarewell() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    function handler() {
      setOpen(true);
      // Caller is responsible for actual sign-out + navigation. We just hold
      // the overlay long enough to be seen; the overlay disappears on unmount
      // when the route changes.
    }
    window.addEventListener(CHARACTER_FAREWELL_EVENT, handler);
    return () => window.removeEventListener(CHARACTER_FAREWELL_EVENT, handler);
  }, []);

  if (!mounted || !open) return null;

  const node = (
    <div
      className="character-overlay"
      role="status"
      aria-live="polite"
      aria-label="Signing out"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-elevated)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 32,
      }}
    >
      <div className="paper-noise" style={{ position: 'absolute', inset: 0 }} aria-hidden />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Figure mood="bye" size={200} />
      </div>
      <span className="editorial-caption">Signed out</span>
      <h2
        className="editorial-headline"
        style={{
          fontSize: 40,
          textAlign: 'center',
          margin: '4px 0 0',
          color: 'var(--text)',
          position: 'relative',
        }}
      >
        Until tomorrow.
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 1.6,
          marginTop: 4,
          position: 'relative',
        }}
      >
        The ledger will be here when you are. Be kind to yourself in the meantime.
      </p>
      <div
        style={{
          width: 80,
          borderTop: '1px solid var(--rule)',
          marginTop: 18,
          position: 'relative',
        }}
      />
    </div>
  );

  return createPortal(node, document.body);
}

export default LogoutFarewell;
