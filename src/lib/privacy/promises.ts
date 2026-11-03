/**
 * "Our data promises" on the privacy page. Each key has a mechanism checker in
 * src/tests/privacy-promises.test.ts that reads the code keeping the promise, so a
 * promise cannot be added, or a mechanism removed, without a failing test.
 */
import { RETENTION } from './retention';

export type DataPromiseKey =
  | 'noSaleNoAds'
  | 'analyticsOptIn'
  | 'chatOptIn'
  | 'chatNotStored'
  | 'eraseEverywhere'
  | 'deleteRemovesIdentity'
  | 'fixedRetention'
  | 'redactedErrors'
  | 'completeExport'
  | 'ownRowsOnly'
  | 'adultsOnly';

export interface DataPromise {
  readonly key: DataPromiseKey;
  readonly text: string;
}

export const DATA_PROMISES: readonly DataPromise[] = [
  { key: 'noSaleNoAds', text: 'We never sell your data. The app runs no advertising and no third-party tracking code.' },
  { key: 'ownRowsOnly', text: 'Only your account can read your ledger. The database checks every request against who is signed in.' },
  { key: 'analyticsOptIn', text: 'Usage analytics stay off until you turn them on. Turning them off deletes the events already recorded.' },
  { key: 'chatOptIn', text: 'Nothing is sent to the AI service unless you have turned Ask the ledger on.' },
  { key: 'chatNotStored', text: 'We keep no chat questions or replies on our servers. The conversation stays in your browser.' },
  {
    key: 'eraseEverywhere',
    text: 'Erase removes your ledger, and your name, date of birth and gender, from every place we keep them, including the sign-in record.',
  },
  { key: 'deleteRemovesIdentity', text: 'Delete account erases your data first, then removes your sign-in identity.' },
  {
    key: 'fixedRetention',
    text: `Records are deleted on a fixed daily schedule: security records after ${RETENTION.auditEventsMonths} months, error reports after ${RETENTION.errorEventsDays} days, usage events after ${RETENTION.usageEventsMonths} months.`,
  },
  { key: 'redactedErrors', text: 'Error reports have email addresses, phone numbers and other identifiers removed before they are stored.' },
  {
    key: 'completeExport',
    text: 'Your export holds your account record, profile, consents, ledger, settings, usage events, error reports and the security records linked to you.',
  },
  { key: 'adultsOnly', text: 'Smoke Ledger is for adults. The 18+ check runs in the app and again in the database.' },
];
