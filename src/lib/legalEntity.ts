/**
 * Who runs Smoke Ledger, and the operator facts the privacy policy and terms render.
 * Owner decisions O1, O2, O8, O12 (2026-11-03). Filling in the EU representative
 * below is the only change needed to name it on both pages; the LEGAL_VERSIONS
 * bump that asks live readers to re-accept waits on euRepresentativeIsNamed.
 */

export interface EuRepresentative {
  readonly name: string;
  readonly address: string;
  readonly email: string;
}

/** GDPR Art 27 representative (O1). Empty until the written mandate is signed. */
export const EU_REPRESENTATIVE: EuRepresentative = {
  name: '',
  address: '',
  email: '',
};

/** True only when every field is filled; the pages show a "being appointed" line otherwise. */
export function euRepresentativeIsNamed(rep: EuRepresentative): boolean {
  return [rep.name, rep.address, rep.email].every((field) => field.trim() !== '');
}

export const LEGAL_ENTITY = {
  /** Controller (GDPR) and Data Fiduciary (DPDP): an individual, not a company (O12). */
  operatorName: 'Trishit Pal',
  city: 'Kolkata',
  country: 'India',
  contactEmail: 'support@smokeledger.app',
  /** SPDI Rule 5(9) and DPDP Rule 14: one month satisfies both (O2). */
  grievanceOfficer: {
    name: 'Trishit Pal',
    email: 'support@smokeledger.app',
    responseDays: 30,
  },
  /** O8: Indian law and Kolkata courts, with EU consumers keeping their home law and courts. */
  governingLaw: {
    law: 'the laws of India',
    courts: 'the courts at Kolkata, West Bengal',
  },
  /**
   * Sends sign-in, confirmation and reset emails for Supabase Auth over SMTP.
   * ponytail: taken from docs/deployment/auth-email-delivery.md; the owner confirms it
   * matches the live Supabase SMTP setting before the version bump.
   */
  emailDeliveryProvider: 'Resend',
  /** From Anthropic's commercial terms and privacy centre (research notes, 2026-11-03). Re-check before each version. */
  anthropicRetention:
    'Anthropic’s commercial terms say it may not train its models on this data. Anthropic says it deletes what it receives through its API, and what it writes back, within 30 days, with exceptions: for example when a request is flagged under its usage policy, or when the law requires it to keep data longer. We have not arranged a shorter period with Anthropic.',
  helplines: {
    indiaQuitline: '1800-11-2356',
    emergencyIndia: '112',
    emergencyEu: '112',
  },
} as const;
