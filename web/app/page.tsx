import * as React from 'react';
import Link from 'next/link';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <main className="max-w-3xl mx-auto p-lg md:p-xl flex flex-col gap-xl">
        <section className="pt-xxl flex flex-col gap-md">
          <Text variant="caption" muted>
            SMOKE LEDGER
          </Text>
          <Text variant="display">Reduce smoking with consistent, private tracking.</Text>
          <Text variant="body" muted>
            Build sustainable cessation habits with trigger logs, spend trends, and milestone feedback.
            This product is support software and not medical care.
          </Text>
          <div className="flex flex-wrap gap-md">
            <Link
              href="/signup"
              className="h-11 px-4 rounded-md bg-accent text-white font-semibold inline-flex items-center"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="h-11 px-4 rounded-md border border-border bg-bg-elevated text-text font-semibold inline-flex items-center"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="grid gap-md md:grid-cols-2">
          <Card>
            <div className="flex flex-col gap-sm">
              <Text variant="h3">Privacy-first</Text>
              <Text variant="small" muted>
                Authenticated access, row-level security, and user-owned delete controls.
              </Text>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-sm">
              <Text variant="h3">Cessation focused</Text>
              <Text variant="small" muted>
                Track triggers, cravings, spend, and progress to support reduction goals.
              </Text>
            </div>
          </Card>
        </section>

        <section className="flex flex-wrap gap-md text-small">
          <Link href={LEGAL_LINKS.privacy} className="text-accent font-semibold hover:opacity-80">
            Privacy Policy
          </Link>
          <Link href={LEGAL_LINKS.terms} className="text-accent font-semibold hover:opacity-80">
            Terms of Service
          </Link>
          <Link href={LEGAL_LINKS.support} className="text-accent font-semibold hover:opacity-80">
            Support
          </Link>
        </section>
      </main>
    </div>
  );
}
