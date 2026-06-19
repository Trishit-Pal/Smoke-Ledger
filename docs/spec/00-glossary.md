---
section: glossary
sources: []
last_verified_commit: fcabb85
status: manual
---

# Glossary

## Purpose
A shared vocabulary for Smoke Ledger India. Every other section in this book
leans on these words. When the product, the code, and a conversation all use
"baseline" or "streak" to mean exactly the same thing, the rest of the spec gets
much easier to trust. This file is maintained by hand — it is not regenerated
from a single source — so if a definition here drifts from the code, fix it
here and in the offending section.

A note on framing: this app tracks cigarette consumption without nagging. The
language is deliberately calm and non-judgemental — "quieter", not "clean";
"baseline", not "limit you broke". That tone is a product decision, and it
shows up in the terms below.

## The terms

### Cigarette log (a "log")
One recorded smoking event. It is the atom of the whole app — almost every
number elsewhere is an aggregation of logs. A log always carries a brand (the
one truly required field), a quantity of sticks, a UTC timestamp, and a derived
local date and local hour. It optionally carries price, a trigger, a mood
before and after, a craving rating, a context, and a free-text note. The shape
lives in `src/db/repositories/logs.ts:18` (`Row`) and the create path enforces
the brand requirement at `src/db/repositories/logs.ts:208`. Logs are written
through an atomic, rate-limited RPC, never a raw insert.

### Stick
A single cigarette. Quantities are counted in sticks throughout the domain
layer (see `sticksOn` and `rollingAvgSticks` in `src/domain/calc.ts`). We say
"sticks" rather than "cigarettes" in code because a single log can record more
than one, and because the savings and goal maths are all per-stick.

### Baseline
Your normal rate of smoking, used as the reference point for "are you doing
better than usual?". It is almost always a rolling average over a trailing
window of days — 30 days for the headline baseline (`deriveBaselinePerDay` in
`src/domain/savings.ts:75`), 7 days for the "current" side of a comparison.
Crucially, baseline is *derived from history*, not a number the user types and
forgets. One exception: a reduction goal can *lock* a baseline at the moment the
goal is created (`current_baseline`), so progress is measured against where you
started, not a baseline that keeps sliding as you improve
(`src/domain/goals.ts:127`).

### Streak
A run of consecutive days that satisfy some condition, counted backwards from a
given day until the condition first fails (`streak` in
`src/domain/calc.ts:219`). The most important one is the **smoke-free streak**:
consecutive days with zero sticks (`smokeFreeStreak`,
`src/domain/calc.ts:241`). That function deliberately anchors its count at your
earliest log so a brand-new or freshly-wiped account can't report an infinite
streak from a sea of empty days. Streaks are what trigger milestone
celebrations.

### Milestone
A noteworthy point worth celebrating. There are two distinct families, and they
are easy to confuse:

- **Streak milestones** — reaching 1, 3, 7, 14, or 30 days under baseline. The
  tiers and their copy live in `MILESTONE_TIERS`
  (`src/lib/character/mood.ts:78`), looked up by `milestoneForStreak`. These
  fire the celebration modal.
- **Health milestones** — the body's recovery timeline since your last
  cigarette, from "20 minutes" up to "15 years"
  (`src/constants/milestones.ts:32`, evaluated by
  `src/domain/health.ts`). These are informational, attributed to public-health
  bodies (CDC / NHS / American Lung Association), and explicitly *not* medical
  advice.

A birthday is also surfaced as a milestone type in the celebration bus
(`type: 'birthday'`), separate from streaks.

### Mood
How the user felt, captured in two places. First, on a log: `moodBefore` /
`moodAfter` chosen from a fixed vocabulary — calm, stressed, bored, social,
tired, anxious, neutral (`src/constants/moods.ts`). This is self-reported
emotional context, and it feeds the mood × trigger correlation surface. Second,
and unrelated in meaning, there is the **character mood** — the expression of
the on-screen companion (greet, regret, applaud, victory, breathe, and so on),
dispatched over an in-memory event bus (`Mood` type in
`src/lib/character/mood.ts:11`). Same word, two different concepts: one is the
user's feeling, the other is the mascot's face. When precision matters, say
"log mood" or "character mood".

### Trigger
The thing that prompted a cigarette, tagged on a log from a fixed list:
morning, after a meal, stress, boredom, social, tea/coffee, alcohol, work
break, other (`src/constants/triggers.ts`). Triggers are the most behaviourally
useful tag we collect — the insights engine looks for a dominant trigger
(`src/domain/insights.ts`, "trigger concentration") and the correlation engine
crosses triggers against moods (`moodTriggerMatrix`,
`src/domain/correlations.ts`). The point is gentle self-knowledge: "stress is
40% of your tagged logs" is more actionable than a raw count.

### Context
Where/with whom a cigarette happened — alone, with friends, work break,
commute, after a meal, stress, party, tea/coffee, alcohol, other
(`src/constants/contexts.ts`). Context overlaps with trigger by design (both can
say "after meal"); trigger answers *why*, context answers *the setting*. It is
optional and used for richer breakdowns rather than the core insights.

