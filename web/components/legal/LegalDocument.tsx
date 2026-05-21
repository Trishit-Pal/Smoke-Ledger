import * as React from 'react';
import Link from 'next/link';
import { PublicPageShell } from '@web/components/layout/PublicPageShell';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';

export interface LegalSection {
  title: string;
  body: readonly string[];
}

interface LegalDocumentProps {
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
}

export function LegalDocument({ title, subtitle, effectiveDate, sections }: LegalDocumentProps) {
  return (
    <PublicPageShell>
      <main className="max-w-3xl mx-auto p-lg md:p-xl pb-16 flex flex-col gap-lg">
        <header className="flex flex-col gap-sm">
          <Text variant="caption" muted>
            LEGAL
          </Text>
          <Text variant="display">{title}</Text>
          <Text variant="small" muted>
            {subtitle}
          </Text>
          <Text variant="small" faint>
            Effective date: {effectiveDate}
          </Text>
        </header>

        {sections.map((section) => (
          <Card key={section.title}>
            <div className="flex flex-col gap-sm">
              <Text variant="h3">{section.title}</Text>
              {section.body.map((paragraph) => (
                <Text key={`${section.title}-${paragraph.slice(0, 24)}`} variant="small" muted>
                  {paragraph}
                </Text>
              ))}
            </div>
          </Card>
        ))}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <Text variant="small" muted>
              Need help with account data requests?
            </Text>
            <Link href={LEGAL_LINKS.support} className="text-small font-semibold text-accent hover:opacity-80">
              Contact support
            </Link>
          </div>
        </Card>
      </main>
    </PublicPageShell>
  );
}

export default LegalDocument;
