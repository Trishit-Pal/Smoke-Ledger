# Smoke Ledger India — Product Specification ("The Mother Book")

This is the single authoritative description of what Smoke Ledger India does and
the rules it must never break. It is generated from the real code and kept
current by `/spec-update`. If the code and this book disagree, that is a bug in
one of them — file it.

## Sections
- [Glossary](00-glossary.md)
- [Architecture](01-architecture.md)
- [Data model](02-data-model.md)
- [Authentication](03-auth.md)
- [Identity & profile](04-identity-profile.md)
- [Logging](05-logging.md)
- [Goals & insights](06-goals-insights.md)
- [Celebrations](07-celebrations.md)
- [Security & privacy](08-security-privacy.md)
- [Infrastructure & ops](09-infra-ops.md)

## How this stays accurate
Each section declares, in `_meta/spec-manifest.json`, the code it is responsible
for. After a change, run `/spec-update` to refresh only the sections that diff
touched. `npm run spec:drift` reports any section whose code moved without its
spec being refreshed.
