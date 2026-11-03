import type { CigaretteLog, Goal } from '@/types';
import {
  dailyStats,
  dayShift,
  dowDistribution,
  hourDistribution,
  rollingAvgSticks,
  spendOn,
  sticksOn,
} from '@/domain/calc';
import { evaluateGoal } from '@/domain/goals';
import { generateInsights } from '@/domain/insights';
import { dayOfWeekShort, todayIst } from '@/lib/date';
import { formatInr } from '@/lib/format';

const DEMO_BRANDS = ['Brand A', 'Brand B', 'Brand C'] as const;
const TRIGGERS = ['stress', 'after_meal', 'social', 'boredom', 'work_break'] as const;
const MOODS = ['stressed', 'bored', 'calm', 'social', 'tired'] as const;

function isoForLocal(ymd: string, hour: number): string {
  const h = String(hour).padStart(2, '0');
  return `${ymd}T${h}:30:00+05:30`;
}

/** ~30 days of synthetic logs using fictional brand names only. */
function buildDemoLogs(): CigaretteLog[] {
  const today = todayIst();
  const logs: CigaretteLog[] = [];
  let id = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
    const ymd = dayShift(today, -dayOffset);
    const baseSticks = Math.max(3, Math.round(10 - dayOffset * 0.08 + (dayOffset % 5) * 0.3));
    const sessions = Math.min(baseSticks, 4);

    for (let s = 0; s < sessions; s += 1) {
      const brand = DEMO_BRANDS[s % DEMO_BRANDS.length]!;
      const hour = [8, 11, 15, 19, 21][s % 5]!;
      const qty = s === sessions - 1 ? Math.max(1, baseSticks - sessions + 1) : 1;
      const unitPrice = 16 + (s % 3);
      id += 1;
      logs.push({
        id: `demo-log-${id}`,
        tsUtc: isoForLocal(ymd, hour),
        localDate: ymd,
        localHour: hour,
        brandId: null,
        brandNameSnap: brand,
        variantSnap: 'Regular',
        quantity: qty,
        purchaseMode: 'single',
        packSize: null,
        totalPriceInr: unitPrice * qty,
        unitPriceInr: unitPrice,
        priceSource: 'estimated',
        triggerTag: TRIGGERS[s % TRIGGERS.length]!,
        moodBefore: MOODS[s % MOODS.length]!,
        moodAfter: null,
        craving: 4 + (s % 4),
        contextTag: null,
        notes: null,
        createdAt: isoForLocal(ymd, hour),
        updatedAt: isoForLocal(ymd, hour),
      });
    }
  }

  return logs.sort((a, b) => b.tsUtc.localeCompare(a.tsUtc));
}

export const DEMO_LOGS = buildDemoLogs();

export const DEMO_TODAY = todayIst();

export const DEMO_BASELINE = 10;

export const DEMO_GOAL: Goal = {
  id: 'demo-goal-1',
  type: 'daily_cap',
  targetValue: 8,
  currentBaseline: DEMO_BASELINE,
  startDate: dayShift(DEMO_TODAY, -14),
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: dayShift(DEMO_TODAY, -14),
  completedAt: null,
};

export const DEMO_LAST_SMOKE_ISO =
  DEMO_LOGS.find((l) => l.localDate === DEMO_TODAY)?.tsUtc ??
  DEMO_LOGS[0]?.tsUtc ??
  new Date().toISOString();

export function getDemoDashboardStats() {
  const todaySticks = sticksOn(DEMO_LOGS, DEMO_TODAY);
  const todaySpend = spendOn(DEMO_LOGS, DEMO_TODAY);
  const avgPerDay = rollingAvgSticks(DEMO_LOGS, DEMO_TODAY, 7);
  const weekBars = dailyStats(DEMO_LOGS, dayShift(DEMO_TODAY, -6), DEMO_TODAY).map((s) => ({
    label: dayOfWeekShort(s.date).slice(0, 2),
    value: s.sticks,
  }));
  const goalProgress = evaluateGoal(DEMO_GOAL, DEMO_LOGS, DEMO_TODAY);
  const insights = generateInsights(DEMO_LOGS, DEMO_TODAY);
  return {
    todaySticks,
    todaySpend,
    todaySpendLabel: formatInr(todaySpend, { compact: true }),
    avgPerDay,
    weekBars,
    goalProgress,
    topInsight: insights[0] ?? null,
  };
}

export function getDemoTrendsStats() {
  const startYmd = dayShift(DEMO_TODAY, -29);
  const stats = dailyStats(DEMO_LOGS, startYmd, DEMO_TODAY);
  const sticksLine = stats.map((s) => ({ label: s.date.slice(5), value: s.sticks }));
  const hours = hourDistribution(DEMO_LOGS, startYmd, DEMO_TODAY);
  const hourBars = hours.map((v, i) => ({ label: `${String(i).padStart(2, '0')}h`, value: v }));
  const dows = dowDistribution(DEMO_LOGS, startYmd, DEMO_TODAY);
  const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dowBars = dows.map((v, i) => ({ label: dowLabels[i] ?? '', value: v }));
  return { sticksLine, hourBars, dowBars };
}

export const DEMO_FAVORITE_BRANDS = DEMO_BRANDS.map((name, i) => ({
  id: `demo-brand-${i}`,
  name,
  isFavorite: true,
}));
