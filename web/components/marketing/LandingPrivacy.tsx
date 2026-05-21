import Link from 'next/link';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';

const ITEMS = [
  {
    title: 'Export or delete anytime',
    body: 'Download your data as JSON, erase app data, or delete your account when you choose.',
  },
  {
    title: 'Private by default',
    body: 'Authentication and row-level security keep your logs isolated to your account.',
  },
] as const;

export function LandingPrivacy() {
  return (
    <section aria-labelledby="landing-privacy-heading" className="py-xl px-lg md:px-xl">
      <div className="max-w-5xl mx-auto flex flex-col gap-lg">
        <div>
          <Text variant="caption" muted>
            PRIVACY & CONTROL
          </Text>
          <h2 id="landing-privacy-heading" className="text-h2 font-semibold font-serif text-text mt-sm">
            Your data stays yours
          </h2>
          <Text variant="small" muted className="mt-sm max-w-2xl">
            No ads, no data brokers. Read our{' '}
            <Link href={LEGAL_LINKS.privacy} className="text-accent font-semibold hover:opacity-80">
              Privacy Policy
            </Link>{' '}
            for full details.
          </Text>
        </div>
        <ul className="grid gap-md sm:grid-cols-2">
          {ITEMS.map((item) => (
            <li key={item.title} className="rounded-lg border border-border bg-card p-md flex flex-col gap-xs">
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="small" muted>
                {item.body}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
