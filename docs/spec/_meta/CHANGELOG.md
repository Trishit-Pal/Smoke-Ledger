# Spec Changelog

Append-only. Newest first. One entry per `/spec-update` or `/spec-generate` run.

<!-- Format: ## <date> — <commit> ; then a bullet per section changed. -->

## 2026-11-03 — e974a1e
- security-privacy: Phase B final-review fixes. `delete-account` writes `consent_revoked` only after `deleteUser` succeeds (`user_id` null, props `{ hashed_user_id, reason: 'delete' }`), superseding the earlier "past the re-auth gate, before the erase" wording; spoken masks say "hidden" (`spokenMask`) on both the web live region and the mobile announcement; the discreet guard also counts "twice", "a couple of", "a dozen".
- goals-insights: the mobile store reloads the goals once when a reconcile transition was skipped.
- architecture: the route guard's cover is modal to VoiceOver and the content wrapper hides from TalkBack while it shows.
- identity-profile: verified only; the diff touched a stale `--warn-earth` comment in `SettingsClient.tsx`.
- Also updated outside the spec: `docs/legal/owner-actions.md` (step 3 note on when the withdrawal row is written).

## 2026-11-03 — 3d534c0
- security-privacy: Phase B review fixes recorded. Chat guard: digits in any script fold to ASCII, decimals must match a tool figure (rounding pass removed), a day of the month passes before an English month name, hour fields and `notes` verify no figure, "zero" and one/two/do before a unit count only in discreet mode, and discreet replies are English (prompt). Tools: free text is cleaned and capped once (`cleanText`, `TEXT_FIELD_MAX_CHARS` 60, notes 120), repeated tool rows get `#2`/`#3` ids. Web panel: focus on open/close and after an answer, the live region mirrors the newest answer masked, a late answer is dropped after any `clearTranscript` (clear counter), a consent card survives a server `consent_required`. Mobile Ask: keyboard offset, scroll to end, masked announcement, exit fallback, switch shows saved state. Delete re-auth: the mobile resume needs a per-user SecureStore record with a 10-minute expiry (lifecycle row `mobile.deleteIntent`); the `delete-account` function writes `consent_revoked` when the client sends `{ withdraw }`, mobile erase records the withdrawal only after success. Marketing consent: the old statement that a CHECK keeps `marketing_consent_at` NULL is superseded, see the data-model line below. New open gaps (migration unconfirmed live, web withdrawal still client-side and before the action, English-only date and word coverage), new tests listed.
- data-model: `marketing_consent_at` is now held NULL by the trigger `trg_user_profiles_marketing_consent_null` (`20261105110000`), which dropped the CHECK (23514 for older mobile builds); the trigger is documented beside the other profile triggers and the smoke checks listed; new open gap for the unapplied migration. This supersedes the CHECK described in the 2026-11-02 entry for e1a652d (history kept as written).
- architecture: the one mobile route guard (`src/lib/routeGuard.ts`, run from `app/_layout.tsx`; tabs layout no longer redirects); the store's goal writer is the conditional pair.
- auth: the mobile auth layout note points at the root route guard and says why auth routes stay open to signed-in readers.
- goals-insights: reconcile writes only active goals (`completeGoalIfActive`, `markGoalMet` with a target condition and merge onto current meta), a `skipped` list beside `applied` and `failed`, the Done date is read in the reader's zone, the max-target message groups digits by locale, `--warn-earth-ink` for web concern text; open gap for the meta read-then-write.
- identity-profile: mobile Settings switch for Ask the ledger shows saved state only.
- infra-ops: CI pins the Supabase CLI (`SUPABASE_CLI_VERSION` 2.122.1), checkouts do not persist credentials, smoke.sql also asserts the monotonic, completed-at and marketing triggers.
- celebrations: verified only; the diff touched warning colours (`--warn-earth-ink`) on Home and login, no celebration behaviour.
- Also updated outside the spec: `docs/architecture/marketing-consent.md` (amendment: CHECK replaced by a trigger; the 23514 warning is resolved).
- Not recorded in the spec: `--warn-earth-ink` is not described in DESIGN.md's token list (no section owns it beyond the goals note).

