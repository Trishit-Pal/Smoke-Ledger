// Copy for the re-consent screen (web /consent, Expo app/consent.tsx), shown to a
// user who already consented when the terms or privacy policy change materially.
// Shared so the two surfaces say the same thing. The detail lives in the policy;
// these lines only say what to look for, so they hold no names or figures that
// the policy owns.

export const RECONSENT_CAPTION = 'Notice · Changed terms';
export const RECONSENT_TITLE = 'We have updated our terms.';
export const RECONSENT_LEDE =
  'Please read what changed and accept to carry on. Your ledger has not been touched.';

export interface ReconsentChange {
  title: string;
  body: string;
  /** Only shown to readers who have not yet given the separate health-data consent. */
  onlyWithoutHealthConsent?: boolean;
}

export const RECONSENT_CHANGES: readonly ReconsentChange[] = [
  {
    title: 'Health information, asked for plainly',
    body: 'What you log about smoking, spending, mood, craving and notes is information about your health. We now ask for your explicit consent to keep it, and you can withdraw it in Settings.',
    onlyWithoutHealthConsent: true,
  },
  {
    title: 'How long records are kept',
    body: 'Sign-in, error and optional usage records are deleted automatically after a stated time. The policy lists each period.',
  },
  {
    title: 'Where your data is held, and who sees it',
    body: 'The policy names where your ledger is stored and the safeguards for that, and what is sent to our AI provider if you turn on Ask the ledger.',
  },
  {
    title: 'Who to contact, and which law applies',
    body: 'A named Grievance Officer answers within 30 days. The terms say which law and courts apply, and what you keep if you are in the EU.',
  },
];

export const RECONSENT_ACCEPT_LABEL = 'Accept and continue';
export const RECONSENT_NOT_NOW_LABEL = 'Not now — export or delete my data';
export const RECONSENT_NOT_NOW_NOTE =
  'You can export a copy, or withdraw and delete, from Settings. Until you accept, the rest of the app stays closed.';
