# Shared Domain Schemas

All Zod validation schemas for domain objects (cigarette logs, goals, brands,
profiles) live exclusively in **`src/lib/validation.ts`**.  This file is the
single source of truth for every field constraint, enum value, and parse rule
that can affect the database.

The web app (`web/`) reaches these schemas through the `@/*` TypeScript path
alias declared in `web/tsconfig.json`:

```json
"paths": {
  "@/*":    ["../src/*"],
  "@web/*": ["./*"]
}
```

So `import { CigaretteLogSchema } from '@/lib/validation'` in a Next.js file
resolves to `src/lib/validation.ts` — the same module the React Native app
imports.  No validation logic is duplicated or overridden in `web/`.

Web form components perform lightweight in-form checks (e.g. `Number.isFinite`
on a price string) before calling repository functions.  The repositories
themselves always call `parseOrThrow(DomainSchema, input, label)` before any
database write, so the canonical constraints are enforced regardless of the
calling surface.

Auth-form schemas (email/password format for login and signup) are intentionally
kept local to each surface because they have different concerns (UI field length
vs. RFC compliance vs. server-side identity-provider limits) and are not domain
schemas.

**Regression test:** `src/tests/web-schemas-shared.test.ts` asserts that the
`@/lib/validation` and `../lib/validation` import paths resolve to the same
module reference.  This test will fail if anyone introduces a shadow schema in
`web/` or breaks the tsconfig alias.
