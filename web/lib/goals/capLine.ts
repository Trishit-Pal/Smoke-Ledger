import { capSeries } from '@/domain/goalForm';
import type { Goal } from '@/types';

export interface CapPoint {
  label: string;
  value: number;
  cap?: number | null;
}

/** The goal whose cap the Trends line chart draws: first active daily cap or taper. */
export function pickCapGoal(goals: readonly Goal[]): Goal | null {
  return goals.find((g) => g.status === 'active' && (g.type === 'daily_cap' || g.type === 'taper')) ?? null;
}

/**
 * Points with the cap in force on each date. `perDay` must be false when a point
 * aggregates several days (a daily cap against a weekly sum would be false), in
 * which case the points come back unchanged.
 */
export function withCapLine<T extends CapPoint>(
  points: T[],
  goal: Goal | null,
  dates: readonly string[],
  perDay: boolean,
): (T & CapPoint)[] {
  if (!goal || !perDay) return points;
  const caps = capSeries(goal, dates);
  return points.map((p, i) => ({ ...p, cap: caps[i] ?? null }));
}

export function hasCapLine(points: readonly CapPoint[]): boolean {
  return points.some((p) => typeof p.cap === 'number');
}
