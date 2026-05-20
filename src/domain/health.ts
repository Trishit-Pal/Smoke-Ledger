// Pure domain logic for smoke-free health milestones.
// Inputs: ISO timestamp of the most recent cigarette + "now". No I/O.

import { HEALTH_MILESTONES, type HealthMilestone } from '@/constants/milestones';

export interface MilestoneProgress {
  current: HealthMilestone | null;   // most recent reached milestone
  next: HealthMilestone | null;      // upcoming milestone
  minutesSinceLast: number;          // 0 if never smoked / unknown
  fractionToNext: number;            // 0..1
  minutesToNext: number;              // remaining minutes; 0 if no next
}

const MS_PER_MIN = 60_000;

export function minutesSince(lastSmokeIso: string | null | undefined, now: Date = new Date()): number {
  if (!lastSmokeIso) return 0;
  const t = Date.parse(lastSmokeIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_MIN));
}

export function milestoneProgress(
  lastSmokeIso: string | null | undefined,
  now: Date = new Date(),
): MilestoneProgress {
  const minutesSinceLast = minutesSince(lastSmokeIso, now);

  // milestones is sorted ascending by minutes
  let current: HealthMilestone | null = null;
  let next: HealthMilestone | null = null;
  for (const m of HEALTH_MILESTONES) {
    if (minutesSinceLast >= m.minutes) {
      current = m;
    } else {
      next = m;
      break;
    }
  }

  const prevMinutes = current?.minutes ?? 0;
  const nextMinutes = next?.minutes ?? prevMinutes;
  const span = Math.max(1, nextMinutes - prevMinutes);
  const fractionToNext = next ? Math.max(0, Math.min(1, (minutesSinceLast - prevMinutes) / span)) : 1;
  const minutesToNext = next ? Math.max(0, next.minutes - minutesSinceLast) : 0;

  return { current, next, minutesSinceLast, fractionToNext, minutesToNext };
}

/** Render-friendly "in 2h 15m" / "in 3 days" formatter for the next milestone. */
export function formatMinutesUntil(mins: number): string {
  if (mins <= 0) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  if (mins < 43200) {
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    return h === 0 ? `${d}d` : `${d}d ${h}h`;
  }
  if (mins < 525600) {
    const months = Math.floor(mins / 43200);
    return `${months} mo`;
  }
  const years = Math.floor(mins / 525600);
  return `${years}y`;
}