## 2026-11-03 — 467615f
- goals-insights: goal targets are bounded per unit (`maxTargetFor`: sticks 1 000, spend caps 100 000), through the schema, the create form's message and the database; a start or re-anchor proposal above the limit is dropped, not clamped.
- data-model: `goals_target_value_check` is per unit (`20261105100000_goal_target_by_unit.sql`, with a `smoke.sql` check); a new open gap says the migration is unapplied and, until it is, weekly or monthly spend caps over 1 000 are refused on save.
- security-privacy: the chat's kill switch is now a code-enforced release gate (`isChatPolicyLive`: Production and mobile release builds stay off until `LEGAL_VERSIONS.privacy` passes 2026-11-02; mobile dev builds exempt). The opt-in stores the notice version (`LEDGER_CHAT_NOTICE_VERSION`) instead of `true`, with a notice hash tripwire and `noticeVersion` on the audit event; web Settings hides the switch while the flag is off; the panel re-reads its state on every open. Records the earlier consent-gate edit to this section that had no entry (the versioned opt-in text, made in 5ace0ac). ADR: `docs/architecture/ledger-chat-consent-adr.md`. Tests and the open gap updated.
- architecture: the dock reads its state on every open, and Settings receives the server chat flag.
- identity-profile: the Settings › Privacy opt-in stores the notice version and web shows it only while the flag is on.
- glossary: Ledger Chat consent wording; new Notice version entry.
- Not recorded in the spec: mobile `textFaint` now meets WCAG AA (DESIGN.md already carries the values); no spec section owns `src/constants/theme.ts`.

## 2026-11-03 — 27c86cb
- security-privacy: Ask the ledger rewritten for web and mobile. New gates and shapes: `consent_outdated` (403) in the profile gate; `GET /api/ledger-chat` (own `ledger_chat_state` bucket, no model, returns only `{ consented, discreet, hideTotals, currency, locale, starters }`). `scope.ts` is the one list of what the chat may read and never reads, rendered into the prompt and the notice; the tool context is built from an allowlist (identity-leak test). Twelve tools (goal history, price history from entries, entry edit dates added). Number words count as figures and are blocked outright in discreet mode. Where it appears: the web dock (five pages, not Log, minimise as the device preference `sl_chat_dock_minimised`) and the mobile pill and `/ask` screen; mobile keeps the conversation in memory only. New invariants 19 and a longer 9 and 11, the CI specs, and an honest open gap: built but off, owner steps in owner-actions section 8.
- architecture: the `(app)` layout mounts the dock with the server flag only; mobile registers the `/ask` modal.
- identity-profile: Settings › Privacy holds the mobile opt-in switch for Ask the ledger; identity rows are outside the chat allowlist.
- infra-ops: the `responsive-e2e` job runs with `LEDGER_CHAT_ENABLED` and a functional step for the chat, dock, consent and goals specs; the mobile build flag and the blank `EXPO_PUBLIC_WEB_BASE_URL` in `eas.json`.
- celebrations: verified only; the Dashboard no longer carries its own Ask link (the layout dock replaced it). No celebration behaviour changed.
- glossary: Ledger Chat updated; Chat scope and Ask dock and Ask pill added.

## 2026-11-03 — 8398559
- data-model: erase also clears `mobile_changed_at` and old `deleted_at` stamps (`20261104140000_erase_profile_leftovers.sql`); country and currency kept as regional settings; the unapplied-migrations gap now runs to 140000.
- auth: post-auth routing honours an exempt next (the `/settings` delete-resume) when consents are outdated; "outdated" means older, not different.
- identity-profile: erase clears the mobile-change lock and old erase stamps; `acceptChangedTerms` never writes a version lower than the stored one.
- security-privacy: versions compare as ISO dates (same or newer is current) so web/mobile skew cannot loop; every null web session clears the localStorage stores while only `SIGNED_OUT` expires the auth cookies; erase leftovers; five unapplied migrations.

## 2026-11-03 — b4d45ae
- security-privacy: privacy V3 recorded. New subsections for retention (daily `purge_expired_records`, the `RETENTION` numbers, the pg_cron checks), error-log redaction, the lifecycle registry that drives web and mobile device clears, and consent (health-data consent, the re-consent gate and why it cannot loop, withdrawal, analytics-off deleting usage events, `legalEntity.ts` and the promises list). Erase now removes the three identity keys from the sign-in record, deletes the user's own error reports, no longer sets `deleted_at`, clears `health_data_consent_at` and is followed by a session refresh; the export is version 3 with the account block and error reports; per-user rate-limit keys are hashed; the erasure-proof row and a post-erase export are described correctly (the old "empty auditEvents" claim was wrong). Chat gains "Written by AI" and Clear conversation. Five new invariants, the V3 tests, and honest open gaps (migrations unapplied, `LEGAL_VERSIONS` unbumped behind the EU-representative gate, `discreetOn` not routed through the registry, lawyer questions). Sources add the privacy, consent and logger files.
- data-model: `health_data_consent_at`; `deleted_at` no longer set by erase; `delete_my_usage_events()` and `purge_expired_records()`; export version 3; retention notes on `audit_events`, `error_events` (redacted) and `usage_events`; hashed `rate_limit_counters` identities; audit rows survive erase for 12 months, not forever.
- identity-profile: erase reaches the sign-in record and refreshes the session; the health-data consent row and `acceptChangedTerms` beside `submitConsentStep`; re-consent now reaches onboarded users (the old open gap said it did not); locked fields explained in the policy.
- auth: post-sign-in routing and the middleware send outdated consents to `/consent`; `consentGateRedirect` exemptions; the wiring test.
- architecture: privacy modules in the layout, the native device clear on an explicit `SIGNED_OUT`, the shared `SESSION_STORAGE_KEY`, the exported brand-cache TTL, and retention/redaction notes in the table list.
- goals-insights: the first-suggestion "Not now" stamp is a registered device store, cleared on sign-out, erase, delete and withdrawal.
- glossary: Health-data consent, Re-consent, Retention tier, Erasure proof, Lifecycle registry.

