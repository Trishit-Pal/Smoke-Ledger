# ADR-0001: Retire the misrecorded marketing-consent stamps

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Product owner (Trishit); DPDP and RLS reviewers on the migration

## Context

`user_profiles.marketing_consent_at` was added in 2026-05 for a marketing opt-in that was never built. Nothing in the app reads it, shows it, or sends marketing. It is, however, included in every data export (`export_account_data()` dumps the profile row).

The only code that ever wrote it was the old mobile consent screen, which set it from the **analytics** checkbox: `marketingConsentAt: analyticsOptIn ? now : null`. Web never wrote it. The shared consent service introduced on branch `fix/onboarding-reentry-sync` correctly stopped writing it, but that left existing stamps in place. Every non-null value is therefore a consent the user never gave, and users who later turned analytics off still carry it, visible in their own export.

The `user_profiles` UPDATE policy is row-wide (`id = auth.uid()`), so any signed-in client can still write the column directly with supabase-js. That is the same reason identity immutability and the onboarding-step order are enforced in the database.

## Decision

Migration `20261102120000_clear_marketing_consent.sql`:

1. In one statement, set every non-null `marketing_consent_at` to NULL and insert one `marketing_consent_cleared` compliance audit row per affected user (props: `{ reason: 'analytics_opt_in_misrecorded' }`, no timestamp or other PII). The event type is server-only and is absent from every client audit registry.
2. Add `CHECK (marketing_consent_at IS NULL)` so no role can set it again.

App code loses the write path: `ComplianceConsentPatch` no longer has `marketingConsentAt`. The read mapping stays so types and exports match the column.

## Options considered

### A. Clear, audit, and lock with a CHECK (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low: one SQL file, one field removed |
| Cost | None at runtime |
| Reversibility | Drop one constraint |
| Data honesty | Exports stop showing a consent nobody gave |

**Pros:** smallest change that makes the record true and keeps it true for every client, including stale builds and direct API calls. **Cons:** a pre-branch mobile build would fail its consent step for analytics opt-ins once the CHECK lands (see Consequences).

### B. Build a real opt-in toggle
| Dimension | Assessment |
|---|---|
| Complexity | Medium: UI on web and mobile, audit events, copy, tests |
| Cost | Ongoing maintenance |
| Value today | None: nothing sends marketing |

**Cons:** builds a consent surface for a feature that does not exist, which invites users to grant a permission with no purpose (DPDP purpose limitation).

### C. Drop the column
| Dimension | Assessment |
|---|---|
| Complexity | Medium: export and erase SQL functions, types, tests |
| Reversibility | Needs a new column and a backfill story later |

**Cons:** churns compliance-critical functions (`export_account_data`, `erase_account_data`) for no user-visible gain over A.

### Alternatives for the lock
A trigger or column-level grant could also block writes. A CHECK binds every role (including `service_role`), needs no function grants, and is one line to reverse.

## Trade-off analysis

A wins because it corrects the data and prevents recurrence with the least moving parts, and its one downside, rejecting stale clients, is the intended behaviour: a client that would write a false consent should fail loudly rather than succeed silently.

## Consequences

- **Easier:** exports and audits are truthful; no client path, old or new, can record marketing consent.
- **Harder:** shipping a real marketing opt-in now requires dropping the constraint in the same migration that adds the feature and its own audit event.
- **Revisit:** before applying to a shared project, confirm no pre-branch mobile build is still in use, or ship the app update first. A build that predates this branch sends `marketing_consent_at = now()` when analytics is ticked and will get a Postgres 23514 on the privacy step.

## Action items

1. [x] Migration with per-user audit and CHECK; source-guard tests in `src/tests/security-migrations.test.ts`.
2. [x] Remove the write path from `src/db/repositories/profile.ts`; type-level test in `src/tests/onboardingService.test.ts`.
3. [ ] Count affected rows on each project before applying (`select count(*) from user_profiles where marketing_consent_at is not null`), then verify the audit count matches afterwards.
4. [ ] Confirm the live mobile build includes this branch before applying to production.
