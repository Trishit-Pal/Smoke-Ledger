# Spec Changelog

Append-only. Newest first. One entry per `/spec-update` or `/spec-generate` run.

<!-- Format: ## <date> — <commit> ; then a bullet per section changed. -->

## 2026-11-02 — e1a652d
- data-model, security-privacy: `marketing_consent_at` cleared (per-user audit) and locked by CHECK; ADR `docs/architecture/marketing-consent.md`.
- identity-profile: goal step abandons every stray onboarding goal after save; usage saves the country before advancing; consent retries never re-audit.
- security-privacy: the delete-account re-auth detour now finishes the deletion on mobile (login reads `reason=reauth`, returns to `DELETE_RESUME_PATH`), both platforms re-confirm with "Signed in again…" and say so when cancelled; new invariant 8 (a sign-in never deletes). Line refs for `delete-account/index.ts` refreshed.
- auth: mobile login's `reason` / `deleted` params.

## 2026-11-01 — e1a652d
- identity-profile: new "Onboarding: saving, going back, and coming back" section — shared `src/services/onboarding.ts` step writes (idempotent consent with audit-before-write, baseline/goal hydration from the server, goal edit-in-place, Keep and continue), one step-order source in `src/lib/onboardingSteps.ts` (`<=` gate, `effectiveOnboardingStep`/`resumeOnboardingRoute`, no redirect loop), `setFavorite`; onboarding globs added to the section's sources.
- data-model: `trg_user_profiles_onboarding_step_monotonic` + `onboarding_step_rank`; the step is written in the same UPDATE as each step's data and only moves forward.
- auth: post-sign-in routing resumes a consented, not-onboarded user at the saved step instead of `/onboarding/privacy`.
- logging: `setFavorite` beside `toggleFavorite`.
- security-privacy: grant discipline for SECURITY INVOKER trigger helpers (the rank helper must stay executable by `authenticated`).

## 2026-10-31 — e52ffac
- architecture, auth, identity-profile, infra-ops: re-stamped after merging the scene-tiers and responsive/chart-accessibility work into main alongside the security dependency PR; no behaviour these sections describe changed.
- CHANGELOG: entries added by earlier stamp scripts had been inserted inside the Format comment (hidden); moved out under an intact comment.

## 2026-10-31 — 42c2ee6
- auth: Next 15 async request APIs, phoneOtpState.ts split, version-specific Next 14.2 claims marked as not re-checked, two new open gaps.
- infra-ops: audit job now blocks on critical and lists the known high-severity leftovers.
- architecture, identity-profile: re-stamped (server helpers now awaited; settings page awaits searchParams); no described behaviour changed.

## 2026-10-31 — f1ab5c4
- infra-ops: re-stamped after the dependency restore (root package.json, lockfiles, dependabot.yml); no infrastructure behaviour changed.

## 2026-10-31 — 3a97c1f
- auth: re-stamped — error pages use dvh instead of vh; no behaviour the section describes changed.

## 2026-10-31 — 1a40fb0
- all stale stamps: re-pointed at a commit that exists after the stack was rebased (earlier entries cite pre-rebase hashes); no spec prose changed.

## 2026-10-31 — 94fa89d
- identity-profile: ThemedSelect now returns focus to its trigger and uses accent ink for the selected option.
- auth, celebrations, infra-ops: re-stamped after the design pass (token-only colour swaps on auth pages, landing CTA no longer fires confetti on hover, framer-motion removed); no behaviour these sections describe changed.
- architecture: re-stamped — /log now redirects to the Ledger (/history) and its loader getLogPageData is gone; the History data path described here is unchanged.

## 2026-10-31 — 6268c8d
- architecture: ledgerToday / ledgerDaysAgo beside ledgerTimeZone in the session store.
- data-model: cigarette_logs UPDATE is a column grant; created_at, id, user_id, client_op_id fixed.
- identity-profile: native insights, goals and mood matrix in the profile currency; comma decimals.
- logging: native "today" in the ledger zone; edits cannot rewrite the rate-limit window.
- celebrations: re-verified (Home today and money wiring only).
- security-privacy: column-level UPDATE closes the created_at cap bypass.

## 2026-10-31 — c3ec7a1
- architecture: ledger zone for local_date/local_hour; hashed, purged rate-limit counters.
- data-model: region table, country/currency trigger and RPCs, anon default-deny, erase clears identity, logs written only via the RPC.
- auth: confirm-before-redeem email links, reauth route, phone sign-in opt-in, one link-type parse.
- identity-profile: country picker (non-euro EU hidden), reset/onboarding region fixes, native ledger money, erase clears identity.
- logging: local date/hour and backdate picker follow the ledger zone on web and native; INSERT only through the RPC.
- goals-insights: spend caps and brand evidence in the ledger currency.
- celebrations: re-verified; streak and dashboard flow unchanged by the money/zone work.
- security-privacy: logs-RPC-only, anon default-deny, legal pages force-dynamic for the nonce CSP, tightened headers, phone opt-in.
- infra-ops: CI repaired (was 0 jobs), pinned actions, gitleaks and advisory audit jobs, weekly posture audit, Dependabot.

