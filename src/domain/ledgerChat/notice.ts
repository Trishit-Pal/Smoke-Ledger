// The one notice shown wherever Ask the ledger can be turned on (the panel's
// consent card and the Settings switch, on web and mobile), so they cannot
// drift. It must match what the privacy policy discloses and what the tools actually send:
// the limits render from the same constants the route and tools use.

import {
  CHAT_HISTORY_MAX_TURNS,
  NOTE_MAX_CHARS,
  RECENT_MAX_DAYS,
  RECENT_MAX_ROWS,
} from './types';
import { IN_SCOPE_SUMMARY } from './scope';
import { LEGAL_ENTITY } from '@/lib/legalEntity';

export const LEDGER_CHAT_NOTICE = {
  lead: 'Answers come from an AI model run by Anthropic in the United States.',
  scope: IN_SCOPE_SUMMARY,
  sent: `Each time you ask, Anthropic receives your question, up to ${CHAT_HISTORY_MAX_TURNS} earlier turns of this conversation (your questions and its replies), and a short context line: today’s date, your time zone, currency and locale, your daily baseline, how many days have entries, and the kind and state of your active goals, and whether discreet mode is on. It also receives the figures needed to answer: totals, trends, spend by brand, time-of-day and weekday patterns, mood and trigger pairings, goal progress and targets, and the app’s rules-based insights. When a question needs them, so are up to ${RECENT_MAX_ROWS} of your entries from the last ${RECENT_MAX_DAYS} days: date, hour, quantity, trigger, moods, craving, situation, brand, and the first ${NOTE_MAX_CHARS} characters of your note.`,
  discreet:
    'In discreet mode, brand names are replaced with aliases and notes are not sent. A brand name you type into a question is sent as you typed it. Your name, date of birth, gender, email, phone number and place are never sent.',
  retention: LEGAL_ENTITY.anthropicRetention,
  device:
    'We store no questions or replies on our servers. The conversation stays in this browser until you choose Clear conversation, turn this off, turn discreet mode on, sign out, erase your data or delete your account.',
} as const;

export const LEDGER_CHAT_NOTICE_TEXT = Object.values(LEDGER_CHAT_NOTICE).join(' ');

export const LEDGER_CHAT_SETTINGS_SUBLABEL =
  'Answers questions about your own ledger with an AI model run by Anthropic (United States). Off by default; you will see exactly what is sent before it turns on. Turning it off clears the conversation on this device.';
