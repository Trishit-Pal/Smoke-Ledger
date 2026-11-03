// What Ask the ledger may and may not read: one source, rendered verbatim into
// the system prompt and (as the summary) into the consent notice. Tests pin
// every line in both, so the promise and the instructions cannot drift.

/** What the chat may read: the reader's own rows only, through RLS-scoped queries. */
export const IN_SCOPE: readonly string[] = [
  'Your entries from the last 90 days: time, sticks, brand alias or name, variant, price paid, purchase mode, mood before and after, trigger, craving, situation and notes. In discreet mode, brands are aliased and notes and variants are left out.',
  'Daily totals for up to a year (never before you joined), and the comparisons, trends, peaks and savings worked out from them.',
  'Your goals: the active ones with their live state and suggestions, and the history of paused, completed and abandoned goals (type, target, dates and outcome).',
  'Your own price history for the last year: brand alias or name, unit price, pack size and the date you noted it.',
  'Which entries you edited, and on what date. The values before an edit are not kept, so they cannot be read.',
  'A short context line: today’s date, time zone, currency, locale, your daily baseline, and whether discreet mode is on.',
];

/** Never loaded, never sent, and declined if asked. */
export const OUT_OF_SCOPE: readonly string[] = [
  'Who the reader is: name, date of birth or age, gender, email, phone or place.',
  'Account machinery: sign-in history, audit, error and usage records, consents, legal versions, settings other than discreet mode, and device details.',
  'Anyone else’s data, totals across readers, general knowledge, news or the web, tobacco product advice or recommendations, and prices that are not in the reader’s ledger.',
  'Health: medical advice, diagnosis, health claims or ways to quit.',
  'Judgement or pressure: praise, scolding, streak talk or nagging.',
  'Anything older than the windows above, and forecasts beyond the spend outlook.',
];

/** The in-scope list in one sentence, for the consent notice. */
export const IN_SCOPE_SUMMARY =
  'It reads only your own ledger: your entries from the last 90 days, daily totals for up to a year, your goals and their history, your price history, the dates you edited entries, and a short context line.';
