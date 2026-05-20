import * as React from 'react';
import Link from 'next/link';
import { LEGAL_LINKS } from '@web/lib/legal';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-lg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-xl">
          <h1 className="text-h1 font-bold text-text">Smoke Ledger</h1>
          <p className="text-small text-text-muted mt-xs">
            Cessation support with privacy-first tracking.
          </p>
        </div>
        {children}
        <div className="mt-lg text-center text-caption text-text-muted flex items-center justify-center gap-md">
          <Link href={LEGAL_LINKS.privacy} className="hover:text-text">
            Privacy
          </Link>
          <Link href={LEGAL_LINKS.terms} className="hover:text-text">
            Terms
          </Link>
          <Link href={LEGAL_LINKS.support} className="hover:text-text">
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}
