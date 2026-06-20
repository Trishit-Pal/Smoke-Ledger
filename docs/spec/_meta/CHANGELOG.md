# Spec Changelog

Append-only. Newest first. One entry per `/spec-update` or `/spec-generate` run.

<!-- Format: ## <date> — <commit> ; then a bullet per section changed. -->

## 2026-06-20 — 2fdf20b (re-stamp: spec sections advanced from pre-commit a752d3c to actual commit sha)
- architecture, data-model, auth, identity-profile, logging, celebrations, security-privacy: stamp-only advance; prose was already accurate to the 5-workstream commit (realtime sync, onboarding retention, India phone, themed gender, achievement cap)

## 2026-06-20 — a752d3c (realtime sync, form retention, India phone, themed gender, achievement cap; stamped pre-commit on feat/emotional-animations)
- architecture: added the realtime-sync data flow (RealtimeRefresher native+web → useSession.refresh*/router.refresh), the focus/foreground refetch fallback, the new `useOnboardingDraft` store, and `useSession.refreshAll`/`achievementDismissCount`
- data-model: realtime is now live — `cigarette_logs`/`goals`/`user_profiles` in `supabase_realtime` (migration 20260620130000, applied + verified), FULL replica identity on the two user_id-filtered tables; removed the stale "publication not applied" gap
- identity-profile: mobile number is India-only (`+91` + 10 digits, lead 6–9) via `normalizeIndianMobile`/`INDIA_MOBILE_RE` with fixed-prefix UI; gender now a themed `ThemedSelect` dropdown at signup
- celebrations: achievement modal + companion confetti suppressed after 2 deliberate dismissals per login session (`achievementDismissCount` on useSession, `src/lib/achievements.ts`); auto-timeout does not count
- auth, logging: stamped — gender widget / log-tab focus-refetch covered cross-section; no prose contradiction
- security-privacy: documented that realtime postgres_changes is gated by the same per-table RLS SELECT policies (no leak); REPLICA IDENTITY FULL is WAL-internal only

## 2026-06-19 — 996dae7 (acceptance test: /spec-update main → feat/living-spec-system)
- auth: sections already current; cross-device authCallback priority order (token_hash first) correctly reflected
- identity-profile: sections already current; DOB/18+ gate, immutability trigger, Feb-29 edge case all accurate
- security-privacy: sections already current; error_events constraint confirmed live, finding marked resolved
- architecture, data-model, celebrations, infra-ops: verified by drift check — no code changes since generation
- No rewrites needed: spec was generated from HEAD at time of commit 996dae7
