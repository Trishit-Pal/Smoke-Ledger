'use client';

import * as React from 'react';

/**
 * Post-deletion confirmation banner for the public landing page.
 *
 * The Settings delete flow redirects to `/?deleted=1` after a successful
 * account deletion. This component detects that flag client-side (so the
 * landing page stays statically rendered — no `searchParams` prop on the
 * server component), shows a dismissible notice, and strips the query param
 * from the URL via `history.replaceState` so a refresh or share doesn't
 * re-surface it.
 */
export function AccountDeletedNotice() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('deleted') === '1') {
      setVisible(true);
      // Drop the param without a navigation/refetch so the static page is kept
      // and the banner doesn't reappear on reload.
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // The live-region wrapper is always mounted (even when empty) so assistive
  // tech registers it at page load and announces the banner when it appears.
  return (
    <div role="status" aria-live="polite">
      {visible ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '12px clamp(20px, 5vw, 64px)',
            background: 'var(--bg-elevated, var(--bg))',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              lineHeight: 1.5,
              color: 'var(--text)',
              textAlign: 'center',
            }}
          >
            Your account and all its data have been deleted. You&rsquo;re welcome back anytime.
          </p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
            className="focus-ring"
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
