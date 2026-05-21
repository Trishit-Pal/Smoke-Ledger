import Link from 'next/link';
import { LEGAL_LINKS } from '@web/lib/legal';
import { Text } from '@web/components/ui/Text';

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-xl px-lg md:px-xl">
      <div className="max-w-5xl mx-auto flex flex-col gap-md items-center text-center">
        <Text variant="caption" muted>
          Smoke Ledger — smoking reduction and cessation support
        </Text>
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-md text-small">
          <Link href={LEGAL_LINKS.privacy} className="text-accent font-semibold hover:opacity-80">
            Privacy Policy
          </Link>
          <Link href={LEGAL_LINKS.terms} className="text-accent font-semibold hover:opacity-80">
            Terms of Service
          </Link>
          <Link href={LEGAL_LINKS.support} className="text-accent font-semibold hover:opacity-80">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
