import { LEGAL_VERSIONS } from '@/lib/legal';
export { LEGAL_VERSIONS };

export const LEGAL_LINKS = {
  terms: '/terms',
  privacy: '/privacy',
  support: '/support',
} as const;

export const PUBLIC_LINKS = {
  home: '/',
  ...LEGAL_LINKS,
} as const;

export const LEGAL_COPY = {
  productName: 'Smoke Ledger',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@smokeledger.app',
  supportResponseTarget: '3 business days',
} as const;
