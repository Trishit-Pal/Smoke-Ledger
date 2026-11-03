import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_MONEY_TARGET, MAX_STICK_TARGET } from '@/lib/validation';

const NAME = '20261105100000_goal_target_by_unit.sql';
const sql = readFileSync(join(__dirname, '../../supabase/migrations', NAME), 'utf8').replace(/\r\n/g, '\n');

describe(NAME, () => {
  it('drops the old flat CHECK idempotently and re-adds it per unit', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS goals_target_value_check/);
    expect(sql).toMatch(/ADD CONSTRAINT goals_target_value_check/);
  });

  it('uses the same limits as src/lib/validation.ts so SQL and Zod cannot drift', () => {
    const m = sql.match(
      /target_value > 0 AND target_value <= CASE WHEN type = 'spend_cap_daily' THEN (\d+) ELSE (\d+) END/,
    );
    expect(m).not.toBeNull();
    expect(Number(m?.[1])).toBe(MAX_MONEY_TARGET);
    expect(Number(m?.[2])).toBe(MAX_STICK_TARGET);
  });
});
