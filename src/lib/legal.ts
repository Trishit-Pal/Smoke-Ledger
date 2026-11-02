const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://smokeledger.app';

export const LEGAL_VERSIONS = {
  terms: '2026-05-19',
  // 2026-11-02: names Anthropic as the processor behind the opt-in Ask the ledger feature.
  privacy: '2026-11-02',
  medicalDisclaimer: '2026-05-19',
} as const;

export const LEGAL_URLS = {
  terms: `${baseUrl}/terms`,
  privacy: `${baseUrl}/privacy`,
  support: `${baseUrl}/support`,
} as const;
