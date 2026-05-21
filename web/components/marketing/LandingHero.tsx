import Link from 'next/link';
import { Text } from '@web/components/ui/Text';

const PRIMARY_CTA =
  'h-11 px-5 rounded-md bg-accent text-white font-semibold inline-flex items-center justify-center hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const SECONDARY_CTA =
  'h-11 px-5 rounded-md border border-border bg-bg-elevated text-text font-semibold inline-flex items-center justify-center hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function LandingHero() {
  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="relative overflow-hidden pt-xxl pb-xl px-lg md:px-xl"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, var(--accent-glow), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative max-w-4xl mx-auto flex flex-col gap-lg text-center md:text-left">
        <div className="flex flex-wrap justify-center md:justify-start gap-sm">
          <span className="text-caption font-semibold uppercase tracking-wide text-accent px-sm py-xs rounded-pill bg-accent-soft">
            100% free
          </span>
          <span className="text-caption text-text-muted px-sm py-xs rounded-pill border border-border">
            No ads
          </span>
          <span className="text-caption text-text-muted px-sm py-xs rounded-pill border border-border">
            18+ only
          </span>
        </div>

        <Text variant="display" id="landing-hero-heading" className="font-serif max-w-3xl">
          Know every stick. Spend less. Quit on your terms.
        </Text>

        <Text variant="body" muted className="max-w-2xl mx-auto md:mx-0">
          Free tracker for Indian smokers — one-tap logs, daily dashboard, and trends in INR.
        </Text>

        <div className="flex flex-wrap gap-md justify-center md:justify-start">
          <Link href="/signup" className={PRIMARY_CTA}>
            Create free account
          </Link>
          <Link href="/login" className={SECONDARY_CTA}>
            Sign in
          </Link>
        </div>

        <Text variant="caption" muted className="max-w-xl mx-auto md:mx-0">
          Support software, not medical care. Always consult a clinician for health decisions.
        </Text>
      </div>
    </section>
  );
}

export { PRIMARY_CTA, SECONDARY_CTA };
