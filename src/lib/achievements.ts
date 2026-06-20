// Per-login-session suppression rule for achievement/celebration animations.
// After the user deliberately dismisses an achievement this many times in a
// single session, further achievement animations are suppressed for the rest
// of that session. The counter lives in the in-memory session store (reset on
// logout), so it naturally resets per login. Pure + side-effect free.

export const MAX_ACHIEVEMENT_DISMISSALS = 2;

/** True once the user has hit the per-session deliberate-dismissal cap. */
export function isAchievementSuppressed(dismissCount: number): boolean {
  return dismissCount >= MAX_ACHIEVEMENT_DISMISSALS;
}