## 2026-10-30 — uncommitted on cc9f3a5 (security hardening phase 1; partial update, sections not re-stamped)
- auth: no sign-in surface enumerates accounts any more (password copy is generic, email-link treats an unknown address as sent); `auth_email_exists` lookup removed; login rate limits are per IP, per email+IP and 30/h per email; email-link `type` allowlist via `parseEmailOtpType`; erase is the one bypass of identity immutability.
- security-privacy: anon default-deny (grants + default privileges + PUBLIC EXECUTE); rate-limit identities stored as keyed hashes, one-time purge of pre-hashing rows, pg_cron daily purge; edge functions fail closed without `AUDIT_PEPPER`; erase hash is now `uid:pepper` and clears identity fields with a `prior_identity_erased` audit flag.

## 2026-09-21 — bf62af4 (web login unknown-email vs wrong-password)
- auth: web password sign-in calls service-role RPC `auth_email_exists` after `invalid_credentials` and shows “No ledger for this email.” vs “That password doesn't match this email.” Lookup is a total function (`lookupAuthEmail` never throws): timeout/throw/missing RPC fail-close to the combined copy. Email-link (web and native) maps GoTrue unknown-user errors the same way and tells the truth on send success. Password reset, phone OTP, and native password stay generic. Web `sendEmailOtp` uses the same `withTimeout` catch as resend.
- security-privacy: 16th public `SECURITY DEFINER` function `auth_email_exists` (`search_path ''`, EXECUTE only `service_role`, reads `auth.users`). Operator must `npm run db:push` the migration before the password split is live.

## 2026-07-06 — a979537 (catch-up sync: dashboard timeframe hub, goal moments, hardening audit closure)
- architecture: session store gained the canonical daily-summary slice (`summary`/`summarySinceYmd`), goal CRUD wrappers, and `listAllGoals` boot; RealtimeRefresher now also subscribes to `brands`/`brand_variants` with deliberate native/web parity; web `getDashboardData` fetches the daily summary as the timeframe source of truth
- data-model: `v_daily_summary_user` is `SUM(quantity)` not `COUNT(*)`; realtime publication now includes `brands`/`brand_variants` (REPLICA IDENTITY FULL); log rate-limit window counts on server-set `created_at`; `smoking_facts` is 28 facts with the new `cravings` category; `erase_account_data` is fail-closed on an unset `app.audit_pepper` GUC
- auth: verification bump only — auth pages gained the WebGL `SceneBackdrop` and aria-labels; no behavioral change
- identity-profile: verification bump — mobile paste-tolerance and error copy were already documented; replaced a literal NUL byte in prose with the `\u0000` escape so text tooling stops treating the file as binary
- logging: documented the 24h backdate cap (`MAX_BACKDATE_MS` schema refinement + `BackdateTimeField`), the `created_at` rate-limit window fix it necessitated, and `resolveLogUnitPrice` (typed per-stick price is authoritative)
- goals-insights: `listActiveGoals` removed in favor of `listAllGoals`; one active-or-paused goal per type enforced in `createGoal` (`AppError('conflict')`); `updateGoal` + `GoalPatchSchema` added; dashboards pick the first active goal, dedicated goals screens manage the rest
- celebrations: added the `GoalMoment` overlay (completion "Well kept." / deletion "No judgment.", self-dismissing, no confetti) and its mood-bus events; streak now derives from `streakFromRows(summary)` so it no longer truncates at the 90-day log window
- security-privacy: realtime brands tables noted; `created_at` rate-limit gotcha; **open gap: `app.audit_pepper` found unset on live (2026-07-05) — erase fails P0001 until the operator sets the GUC**
- infra-ops: new "migration ledger lies" section pointing at `docs/deployment/migration-ledger-map.md` (2026-07-05 audit: all repo migrations verified live; drift is cosmetic re-stamping)

## 2026-06-20 — f1bd2bb (web bug-fix follow-up: truthful errors, contact-number save, post-signup data sync)
- identity-profile: mobile field is now paste-tolerant (`toLocalMobileDigits`) with as-you-type validation gating, Save disabled until valid, and a precise inline message; failures render through `describeError` (specific per-code copy, no raw-Postgres leak) instead of the `toSafeErrorMessage` catch-all; rate-limit copy shows the exact next-change date; live DB schema confirmed via MCP (closed the prior "no MCP verification" gap)

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
