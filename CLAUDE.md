# Smoke Ledger India

## Design Context

This project has impeccable design context at the repo root. **Read before any UI work:**

- [`PRODUCT.md`](./PRODUCT.md) — register (**product**), users, purpose, brand personality, anti-references, design principles, a11y targets.
- [`DESIGN.md`](./DESIGN.md) — the visual system: tokens, palette, typography, spacing, components, motion.

Load-bearing facts (the rest is in those files):

- **Register:** product (app UI). A secondary marketing/landing surface exists — treat as `brand` only when working on it specifically.
- **Voice:** editorial / printed-journal — Fraunces display + DM Sans body, hairline rules, small-caps captions. Restrained color: teal accent (positive only) + terracotta `--warn-earth` for concern, **never alarm-red**.
- **Theme:** class-based, **defaults to dark**; verify contrast (WCAG AA) in both themes.
- **Anti-references — never drift toward:** gamified health-app (badges/confetti/streak-shaming), loud/promotional UI, clinical/medical dashboards.
- **Motion:** slow, gravitational reveals (no spring/bounce); every animation needs a `prefers-reduced-motion` fallback.
- **Shared editorial primitives live in `web/components/visual/`** (`SectionLabel`, `MetricRow`, `InlineRule`, `ChoiceRun`) — reuse them; don't re-implement the patterns inline.
- **Tokens, not literals:** spacing `xs…xxxl`, semantic color CSS-vars (`--bg`/`--text`/`--accent`/`--rule`…). INR currency, IST timezone throughout.
