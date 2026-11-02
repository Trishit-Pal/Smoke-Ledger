// The one notice shown wherever Ask the ledger can be turned on (the panel's
// consent card and the Settings switch), so the two cannot drift. It must
// match what the privacy policy discloses and what the tools actually send.

export const LEDGER_CHAT_NOTICE = {
  lead: 'Answers come from an AI model run by Anthropic in the United States.',
  sent: 'If you turn this on, each question and the figures needed to answer it are sent to Anthropic: totals, trends, spend by brand, time-of-day and weekday patterns, mood and trigger counts, goal progress and targets, your daily baseline, and your country-level currency and time zone. When a question needs them, so are your recent entries from the last 30 days: dates, times, quantities, triggers, moods, cravings, the situation you tagged, brand names, and your own notes.',
  discreet:
    'In discreet mode, brand names are replaced with aliases and notes are not sent. A brand name you type into a question is sent as you typed it.',
  retention:
    'Anthropic does not use this data to train its models and deletes it after a limited period, currently up to 30 days, unless it must be kept longer for safety or legal reasons.',
  device:
    'We store no questions, replies, or conversations on our servers. The conversation stays on this device until you sign out, erase your data, delete your account, or turn this off in Settings › Privacy.',
} as const;

export const LEDGER_CHAT_NOTICE_TEXT = Object.values(LEDGER_CHAT_NOTICE).join(' ');

export const LEDGER_CHAT_SETTINGS_SUBLABEL =
  'Answers questions about your own ledger with an AI model run by Anthropic (United States). Off by default; you will see exactly what is sent before it turns on. Turning it off clears the conversation on this device.';