## 2026-11-03 — 798a45b
- security-privacy: corrected the chat-alias claim (only the alias format is shared with Trends; the chat aliases by first appearance in its log page, Trends by spend rank); chart formatter wording now covers each chart's own channels (Line/Bar are aria-hidden); chartMasking covers every chart except the mood x trigger matrix and not the Line/Bar tooltips; BarChart `showYAxis` keeps the hour chart's axis hidden; donut tooltip and table show compact money with discreet off; Home last-entry label drops the variant under discreet (`lastEntryLabel`); heatmap titles read "1 log" with discreet off.
- celebrations: re-stamped; the diff touched mobile Home's last-entry label only, no celebration behavior changed.
- DESIGN.md: masking rule updated to match.

## 2026-11-02 — 13fe5cf
- celebrations: full re-verify against the code. Fixed stale line references, the "only test is age.test.ts" claim (now also achievements and milestone-overlay-styles tests), the web modal's scrolling overlay, onboarding burst counts and goal summary wording, and the mobile login's deleted-account notice; sources now list every file the section describes (mobile login, web MilestoneCelebration). Re-stamped current.
- security-privacy: new "Discreet mode: masking at the render site" subsection and invariant (sr-only tables, aria-labels, SVG titles, tooltips, brand aliases via `src/lib/discreet.ts`); chat log window is now one page of up to 2000 rows (model's `recent_entries` still 200); panel session lookup never rejects; open gaps record the visible heatmap peak hour, digit-free mobile captions, untested mobile chart wiring and the CI-only discreet e2e. Sources add `src/lib/discreet.ts` and `web/components/charts/**`.
- goals-insights: chat reads the 2000-row goal window; mood x trigger counts mask; the unmasked-sr-only-tables gap is closed (replaced by the known remaining items).
- architecture: `GOAL_WINDOW_LOG_LIMIT` is exported and shared with the chat route.
- DESIGN.md: the masking rule now names sr-only tables, aria-labels, SVG titles, tooltips, keys and brand aliasing.

## 2026-11-02 — 256c296
- goals-insights: met is live (`metOn` and a standing hold, else on_track; next step needs the hold too); Home "Off track." for goals with no over days; log window ceiling (one page of up to 2000 rows for goal loaders, web and mobile).
- architecture: dashboard and mobile boot/refreshLogs read goal windows in one page of up to 2000 rows (`getServerLogsPage`, `listLogsPage`).

## 2026-11-02 — 9d24456
- architecture: the session store reconciles goals on boot and refresh in the reader's zone and holds `pendingGoalMoments` / `goalsReconcileFailed`; web reconciles through `useGoalReconcile` on Home and /goals; `getTrendsPageData` loads active goals; goal engine in `src/domain`, `src/services` in the layout; `goals` table row updated.
- identity-profile: the goal step's fourth card "Suggest one later" (default while no goal type is chosen, hidden once a goal exists, Continue skips, done page wording).
- celebrations: only the GoalMoment passage was updated (it now also fires on automatic completion, "Quit day." / "Tapered.", once, from reconcile's applied list). The rest of the section was not re-verified (login page, AccountDeletedNotice, MilestoneCelebration, OnboardingDoneClient and the non-goal parts of Home changed since 1a40fb0), so it stays at 1a40fb0, status drifting, and needs a full re-verify.
- security-privacy: export carries `completedAt` per goal; chat reader-context lists goal state words; grant note for `goals_stamp_completed_at`. Re-verified and re-stamped.
- infra-ops: `goals.spec.ts` joins the authenticated e2e suite note. Re-verified and re-stamped.

## 2026-11-02 — 1a4c025
- goals-insights: rewrote the Goals subsection for adaptive goals — seven types (taper, spend-cap period), `readGoalMeta` and step history, the four-state vocabulary (rolling last 7 days, window clipped to the goal's start), holds (14 days, 10 logged), proposals and their maths, 14-day snooze, discreet masking, client-side reconcile on load (web hook, mobile store, failed writes surfaced), `completed_at`, Home line, first-goal suggestion, onboarding "Suggest one later", Trends cap line, chat `goal_status`. Replaced the stale "no goals management screen" and "only goals[0]" text; new invariants; sources widened to the new modules and screens; open gaps record the unmasked sr-only tables and mobile "Around X a day", no proposals for week/month caps, and completion on the next visit.
- data-model: `goals.completed_at`, trigger `goals_stamp_completed_at`, `taper` in the type CHECK, `meta_json` keys, export `completedAt`; corrected the `quit_date` `target_value` description (days, not an epoch day).
- glossary: Goal now lists seven types and the state; added Met, Taper, Proposal, Re-anchor.

## 2026-11-02 — b9ac848
- architecture, data-model, auth, identity-profile, logging, security-privacy: re-stamped after merging main (Ask the ledger, PR #103) into the onboarding re-entry branch; the security-privacy invariants now run 1–12 (the re-auth invariant is 12, the chat invariants keep 9–11). Settings gained the chat consent switch beside the analytics one (documented under security-privacy); no behaviour the other sections describe changed. celebrations stays drifting: its files come from the chat branch and were not re-verified.

## 2026-11-02 — e1a652d
- data-model, security-privacy: `marketing_consent_at` cleared (per-user audit) and locked by CHECK; ADR `docs/architecture/marketing-consent.md`.
- identity-profile: goal step abandons every stray onboarding goal after save; usage saves the country before advancing; consent retries never re-audit.
- security-privacy: the delete-account re-auth detour now finishes the deletion on mobile (login reads `reason=reauth`, returns to `DELETE_RESUME_PATH`), both platforms re-confirm with "Signed in again…" and say so when cancelled; new invariant 12 (a sign-in never deletes). Line refs for `delete-account/index.ts` refreshed.
- auth: mobile login's `reason` / `deleted` params.

## 2026-11-01 — e1a652d
- identity-profile: new "Onboarding: saving, going back, and coming back" section — shared `src/services/onboarding.ts` step writes (idempotent consent with audit-before-write, baseline/goal hydration from the server, goal edit-in-place, Keep and continue), one step-order source in `src/lib/onboardingSteps.ts` (`<=` gate, `effectiveOnboardingStep`/`resumeOnboardingRoute`, no redirect loop), `setFavorite`; onboarding globs added to the section's sources.
- data-model: `trg_user_profiles_onboarding_step_monotonic` + `onboarding_step_rank`; the step is written in the same UPDATE as each step's data and only moves forward.
- auth: post-sign-in routing resumes a consented, not-onboarded user at the saved step instead of `/onboarding/privacy`.
- logging: `setFavorite` beside `toggleFavorite`.
- security-privacy: grant discipline for SECURITY INVOKER trigger helpers (the rank helper must stay executable by `authenticated`).

## 2026-11-02 — fbd177e
- security-privacy: gate order now lists the profile gates before the limits; summary-based figures named; re-stamped after the review fix passes (masked narration, shared confirmed-email rule in src/lib/compliance, exact-match carve-out, abort budget).
- infra-ops: region corrected to cle1 (Cleveland, next to us-east-2); re-stamped.
- architecture: re-stamped — loaders unchanged since 020192b apart from the chat route wiring already described.

## 2026-11-02 — 020192b
- glossary: the "Insight" entry keeps "never an LLM" for insights and points at the new "Ledger Chat" entry (opt-in, separate, every figure from a tool, device-only transcript).
- goals-insights: Ledger Chat reads these functions through read-only tools and changes nothing here; new invariant that insights never call a model and tool outputs equal direct calls.
- security-privacy: new "Ask the ledger (third-party AI processor)" subsection (gate order, caller guard, consent key, limits, what the model sees and may say, nothing stored or logged, the discreet-mode egress exception to render-site masking); invariants 9–11; the chat test suites; sources gain web/app/api/**, web/lib/server/ledgerChat/**, src/domain/ledgerChat/** and the manifest now lists the real auth files instead of the stale web/lib/server/auth.ts.
- infra-ops: Hobby function limit corrected to 300 s; the five LEDGER_CHAT_* / ANTHROPIC_API_KEY variables, the route's maxDuration and region, the console spend cap, and the audit-record redeploy.
- architecture: re-stamped — the page loaders gained the ledgerChatEnabled / ledgerChatOptIn flags; the data paths described are unchanged.
- auth, identity-profile, celebrations: left drifting on purpose; their changed files come from commits already on main before this branch and were not re-verified here.

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
