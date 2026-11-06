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
  /**
   * From Groq's "Your data" docs, the Gemini API Additional Terms (paid services) and OpenRouter's
   * privacy docs (research notes, 2026-11-06). Re-check before each version. The Groq sentence is true
   * only once Zero Data Retention is on in every Groq org whose key is set (owner-actions.md §8).
   */
  aiVendorRetention:
    'Groq says it does not train models on this data, and we have turned on its Zero Data Retention setting, so it does not keep what it receives. Google receives it only under its paid Gemini API terms, which say Google does not use it to improve its products; Google keeps it for a limited time to detect misuse. OpenRouter is used only with hosts that do not store or train on what they receive, and OpenRouter does not keep the text of requests because we have not turned its prompt logging on.',
  helplines: {
    indiaQuitline: '1800-11-2356',
    emergencyIndia: '112',
    emergencyEu: '112',
  },
} as const;
