// Deterministic safety screening for Ask the ledger: the free first layer, run on the question,
// on every earlier turn, and on the model's answer. Pure functions, no I/O, so both the route
// and the turn engine can call them and Jest can pin them. Patterns live in ./safetyPatterns.ts.

import { LEGAL_ENTITY } from '@/lib/legalEntity';
import type { ChatHistoryTurn } from './types';
import {
  PERSONA_PATTERNS,
  PROMPT_LEAK_FINGERPRINTS,
  QUESTION_PATTERNS,
  type SafetyCategory,
} from './safetyPatterns';

export type { SafetyCategory } from './safetyPatterns';

export type ScreenResult = { blocked: false } | { blocked: true; category: SafetyCategory };

/** The one reply for anything off-limits: calm, plain, and never a lecture. */
export const BEYOND_SCOPE_ANSWER =
  "That's beyond the scope of what Ask the ledger can answer. It reads only your own entries, spend and patterns.";

/** Self-harm keeps the same refusal and adds one line that points to help now. */
export const SELF_HARM_ANSWER = `${BEYOND_SCOPE_ANSWER} If you might hurt yourself, please call ${LEGAL_ENTITY.helplines.emergencyIndia} now, or reach someone you trust.`;

const INVISIBLE = /[­​-‏‪-‮⁠-⁤﻿]/g;
const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Undo the usual disguises so one set of patterns sees through them. */
export function normalize(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(INVISIBLE, '')
      // Leetspeak only inside words that have letters: "1gn0r3" -> "ignore", but "10" stays 10.
      .replace(/[a-z0-9@$]+/g, (token) => (/[a-z]/.test(token) ? token.replace(/[013457@$]/g, (c) => LEET[c]) : token))
      // Letters spaced or dotted apart: "i g n o r e", "i.g.n.o.r.e" -> "ignore" (three or more).
      .replace(/(?<![a-z])(?:[a-z][ .]){2,}[a-z](?![a-z])/g, (run) => run.replace(/[ .]/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function firstMatch(text: string, skip: ReadonlySet<SafetyCategory> = new Set()): ScreenResult {
  const normalized = normalize(text);
  for (const [category, patterns] of QUESTION_PATTERNS) {
    if (skip.has(category)) continue;
    if (patterns.some((p) => p.test(normalized))) return { blocked: true, category };
  }
  return { blocked: false };
}

/** The question (or any earlier turn) a reader sent. */
export function screenText(text: string): ScreenResult {
  return firstMatch(text);
}

/**
 * Earlier turns come from the reader's device, so a tampered client could plant an "assistant"
 * reply that agreed to drop the rules. Each user turn and its reply stand or fall together, so
 * the kept history still alternates user, assistant.
 */
export function screenHistory(turns: readonly ChatHistoryTurn[]): { turns: ChatHistoryTurn[]; dropped: number } {
  const kept: ChatHistoryTurn[] = [];
  let dropped = 0;
  for (let i = 0; i < turns.length; i += 2) {
    const pair = turns.slice(i, i + 2);
    if (pair.some((t) => screenText(t.text).blocked)) dropped += pair.length;
    else kept.push(...pair);
  }
  return { turns: kept, dropped };
}

/**
 * The model's answer, before anyone sees it. Self-harm wording is allowed here: a model that
 * points someone to help must not be replaced by a refusal.
 */
export function screenAnswer(text: string): ScreenResult {
  const normalized = normalize(text);
  if (PROMPT_LEAK_FINGERPRINTS.some((f) => normalized.includes(f))) return { blocked: true, category: 'injection' };
  if (PERSONA_PATTERNS.some((p) => p.test(normalized))) return { blocked: true, category: 'injection' };
  return firstMatch(text, new Set<SafetyCategory>(['self_harm']));
}

/** What the reader sees for a blocked turn. */
export function answerFor(category: SafetyCategory): string {
  switch (category) {
    case 'self_harm':
      return SELF_HARM_ANSWER;
    case 'injection':
    case 'sexual':
    case 'illegal':
    case 'violence':
    case 'hate':
    case 'other':
      return BEYOND_SCOPE_ANSWER;
    default: {
      const unhandled: never = category;
      return unhandled;
    }
  }
}
