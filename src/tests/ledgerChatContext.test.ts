import { CONTEXT_PROFILE_FIELDS, buildToolContext } from '@/domain/ledgerChat/context';
import { TOOL_NAMES, runTool, type ToolName } from '@/domain/ledgerChat/tools';
import { userContextBlock } from '@web/lib/server/ledgerChat/prompt';
import type { CigaretteLog, Goal, UserProfile } from '@/types';

// Guardrail 2 (allowlisted context): identity never reaches the model payload.
const TODAY = '2026-06-21';

const IDENTITY = {
  fullName: 'Zephyrine Quillfeather',
  dateOfBirth: '1987-03-14',
  gender: 'female',
  mobileE164: '+919876543210',
  place: 'Kalimpong Hills',
} as const;
const EMAIL = 'zephyrine.q@example.test';

const profile = {
  baselinePerDay: 10,
  baselineWindowDays: 7,
  currency: 'INR',
  discreetMode: false,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  country: null,
  ...IDENTITY,
  // Not a UserProfile field, but a mapper change could let one through.
  email: EMAIL,
} as UserProfile;

const logs: CigaretteLog[] = [
  {
    id: 'l1',
    tsUtc: '2026-06-21T03:30:00.000Z',
    localDate: '2026-06-21',
    localHour: 9,
    brandId: 'b1',
    brandNameSnap: 'Gold Flake',
    variantSnap: 'Kings',
    quantity: 2,
    purchaseMode: 'single',
    packSize: null,
    totalPriceInr: 40,
    unitPriceInr: 20,
    priceSource: 'exact',
    triggerTag: 'stress',
    moodBefore: 'stressed',
    moodAfter: null,
    craving: 3,
    contextTag: null,
    notes: 'a long day',
    createdAt: '2026-06-21T03:30:00.000Z',
    updatedAt: '2026-06-21T05:00:00.000Z',
  },
];

const goals: Goal[] = [
  {
    id: 'g1',
    type: 'daily_cap',
    targetValue: 5,
    currentBaseline: 10,
    startDate: '2026-06-01',
    endDate: null,
    status: 'active',
    meta: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    completedAt: null,
  },
];

const TOOL_INPUTS: Record<ToolName, unknown> = {
  compare_periods: { window: 'week' },
  totals_in_window: { startYmd: '2026-06-01', endYmd: TODAY },
  savings: {},
  spend_outlook: {},
  when_and_why: {},
  brand_mix: {},
  goal_status: {},
  insights: {},
  recent_entries: { days: 30 },
  goal_history: {},
  price_history: {},
  entry_edits: {},
};

const prices = [{ brandName: 'Gold Flake', unitPriceInr: 18, packSize: 10, observedAt: '2026-06-01T04:00:00.000Z' }];

function payloads(discreet: boolean): string[] {
  const ctx = buildToolContext({
    profile: { ...profile, discreetMode: discreet },
    logs,
    rows: [{ date: TODAY, sticks: 2, spendInr: 40, avgUnitPriceInr: 20 }],
    goals,
    goalHistory: [...goals, { ...goals[0], id: 'g0', status: 'completed', completedAt: '2026-05-01T00:00:00.000Z' }],
    prices,
    today: TODAY,
    summarySinceYmd: '2026-01-01',
  });
  return [
    JSON.stringify(ctx),
    userContextBlock(ctx),
    ...TOOL_NAMES.map((name) => JSON.stringify(runTool(name, TOOL_INPUTS[name], ctx))),
  ];
}

describe('ledger chat context allowlist', () => {
  it('copies only the allowlisted profile fields', () => {
    expect([...CONTEXT_PROFILE_FIELDS].sort()).toEqual(['baselinePerDay', 'country', 'currency', 'discreetMode']);
  });

  it.each([false, true])('no identity value reaches the context, the context block or any tool (discreet %s)', (discreet) => {
    const all = payloads(discreet).join('\n');
    for (const value of [...Object.values(IDENTITY), EMAIL, 'Zephyrine', '1987', '9876543210']) {
      expect(all).not.toContain(value);
    }
    for (const key of [...Object.keys(IDENTITY), 'email']) {
      expect(all).not.toContain(`"${key}"`);
    }
  });

  it('every tool ran ok, so the scan above saw real output', () => {
    const ctx = buildToolContext({ profile, logs, rows: [], goals, today: TODAY, summarySinceYmd: '2026-01-01' });
    for (const name of TOOL_NAMES) expect(runTool(name, TOOL_INPUTS[name], ctx).ok).toBe(true);
  });
});
