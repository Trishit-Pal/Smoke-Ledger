import * as React from 'react';
import Link from 'next/link';
import { PublicPageShell } from '@web/components/layout/PublicPageShell';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { LEGAL_COPY, LEGAL_LINKS } from '@web/lib/legal';

export default function SupportPage() {
  return (
    <PublicPageShell>
      <main className="max-w-2xl mx-auto p-lg md:p-xl pb-16 flex flex-col gap-lg">
        <header className="flex flex-col gap-sm">
          <Text variant="caption" muted>
            SUPPORT
          </Text>
          <Text variant="display">Contact Smoke Ledger</Text>
          <Text variant="small" muted>
            We handle account access, privacy, export, deletion, and technical support requests.
          </Text>
        </header>

        <Card>
          <div className="flex flex-col gap-sm">
            <Text variant="h3">Support email</Text>
            <a
              href={`mailto:${LEGAL_COPY.supportEmail}`}
              className="text-body-strong text-accent hover:opacity-80"
            >
              {LEGAL_COPY.supportEmail}
            </a>
            <Text variant="small" muted>
              Initial response target: {LEGAL_COPY.supportResponseTarget}
            </Text>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-sm">
            <Text variant="h3">Privacy and legal</Text>
            <Text variant="small" muted>
              Include your account email and request type (access, export, correction, deletion) so we
              can process requests safely.
            </Text>
            <div className="flex flex-wrap gap-md">
              <Link href={LEGAL_LINKS.privacy} className="text-small font-semibold text-accent hover:opacity-80">
                Privacy Policy
              </Link>
              <Link href={LEGAL_LINKS.terms} className="text-small font-semibold text-accent hover:opacity-80">
                Terms of Service
              </Link>
            </div>
          </div>
        </Card>
      </main>
    </PublicPageShell>
  );
}
