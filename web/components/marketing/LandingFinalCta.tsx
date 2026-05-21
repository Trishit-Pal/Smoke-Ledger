import Link from 'next/link';
import { PRIMARY_CTA, SECONDARY_CTA } from '@web/components/marketing/LandingHero';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';

export function LandingFinalCta() {
  return (
    <section
      aria-labelledby="landing-final-cta-heading"
      className="py-xxl px-lg md:px-xl relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 100%, var(--accent-glow), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative max-w-3xl mx-auto text-center flex flex-col gap-lg items-center">
        <Text variant="h2" id="landing-final-cta-heading" className="font-serif">
          Ready to take control?
        </Text>
        <Text variant="body" muted className="max-w-xl">
          Join free today. Track every stick, see your spend in rupees, and build a reduction plan
          that fits your life.
        </Text>
        <div className="flex flex-wrap gap-md justify-center">
          <Link href="/signup" className={PRIMARY_CTA}>
            Create free account
          </Link>
          <Link href="/login" className={SECONDARY_CTA}>
            Sign in
          </Link>
        </div>
        <Link href={LEGAL_LINKS.support} className="text-small text-accent font-semibold hover:opacity-80">
          Questions? Contact support
        </Link>
      </div>
    </section>
  );
}
