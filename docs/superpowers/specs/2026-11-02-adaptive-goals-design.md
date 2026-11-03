# Adaptive goals — design

Date: 2026-11-02. Branch: `feat/goals-adaptive` off `main`. Plan: `docs/superpowers/plans/2026-11-02-adaptive-goals.md`. Decision record: `docs/architecture/adaptive-goals-adr.md`.

## Intent

A goal in Smoke Ledger should be anchored to what the ledger already knows. Today the create form asks for a number cold, progress is recomputed on every render and never recorded, nothing completes on its own, and a slipping goal only changes colour. The interview that produced this document named the root failure plainly: *"I didn't know what goal to set in the first place."*

After this work, the ledger proposes a target from the reader's own history, records when a cap has been held, offers the next step and waits for a yes, notes quietly when a pattern of misses sets in, and closes a goal itself only when its date arrives or its final taper step has been held. The register is unchanged: editorial, calm, honest. Terracotta for concern, never red. No badges, no streak-shaming, no notifications.

## Goals

- The create flow proposes a target derived from the last 14 days of entries, with the reader free to type their own.
- A daily-granularity cap held for 14 days (with real use) is marked **met** and a next step is offered.
- One day over the cap reads as *at risk*; three or more of the last seven days over reads as *off track* and offers a re-anchor to the real average.
- Goal state is visible on the goal card, in one quiet sentence on Home, and in Ask-the-ledger answers.
- Types: daily cap, **taper** (new), quit date, spend cap with a day / week / month period. Existing no-smoke window and weekly cap keep working.
- Quit-date goals complete on the date. Tapers complete when the final cap has been held 14 days.
- Completed and abandoned goals keep a `completed_at` and stay visible as history.
- The cap or taper line is drawn on the Trends sticks chart.
- Onboarding's goal step gains a default "Suggest one later" choice.
- Web and Expo mobile ship together; every rule lives in `src/domain`.

## Non-goals

- Push or in-app notifications of any kind.
- Automatic changes to a target without the reader's yes.
- Proposals for week- or month-period spend caps (deliberate ceiling; upgrade path is a per-period adherence function).
- A cron, edge function, or any new free-tier pressure.
- Redesigning the goals page's visual world; this is a refinement of the incumbent editorial surface.

## Anti-goals (failure even if it works)

- Copy that nags, congratulates loudly, or shames a slip.
- A reader who stops logging being told they "met" a goal.
- A spend figure leaking past discreet mode in any new sentence.
- A goal export that omits the new timestamp.

## Decisions

| # | Decision | Chosen | Why |
|---|---|---|---|
| D1 | Root problem | Create flow proposes a target from the ledger | The interview's stated pain |
| D2 | Auto-adjust | Mark met after 14 held days; **propose** next step; accept / edit / dismiss | "Inform, don't coerce" |
| D3 | Losing | 1 over day = at risk; ≥3 of last 7 = off track + re-anchor offer | One bad day is weather; a pattern is signal |
| D4 | Surfaces | Card, one Home line, chat answers; no notifications | Private journal, not a coach |
| D5 | Types | Daily cap, taper, quit date, spend cap (day/week/month) | What the reader asked for |
| D6 | Extras | Onboarding default "Suggest one later"; quiet met moment; history with `completed_at`; Trends cap line | Chosen in interview |
| D7 | Quit date | Completes on the date itself | Reader's call |
| D8 | Platforms | Web and mobile together, logic shared | Reader's call |
| D9 | Empty days | Count as under cap, but a hold needs ≥10 of 14 days logged | Quiet weeks count; an abandoned ledger does not |
| D10 | Taper end | Ledger proposes the first step only; final target is typed | A proposed destination would be coaching |

The builder's calls and their alternatives are in the decision record.

## State vocabulary

| State | Rule | Caption | Tone |
|---|---|---|---|
| on track | no over day in the last 7; today under 80% of the cap | On track | accent |
| at risk | 1–2 over days in the last 7, or today at 80% or more | At risk · over once this week | terracotta |
| off track | 3 or more over days in the last 7 | Off track · over 4 of the last 7 days | terracotta |
| met | 14 consecutive days at or under the cap ending yesterday, at least 10 of them logged, counted from the current step's start | Met · held 14 days | accent |

## Surface notes (Operate mode, refinement of the incumbent world)

- The goals page keeps its masthead, hairline sections, and `ProgressRing`. New elements use the shared primitives: `ChoiceRun` replaces the pill `TypePicker`; `MetricRow` carries "your last 14 days" and proposal figures.
- State captions use `editorial-caption`; tone comes from `--accent` or `--warn-earth` only. Text error states move from `text-danger` to `--warn-earth`.
- A proposal is a short ledger entry, not a card with a call to action: a hairline, a `MetricRow`, one Fraunces headline question, and two quiet buttons. "Not now" is a ghost button and is always present.
- Home gets one `text-small` sentence under the goal verse, linked to the goals page, and nothing when on track.
- Any new reveal uses the existing `editorial-stage` choreography; nothing new animates.
- Discreet mode: spend figures in any proposal or state sentence are replaced by `goalTypeLabel` wording.

## Constraints

- Free tier (Supabase, Vercel, EAS). No cron, no new per-request query on Home beyond the goals it already loads. Trends gains one indexed goals query.
- WCAG AA in both themes; touch targets 44px or more.
- Owner-only RLS; every write goes through the existing repo functions.
- India DPDP: export must include the new column; erase is unchanged.

## Left to the builder

- Exact placement and label of the dashed cap line on both chart implementations.
- Whether the mobile Trends screen has room for a cap legend on small phones.
- Playwright seed helper shape for goals.
