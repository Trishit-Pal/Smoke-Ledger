import Link from 'next/link';

/**
 * The auth pages' way home: the rail's "Smoke Ledger" nameplate, top-left of the
 * column, in place of the fixed-corner "Go to Homepage" link (render the shell
 * with `showGoHome={false}`).
 */
export function WordmarkHomeLink() {
  return (
    <Link
      href="/"
      aria-label="Smoke Ledger home"
      className="focus-ring mb-lg inline-flex min-h-11 items-center self-start"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        letterSpacing: '-0.015em',
        lineHeight: 1.05,
        color: 'var(--text)',
        textDecoration: 'none',
      }}
    >
      {/* One flex child: as separate items the space before "Ledger" collapses. */}
      <span>
        Smoke<span style={{ fontStyle: 'italic', color: 'var(--accent-ink)' }}> Ledger</span>
      </span>
    </Link>
  );
}
