const TRUST_ITEMS = [
  'Free to use',
  'Row-level security',
  'You own your data',
  'Export anytime',
] as const;

export function LandingTrustStrip() {
  return (
    <section aria-label="Trust highlights" className="border-y border-border bg-bg-elevated/50">
      <div className="max-w-5xl mx-auto px-lg md:px-xl py-md flex flex-wrap justify-center gap-sm md:gap-md">
        {TRUST_ITEMS.map((item) => (
          <span
            key={item}
            className="text-small font-medium text-text-muted px-md py-xs rounded-pill border border-border bg-card"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
