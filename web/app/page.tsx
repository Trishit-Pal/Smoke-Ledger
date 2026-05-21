import type { Metadata } from 'next';
import { PublicPageShell } from '@web/components/layout/PublicPageShell';
import { LandingHero } from '@web/components/marketing/LandingHero';
import { LandingTrustStrip } from '@web/components/marketing/LandingTrustStrip';
import { LandingProductBento } from '@web/components/marketing/LandingProductBento';
import { LandingHowItWorks } from '@web/components/marketing/LandingHowItWorks';
import { LandingPrivacy } from '@web/components/marketing/LandingPrivacy';
import { LandingFaq } from '@web/components/marketing/LandingFaq';
import { LandingFinalCta } from '@web/components/marketing/LandingFinalCta';
import { LandingFooter } from '@web/components/marketing/LandingFooter';

export const metadata: Metadata = {
  title: 'Smoke Ledger — Free smoking tracker & quit support',
  description:
    'Free private smoking tracker — one-tap logging, daily dashboard, and trends in INR.',
  openGraph: {
    title: 'Smoke Ledger — Free smoking tracker & quit support',
    description:
      'Free private smoking tracker — one-tap logging, daily dashboard, and trends in INR.',
  },
};

export default function LandingPage() {
  return (
    <PublicPageShell>
      <LandingHero />
      <LandingTrustStrip />
      <LandingProductBento />
      <LandingHowItWorks />
      <LandingPrivacy />
      <LandingFaq />
      <LandingFinalCta />
      <LandingFooter />
    </PublicPageShell>
  );
}
