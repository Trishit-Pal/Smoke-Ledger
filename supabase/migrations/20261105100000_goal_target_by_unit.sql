-- Goal targets are bounded per unit, not flat.
--
-- goals_target_value_check capped every goal at 1000. A weekly or monthly spend cap
-- is money per period (Rs 200 a day -> Rs 1,260 a week), so it was proposed and
-- accepted by the app, then rejected on save. Sticks stay at 1000; spend caps may
-- go to 100000. src/lib/validation.ts (MAX_STICK_TARGET / MAX_MONEY_TARGET) mirrors
-- these numbers and a test keeps them equal.
--
-- Idempotent: drop-if-exists then add. Every existing row already satisfies the
-- new, wider-or-equal bound, so the ADD validates cleanly.

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_target_value_check;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_target_value_check
  CHECK (target_value > 0 AND target_value <= CASE WHEN type = 'spend_cap_daily' THEN 100000 ELSE 1000 END);
