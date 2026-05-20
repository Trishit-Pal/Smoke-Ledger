const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://smokeledger.app';

export const LEGAL_VERSIONS = {
  terms: '2026-05-19',
  privacy: '2026-05-19',
  medicalDisclaimer: '2026-05-19',
} as const;

export const LEGAL_URLS = {
  terms: `${baseUrl}/terms`,
  privacy: `${baseUrl}/privacy`,
  support: `${baseUrl}/support`,
} as const;