### Goal
A user-set target the app evaluates against their logs. Six types exist, each
with its own progress maths in `evaluateGoal` (`src/domain/goals.ts:35`):
daily cap on sticks, daily spend cap in INR, a no-smoke time window, a weekly
stick cap, a reduction target (lower your daily average to N), and a quit date.
Every evaluation returns the same `GoalProgress` shape — a percent, an
`isOnTrack` flag, an `atRisk` softer warning, remaining headroom, and a plain
explanation — so the UI renders every goal type uniformly.

### Savings
Money framed two ways, both fully transparent so the user can trust the number
(`src/domain/savings.ts`). **Potential savings** is the money you *didn't spend*
by smoking below baseline — sticks avoided times average unit price.
**Actual savings** compares expected daily spend against what you really spent.
Both are surfaced with their formulas because an opaque "you saved ₹X" invites
distrust.

### Insight
A short, rules-based observation about your habits — "you smoke most between
18:00 and 19:00", "your daily average is down 20% vs your 30-day baseline". They
are generated by an explicit, transparent engine (`src/domain/insights.ts`),
never an LLM, and every insight ships with its supporting evidence and a
confidence level. The deliberate absence of any "AI" claim is a trust decision.

### Pepper
A server-only secret (`AUDIT_PEPPER`) mixed into a user ID before it is hashed
with SHA-256 for long-lived audit rows (`sha256Hex` in
`supabase/functions/_shared/hash.ts`; usage documented in
`docs/runbooks/audit-pepper-rotation.md`). It is *not* a per-record salt — it is
one shared secret. Its job: let ops prove "a deletion happened" and correlate
events for the same user, without ever storing the raw UUID, and in a way that
survives account deletion because once `auth.users` is purged there is no public
counterpart left to reverse the hash against. Rotating it strengthens
anonymisation at the cost of forensic continuity across the rotation boundary.

### RLS (Row-Level Security)
Postgres's per-row access control, and the backbone of this app's multi-tenant
safety. Every tenant table has RLS enabled so that a query only ever sees rows
belonging to the authenticated user — the isolation is enforced in the database,
not trusted to application code. The live audit confirms all 13 public tables
have it on (`docs/security/sovereignty-audit-2026-06.md`, §1).
`rate_limit_counters` is the deliberate special case: RLS on, *no* policy, which
is a hard default-deny reachable only by the service role.

### DPDP
India's Digital Personal Data Protection framework. Smoke Ledger India runs a
"DPDP-best-effort" posture for a pre-launch, solo-operated app: real data-export
and data-erasure paths exist, and the audit design (the pepper above) is built
so a deletion can be *proven to have happened* without retaining re-identifiable
data. It is the privacy north star behind the delete-account flow and the
sovereignty audit, not a claim of full formal compliance.

### Keyset pagination
The cursor-based way logs are paged. Instead of `OFFSET`/`LIMIT` (which gets
slower and can skip or repeat rows as data shifts), each page returns a
`nextCursor` of `{ ts, id }`, and the next request asks for rows *after* that
key (`listLogsPage` and `LogCursor` in `src/db/repositories/logs.ts:144`).
This stays fast at any depth and is stable under concurrent inserts. The older
flat `listLogs` helper is a thin wrapper that warns when it hits its page cap,
nudging callers to migrate to the paginated path.

### IST / local date / local hour
Everything user-facing is anchored to India Standard Time (`Asia/Kolkata`,
`src/lib/date.ts:13`). A log stores its true UTC timestamp but also a derived
**local date** (`YYYY-MM-DD` in IST) and **local hour** (0–23 in IST), because
"how many today?" and "what hour do you smoke most?" only make sense in the
user's wall-clock day. The domain layer does date arithmetic as pure string
math (`dayShift`) to avoid timezone drift.

### Character / companion
The small on-screen figure (the masthead companion, milestone celebration, and
logout farewell) that reacts to what you do. It listens on an in-memory event
bus — `DeviceEventEmitter` on React Native, a parallel implementation on web —
so any screen can dispatch a mood, a milestone, or a farewell without threading
props or context (`dispatchMood` / `dispatchMilestone` / `dispatchFarewell` in
`src/lib/character/mood.ts`). It is the app's emotional layer; the celebrations
section covers it in full.

### Brand / variant
What was smoked. A **brand** is the make (e.g. a cigarette brand); a **variant**
is a specific product under it. Logs store a snapshot of the brand and variant
names (`brandNameSnap`, `variantSnap`) so historical entries keep reading
correctly even if the catalogue changes later. Brand is the single mandatory
field on every log.

### 18+ gate
The age check at signup. Because this is a tobacco-tracking app, accounts
require age ≥ 18 (`MIN_AGE` in `src/domain/age.ts:10`). Age is always derived
from date of birth, never stored as a stale integer, and the check compares
calendar parts — so leap years and DST can't nudge the boundary. The gate
**fails closed**: an unparseable or future date of birth is treated as *not*
adult (`isAdult`, `src/domain/age.ts:80`).

## Open gaps
- This glossary is hand-maintained (`status: manual`) and declares no source
  globs, so `npm run spec:drift` cannot flag it when the underlying code moves.
  If a term's code reference here goes stale, nothing automated will catch it —
  re-read it whenever the domain layer changes meaningfully.
- "Mood" is genuinely overloaded (log mood vs. character mood). The code keeps
  them in separate modules, but the shared word is a standing trap; this entry
  is the disambiguation of record.
