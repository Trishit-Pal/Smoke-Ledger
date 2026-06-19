---
section: identity-profile
sources:
  - src/domain/age.ts
  - src/lib/mobileNumber.ts
  - src/lib/profileLabels.ts
  - src/lib/validation.ts
  - src/db/repositories/profile.ts
  - app/(tabs)/settings.tsx
  - web/app/(app)/settings/**
last_verified_commit: fcabb85
status: current
---

# Identity & Profile

## Purpose

The profile is where the user is a person, not just a set of logs. It holds the identity fields collected at signup — name, date of birth, gender — and the optional contact and location fields they can fill in later. Because this is a tobacco-tracking app, the profile is also where the 18+ age gate lives. That gate isn't a courtesy check; it is the reason the whole identity system exists.

## What the user experiences

During signup, the user enters their full name, date of birth, and gender. The date of birth is the only field the app uses to compute anything — their age, visible in Settings. If the date of birth indicates they are under 18, the account is never created: they see a rejection, not a dashboard.

Once inside, the Settings screen shows a **Profile** section with five rows:

- **Name** — displayed, no edit control. Set once and done.
- **Age** — displayed as "X years", derived live from the stored date of birth. No edit control.
- **Gender** — displayed, no edit control.
- **Mobile number** — editable in-place. The Edit link is hidden when the 30-day change window is still open; when it is hidden, the sublabel shows the exact date the next change becomes available.
- **Place** — editable in-place, no rate-limit.

The three read-only rows look visually identical to the editable ones — same hairline-rule table, same label-left / value-right layout — except there is no "Edit" link next to them. The UI does not explain why they cannot be changed; it simply doesn't offer the option.

## How it works

### Identity fields and their types

The six profile identity columns are all added by the migration `supabase/migrations/20260616181124_profile_identity_fields.sql`. The TypeScript side lives in `src/types/index.ts:99` (`UserProfile`) and is mirrored in the Zod schema at `src/lib/validation.ts:165` (`ProfileSchema`).

| Column | DB type | JS field | Editable after signup |
|---|---|---|---|
| `full_name` | `text` | `fullName` | No |
| `date_of_birth` | `date` | `dateOfBirth` | No |
| `gender` | `text` (enum-checked) | `gender` | No |
| `mobile_e164` | `text` | `mobileE164` | Yes, once per 30 days |
| `mobile_changed_at` | `timestamptz` | `mobileChangedAt` | Server-owned |
| `place` | `text` | `place` | Yes, unlimited |

Age is never stored. When Settings needs to display it, the UI calls `computeAge(profile.dateOfBirth)` at render time (`app/(tabs)/settings.tsx:812`, `web/app/(app)/settings/SettingsClient.tsx:546`). This guarantees the displayed age is always correct, even if the user leaves the app open across a birthday. The gender options are `male`, `female`, `other`, and `undisclosed`; the last one is labeled "Prefer not to say" in the UI (`src/lib/profileLabels.ts:4`).

### The 18+ age gate

The gate operates at two points, and both fail closed.

**At signup** — `handle_new_user()` is an `AFTER INSERT` trigger on `auth.users` (`supabase/migrations/20260616181124_profile_identity_fields.sql:129`). When the signup payload contains a `date_of_birth` field, the trigger tries to cast it to a Postgres `date`. If the cast fails for any reason — malformed string, impossible calendar date — it raises `SQLSTATE 22007` (`invalid_date_of_birth`) and the entire `auth.users` insert is rolled back. The user account is never created; there is no profile row, no email row, nothing. If the cast succeeds but the date implies an age under 18, the trigger raises `SQLSTATE 23514` (`underage_signup`) with the same result. A `NULL` or absent date of birth is the legacy path that skips the gate entirely; it does not produce a rejection.

**On a subsequent profile update** — if a user somehow arrives at the profile-completion form with no date of birth already stored (the admin or legacy path), the `enforce_profile_identity_rules()` `BEFORE UPDATE` trigger (`supabase/migrations/20260616181124_profile_identity_fields.sql:79`) fires when `date_of_birth` is being set for the first time. It repeats the same `> (current_date - interval '18 years')` check and raises `underage` (`SQLSTATE 23514`) if the date fails.

On the TypeScript side, the pure function `isAdult(dobIso, today)` in `src/domain/age.ts:80` also implements the gate for the client. It returns `false` — not an error — for any input that cannot be parsed, any impossible calendar date (like 2000-02-30), and any future date. This is the fail-closed principle: doubt means no. The `computeAge` function underneath it uses calendar parts rather than millisecond arithmetic (`src/domain/age.ts:65`), which means leap years and DST cannot accidentally advance or retard the boundary. The one non-obvious case is someone born on 29 February: in a non-leap year, their birthday is treated as 1 March, which is the conservative choice — they turn 18 one day later, not one day earlier (`src/domain/age.ts:53`).

### Immutability of name, date of birth, and gender

Once any of the three identity fields is set to a non-null value, the DB trigger `trg_user_profiles_identity_rules` (created on `user_profiles`, calling `enforce_profile_identity_rules()`) blocks any attempt to change it. The check is direct:

```sql
IF OLD.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name THEN
  RAISE EXCEPTION 'identity_immutable: full_name' USING ERRCODE = '42501';
END IF;
```

The same pattern applies to `date_of_birth` and `gender` (`supabase/migrations/20260616181124_profile_identity_fields.sql:86`–`94`). The error code `42501` (insufficient privilege) maps in `mapDbError` to `authorization_error` (`src/db/repositories/_supabase.ts:43`).

Why enforce this at the DB level rather than the application level? Because the RLS UPDATE policy is intentionally wide — `id = auth.uid()` — and cannot express per-column restrictions. Any authenticated request that reaches the `user_profiles` table can update any column it names. The trigger is the only place where the column-level intent of "set once" can actually be enforced. The repository comment at `src/db/repositories/profile.ts:98` acknowledges this explicitly.

The client-side representation is consistent: the Settings screen uses a `ReadonlyRow` component (defined at `app/(tabs)/settings.tsx:416`) for name, age, and gender. This component renders the same label-value layout as an editable row but contains no "Edit" link. The web settings page does the same thing with a plain `<span>` and no edit state for those three fields (`web/app/(app)/settings/SettingsClient.tsx:683`–`691`).

### Mobile number — the 30-day rate limit

The mobile number is optional and user-editable, but only once per 30 days. The limit is enforced in two places.

**In the DB trigger** — `enforce_profile_identity_rules()` checks whether `mobile_e164` is changing. If it is, and `mobile_changed_at` is not null and is within the last 30 days, the trigger raises `SQLSTATE 54000` (`mobile_rate_limited`). If the change is allowed, the trigger sets `NEW.mobile_changed_at := now()` server-side before committing. The final line in the else branch is equally important: if `mobile_e164` is *not* changing, `mobile_changed_at` is pinned to `OLD.mobile_changed_at` — the client cannot submit a stale or forged timestamp to reset the window (`supabase/migrations/20260616181124_profile_identity_fields.sql:105`–`112`).

**In the client** — `canChangeMobile(mobileChangedAt, now)` in `src/lib/mobileNumber.ts:53` computes the same 30-day window client-side, using `THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000`. Settings uses this to decide whether to render the Edit link at all: if `canChangeMobile` returns false, the link is hidden and the sublabel shows the next-available date via `nextMobileChangeDate` (`app/(tabs)/settings.tsx:815`–`820`; `web/app/(app)/settings/SettingsClient.tsx:550`–`555`). The client check is a UX improvement only — it prevents the user from trying something that will fail — but the DB trigger is the actual enforcement.

When a save does fail because the window is still open, both the mobile and web UIs catch the `rate_limited` AppError code and surface the message "You can change your mobile number only once every 30 days" as a specific string rather than the generic error copy (`app/(tabs)/settings.tsx:517`, `web/app/(app)/settings/SettingsClient.tsx:466`).

The error code path is: DB raises `54000` → PostgREST forwards → `mapDbError` at `src/db/repositories/_supabase.ts:45` maps `54000` to `rate_limited` AppError → UI catches `isAppError(e) && e.code === 'rate_limited'`.

### Input validation

Input is validated in two places before it reaches the database.

**Zod** (`src/lib/validation.ts`) defines `ProfilePatchSchema` which is a partial of `ProfileSchema`. The profile schema enforces:
- `fullName`: trimmed, 1–80 characters, strip null bytes
- `dateOfBirth`: matches `YmdSchema` — `YYYY-MM-DD` regex, then a round-trip through `Date.UTC` to reject calendar-impossible dates like `2000-02-30` (`src/lib/validation.ts:20`–`35`)
- `gender`: one of the four allowed values
- `mobileE164`: matches `^\+[1-9]\d{7,14}$` or null
- `place`: trimmed, max 80 characters, or null

The schema is strict — unknown keys are rejected (`src/lib/validation.ts:188`). `updateProfile` in the repository calls `parseOrThrow(ProfilePatchSchema, defined, 'profile')` before issuing any DB write (`src/db/repositories/profile.ts:87`).

**E.164 normalisation** (`src/lib/mobileNumber.ts`) runs client-side in the save handler before the number reaches `updateProfile`. Bare 10-digit Indian numbers are prefixed with `+91`; numbers with separators like spaces and dashes are compacted. If the result doesn't match the E.164 regex, the function returns null and the UI rejects the input immediately with "Enter a valid mobile number" — before any DB call is made (`app/(tabs)/settings.tsx:506`–`509`).

The DB also has a `CHECK` constraint backing up the E.164 format: `mobile_e164 ~ '^\+[1-9][0-9]{7,14}$'` (`supabase/migrations/20260616181124_profile_identity_fields.sql:65`). It should never fire in practice because the application layer normalises first, but it is there as a final backstop.

### Profile row lifecycle

When a new user signs up, `handle_new_user()` creates the `user_profiles` row, populating `full_name`, `date_of_birth`, and `gender` from `raw_user_meta_data` (`supabase/migrations/20260616181124_profile_identity_fields.sql:168`). The insert uses `ON CONFLICT (id) DO NOTHING` so re-running the trigger (which shouldn't happen) is safe.

If `getProfile()` in the repository is called and finds no row — possible if the trigger ran before the columns existed — it upserts one with just the `id` (`src/db/repositories/profile.ts:71`–`76`). This is a defensive fallback, not the expected path.

`mobile_changed_at` is never written by the client. The repository comment at `src/db/repositories/profile.ts:102`–`103` is explicit: "mobile_changed_at is server-owned and deliberately never written from the client." The row-mapping function at `src/db/repositories/profile.ts:54` reads it back for the client to use in the rate-limit UI, but it only flows server → client, never the other way.

## Invariants

These must never break.

1. **Gate before the row.** An account for a user under 18 must never exist. The `handle_new_user` trigger must abort the `auth.users` insert, not just leave a flagged row.

2. **Fail closed on bad input.** `isAdult` returns false for any DOB it cannot parse. `handle_new_user` raises an exception (aborting the insert) for any DOB it cannot cast. Neither function treats an unparseable date as a missing date.

3. **Identity fields are write-once.** Once `full_name`, `date_of_birth`, or `gender` is set to a non-null value in `user_profiles`, no UPDATE can change it. The DB trigger enforces this; the application layer must not attempt to bypass it.

4. **Mobile number changes at most once per 30 days.** The DB trigger owns the window. The client may not supply `mobile_changed_at` in any write; the trigger sets it server-side and pins it when the number is unchanged.

5. **Age is derived, never stored.** There is no `age` column. `computeAge` is always called at use time. Storing a number and leaving it to grow stale is not an option.

6. **The E.164 format is enforced in two layers.** Zod validates before the DB call; the DB `CHECK` constraint validates at write time. A number that reaches the DB without a `+` and a non-zero country code should not be storable.

## Edge cases & gotchas

**Feb 29 birthdays.** `computeAge` reduces correctly: someone born on 2000-02-29 becomes 18 on 1 March 2018 in a non-leap year, not 28 February. The test at `src/tests/age.test.ts:21` pins this. The `isBirthdayToday` function follows the same convention, so their in-app birthday also triggers on 1 March in non-leap years.

**The 42501 ambiguity.** The DB trigger for immutability raises `SQLSTATE 42501`, which is the same code as a genuine RLS policy violation. Both map to `authorization_error` in `mapDbError`. From the user's perspective the message is identical ("something went wrong"); the distinction only matters in server logs.

**The client-side rate-limit check can be wrong.** `canChangeMobile` reads `profile.mobileChangedAt`, which comes from the last `getProfile()` call. If the user changes their number on another device and then tries to change it on this one without refreshing, the client-side check may show the Edit link when the DB will reject the change. The DB trigger always wins; the client check is an optimistic short-circuit.

**Partial profile rows.** When `handle_new_user` fires before the identity columns existed (i.e., on accounts created before migration `20260616181124`), the row will have null for all six identity fields. Those accounts get the legacy signup path — they can set identity fields once via the profile-completion form, and the first-set 18+ check in the `BEFORE UPDATE` trigger applies.

**`mobile_changed_at` is read-only from the client.** The `rowToProfile` function in the repository reads `mobile_changed_at` from the DB row (`src/db/repositories/profile.ts:54`), and `updateProfile` never includes it in the outbound `row` object (`src/db/repositories/profile.ts:92`–`108`). A client that tried to send it would see the field silently dropped, not a DB error.

**Zod trims and strips null bytes before the DB.** `ProfileSchema` applies a `.transform()` to string fields that strips ` ` characters and trims whitespace (`src/lib/validation.ts:51`–`55`). An empty-after-trim name is rejected (`min(1)` on the `BoundedString` pipe). This means `updateProfile({ fullName: '   ' })` is caught by the schema and never reaches the DB.

## Tests

**Age gate unit tests** — `src/tests/age.test.ts` covers `computeAge`, `isAdult`, and `isBirthdayToday` with cases for normal adults, exact 18th birthday, the day before turning 18, Feb-29 leap-year corner cases, and malformed / impossible dates. The test explicitly asserts `MIN_AGE === 18` so a constant change would be caught.

**Mobile number unit tests** — `src/tests/mobileNumber.test.ts` covers `normalizeToE164` (including bare 10-digit numbers, separator stripping, missing-`+` prefix, and rejection of junk), `nextMobileChangeDate` (null for never-set, correct `+30 days` computation, null for unparseable input), and `canChangeMobile` (allow when never set, block inside the window, allow once the window has elapsed).

**Profile schema unit tests** — `src/tests/validation.profile.test.ts` exercises `ProfilePatchSchema` for valid and invalid values of each identity field: name length bounds, DOB format and calendar-validity, gender enum, mobile E.164 format, place length, and strict rejection of unknown keys.

**RLS integration tests** — `src/tests/rls.integration.test.ts` runs against a real Supabase project (skipped when `E2E_*` env vars are absent) and asserts cross-user data isolation at the row level. It does not specifically target identity fields, but it does confirm that the `user_profiles` RLS policy (`id = auth.uid()`) prevents one authenticated user from reading or writing another's profile.

## Open gaps

**No application-layer test for trigger enforcement.** The immutability and mobile rate-limit logic in `enforce_profile_identity_rules()` is covered by the migration itself and the comments in the repository, but there is no test that deliberately calls `updateProfile` with a changed `fullName` and asserts an `authorization_error` AppError comes back. The RLS integration tests do exercise DB-level errors, but they are scoped to cross-user isolation. A targeted integration test for the immutability trigger would close this gap.

**No test for `handle_new_user` age-gate enforcement.** The `isAdult` function is well-tested. The DB trigger logic that actually aborts the signup is not exercised by the test suite. Testing it requires calling Supabase Auth's sign-up endpoint with a minor DOB, which is possible via the integration test client pattern already in `rls.integration.test.ts` but not currently done.

**`mobile_changed_at` visible in the client.** The field is read back from the DB and surfaced in `UserProfile` (`src/types/index.ts:119`). In the export flow (`exportAccountData`), if this field is included in the export envelope, it reveals the exact timestamp of the user's last mobile change. The current `ImportProfileSchema` (`src/lib/validation.ts:246`) does not include `mobile_changed_at`, so it is not round-tripped on import, but it may still appear in raw export payloads — worth checking when the export schema is next reviewed.

**No Supabase MCP access for live schema verification.** The live DB schema for `user_profiles` was read from the migration files, not confirmed via MCP (the project permissions denied the `list_tables` call during spec generation). The migration `20260616181124_profile_identity_fields.sql` is the authoritative source, but live schema drift is not currently detectable from this tooling.
