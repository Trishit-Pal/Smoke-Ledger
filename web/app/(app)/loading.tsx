// Editorial skeleton: a caption bar between two hairlines, then ledger rows —
// the same silhouette as the pages it stands in for. The pulse is removed
// under prefers-reduced-motion (globals.css).
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="page-column pt-xl pb-xxxl md:pt-xxl"
    >
      <div className="flex items-center gap-md">
        <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)]" />
        <span aria-hidden className="h-3 w-28 rounded-sm bg-[var(--rule)] animate-pulse" />
        <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)]" />
      </div>
      <div className="mt-xxl flex flex-col gap-xl">
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden className="flex items-end justify-between border-t border-[var(--rule)] pt-md">
            <span className="h-3 w-24 rounded-sm bg-[var(--rule)] animate-pulse" />
            <span className="h-8 w-16 rounded-sm bg-[var(--rule)] animate-pulse" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
