'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_LINKS } from '@web/lib/legal';

export function GoToHomepageLink() {
  const pathname = usePathname();
  if (pathname === PUBLIC_LINKS.home) return null;

  return (
    <footer className="fixed bottom-4 right-4 z-40 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
      <Link
        href={PUBLIC_LINKS.home}
        className="text-small font-semibold text-accent hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-sm"
        aria-label="Go to Smoke Ledger homepage"
      >
        Go to Homepage
      </Link>
    </footer>
  );
}
