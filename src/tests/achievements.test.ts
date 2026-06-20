import { MAX_ACHIEVEMENT_DISMISSALS, isAchievementSuppressed } from '@/lib/achievements';

describe('achievement suppression rule', () => {
  it('caps deliberate dismissals at 2 per session', () => {
    expect(MAX_ACHIEVEMENT_DISMISSALS).toBe(2);
  });

  it('does not suppress before the cap is reached', () => {
    expect(isAchievementSuppressed(0)).toBe(false);
    expect(isAchievementSuppressed(1)).toBe(false);
  });

  it('suppresses once the cap is reached or exceeded', () => {
    expect(isAchievementSuppressed(2)).toBe(true);
    expect(isAchievementSuppressed(3)).toBe(true);
  });
});
