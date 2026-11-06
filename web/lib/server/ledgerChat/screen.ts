// The order of the safety layers before a turn reaches a model: the free rules on the question,
// the rules on every earlier turn (planted replies are dropped), then the Groq classifier on what
// is left. Answers are checked separately, in turn.ts. ClassifierUnavailable from the classifier
// is not caught here: the route turns it into a calm 502 (fail closed).

import { screenHistory, screenText, type SafetyCategory } from '@/domain/ledgerChat/safety';
import type { ChatHistoryTurn } from '@/domain/ledgerChat/types';
import { classifyTurn, type ClassifyInput, type Verdict } from './classifier';

export type ScreenStage = 'rules' | 'classifier';

export type TurnScreen =
  | { ok: true; history: ChatHistoryTurn[]; droppedTurns: number }
  | { ok: false; category: SafetyCategory; stage: ScreenStage };

export async function screenTurn(
  input: ClassifyInput,
  classify: (input: ClassifyInput) => Promise<Verdict> = classifyTurn,
): Promise<TurnScreen> {
  const question = screenText(input.question);
  if (question.blocked) return { ok: false, category: question.category, stage: 'rules' };

  const { turns, dropped } = screenHistory(input.history);
  const verdict = await classify({ history: turns, question: input.question, signal: input.signal });
  if (!verdict.safe) return { ok: false, category: verdict.category, stage: 'classifier' };

  return { ok: true, history: turns, droppedTurns: dropped };
}
