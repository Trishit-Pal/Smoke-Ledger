// Transparent rules-based insights engine.
// Every insight includes evidence and an explanation; no "AI" claims.

import type { CigaretteLog, Insight } from '@/types';
import { brandSpendMix, dowDistribution, hourDistribution, trendVsBaseline } from './calc';
import { dayShift } from './calc';
import { todayIst } from '@/lib/date';
import { makeId } from '@/lib/id';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Whole-unit money for evidence lines. Callers pass the ledger's currency formatter. */
const formatRupeesWhole = (amount: number): string => `₹${amount.toFixed(0)}`;

export function generateInsights(
  logs: CigaretteLog[],
  today = todayIst(),
  money: (amount: number) => string = formatRupeesWhole,
): Insight[] {
  const out: Insight[] = [];
  const start30 = dayShift(today, -29);

  if (logs.length < 3) {
    out.push({
      id: makeId('ins'),
      title: 'Log a few entries to unlock insights',
      explanation: 'Insights appear once you have at least 3 logs across different days.',
      evidence: `Total logs: ${logs.length}`,
      confidence: 'high',
      severity: 'info',
      generatedAt: new Date().toISOString(),
    });
    return out;
  }

  // 1. Time-of-day dominance
  const hours = hourDistribution(logs, start30, today);
  const totalHours = hours.reduce((a, b) => a + b, 0);
  if (totalHours > 0) {
    const peakHour = hours.indexOf(Math.max(...hours));
    const windowSum =
      hours[(peakHour - 1 + 24) % 24]! + hours[peakHour]! + hours[(peakHour + 1) % 24]!;
    const share = windowSum / totalHours;
    if (share >= 0.25) {
      out.push({
        id: makeId('ins'),
        title: `You smoke most between ${peakHour}:00 and ${(peakHour + 1) % 24}:00`,
        explanation:
          'A 3-hour window around your peak hour accounts for a large share of your recent smoking.',
        evidence: `${Math.round(share * 100)}% of last 30 days' sticks fell in hours ${
          (peakHour - 1 + 24) % 24
        }:00–${(peakHour + 2) % 24}:00.`,
        confidence: share >= 0.4 ? 'high' : 'medium',
        severity: 'watch',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. Trigger concentration
  const triggerCounts = new Map<string, number>();
  for (const l of logs) {
    if (l.triggerTag) triggerCounts.set(l.triggerTag, (triggerCounts.get(l.triggerTag) ?? 0) + 1);
  }
  const totalTagged = Array.from(triggerCounts.values()).reduce((a, b) => a + b, 0);
  if (totalTagged >= 5) {
    const [topTag, topCount] = Array.from(triggerCounts.entries()).sort((a, b) => b[1] - a[1])[0]!;
    const share = topCount / totalTagged;
    if (share >= 0.3) {
      out.push({
        id: makeId('ins'),
        title: `"${humanTrigger(topTag)}" is your most tagged trigger`,
        explanation: 'Identifying dominant triggers can help you plan small replacements.',
        evidence: `${topCount} of ${totalTagged} tagged logs (${Math.round(share * 100)}%).`,
        confidence: 'medium',
        severity: 'watch',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // 3. Reduction trend (last 7 vs prior 30)
  const delta = trendVsBaseline(logs, today, 7, 30);
  if (delta.baselinePerDay > 0) {
    const pct = Math.round(delta.deltaPct);
    if (pct <= -10) {
      out.push({
        id: makeId('ins'),
        title: `Your daily average is down ${Math.abs(pct)}% vs your 30-day baseline`,
        explanation: 'Compared to the previous 30 days, your last 7 days average is lower.',
        evidence: `7-day avg: ${delta.currentPerDay.toFixed(1)}/day vs baseline: ${delta.baselinePerDay.toFixed(1)}/day.`,
        confidence: 'high',
        severity: 'info',
        generatedAt: new Date().toISOString(),
      });
    } else if (pct >= 15) {
      out.push({
        id: makeId('ins'),
        title: `Daily average is up ${pct}% vs your 30-day baseline`,
        explanation: 'The last 7 days show higher consumption than your baseline.',
        evidence: `7-day avg: ${delta.currentPerDay.toFixed(1)}/day vs baseline: ${delta.baselinePerDay.toFixed(1)}/day.`,
        confidence: 'high',
        severity: 'act',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // 4. Brand concentration
  const mix = brandSpendMix(logs, start30, today);
  if (mix.length && mix[0]!.share >= 0.4) {
    out.push({
      id: makeId('ins'),
      title: `${mix[0]!.brand} is ${Math.round(mix[0]!.share * 100)}% of your monthly spend`,
      explanation: 'One brand dominates your recent spending. Useful for budgeting decisions.',
      evidence: `${money(Math.round(mix[0]!.spendInr))} on ${mix[0]!.brand} in last 30 days.`,
      confidence: 'high',
      severity: 'info',
      generatedAt: new Date().toISOString(),
    });
  }

  // 5. Day-of-week dominance
  const dows = dowDistribution(logs, start30, today);
  const dowTotal = dows.reduce((a, b) => a + b, 0);
  if (dowTotal >= 7) {
    const peakIdx = dows.indexOf(Math.max(...dows));
    const dowShare = dows[peakIdx]! / dowTotal;
    if (dowShare >= 0.22) {
      out.push({
        id: makeId('ins'),
        title: `You smoke more on ${DOW_LABELS[peakIdx]}s`,
        explanation: 'Smoking appears concentrated on a specific day of the week.',
        evidence: `${DOW_LABELS[peakIdx]} holds ${Math.round(dowShare * 100)}% of sticks in last 30 days.`,
        confidence: dowShare >= 0.3 ? 'high' : 'medium',
        severity: 'watch',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return out;
}

function humanTrigger(tag: string): string {
  return tag.replace(/_/g, ' ');
}
