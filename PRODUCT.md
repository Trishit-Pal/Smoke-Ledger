# Product

## Register

product

> Primary surface is the in-app product experience. A secondary marketing/landing
> surface exists; override to `brand` per-task when working specifically on it.

## Users

People in India who smoke and want to see the truth of the habit — how many sticks, how
much money, when and why — so they can cut down or quit. They often open the app in a
private, even furtive moment: right after a cigarette, or reflecting late at night. Many
are sensitive about the habit itself, which is why the app ships discreet mode, app-lock,
and "hide totals on home" — a glance over the shoulder is a real part of the threat model.
Currency is INR in India and EUR when the reader chooses an EU country. The calendar follows that country. An account with no country stays on INR and India time. The job on any given screen is small and
concrete: log one stick honestly, or read back what the ledger already knows.

## Product Purpose

Smoke Ledger India is a calm, honest ledger of cigarette consumption and the money it
costs. It exists to replace vague guilt with specific awareness — a quiet record the user
keeps for themselves, not a coach that nags. Success is the user trusting the numbers
enough to act on them: logging consistently, watching the trend bend downward, and feeling
supported rather than judged. A small marketing surface introduces the app to new users,
but the heart of the product is the private daily ledger.

## Brand Personality

Editorial, restrained, honest — the voice of a well-set printed journal. Fraunces headlines
over hairline rules, small-caps captions, "the ledger" and "today's entry" as section
language. Three words: **literary, calm, truthful.** It acknowledges milestones with a brief,
muted moment — never on a marketing path — and never alarms with red; a rising trend is rendered in terracotta, not emergency. The
emotional goal: the user feels respected and a little more clear-eyed each time they open it.

## Anti-references

- **Gamified health apps** — badges, streak-shaming, congratulatory gradients, the
  "nag-and-reward" loop. Progress is acknowledged quietly, never celebrated loudly.
- **Loud / promotional UI** — urgency banners, persuasion CTAs, marketing patterns pushed
  into the app surface. This is a private journal, not a conversion funnel.
- **Clinical / medical dashboards** — sterile vitals charts, hospital blues, anxiety-red
  alerts. Data is reflective reading, not a diagnosis.

## Design Principles

1. **A private journal, not a public scoreboard.** Discretion is a feature, not an
   afterthought — masking, app-lock, and hide-totals are first-class. Default to calm.
2. **Honest over alarmist.** Show the real number. Signal concern with restraint
   (terracotta, not red); reserve the accent teal for genuinely positive moments.
3. **Editorial restraint carries the design.** Typography, hairlines, and rhythm do the
   work that color and chrome do elsewhere. When in doubt, remove an element rather than add.
4. **Motion with depth, never gimmick.** Slow, gravitational reveals (no spring, no bounce);
   every animation has a reduced-motion alternative. Delight lives in the easing, not effects.
5. **Respect the user's autonomy.** Inform, don't coerce. No dark patterns, no guilt, no
   manufactured urgency — the user is quitting for themselves, on their own terms.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Body text ≥4.5:1, large text ≥3:1, verified in both light and the
**default dark** theme. `prefers-reduced-motion` is honored throughout (reveals degrade to
crossfade/instant). Native controls are theme-tied via `color-scheme` so date and select
popups stay legible in dark mode. Touch targets ≥44px. Discreet/masking modes must never
drop contrast below AA. Content follows the reader's country: rupees and India time, or euros and that country's time.
