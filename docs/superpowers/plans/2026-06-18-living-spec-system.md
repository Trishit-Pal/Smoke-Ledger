# Living Specification System — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-repo, modular "mother book" specification under `docs/spec/` that is generated from the real code, kept current by a token-bounded on-demand updater, and guarded against drift by a tested CI script.

**Architecture:** A small set of zero-dependency Node ESM libraries (`scripts/spec/lib/`) provide the pure logic — manifest validation, glob matching, code→section mapping, and drift computation — each unit-tested with `node:test`. A `drift-check` CLI wires those libraries to git. Two Claude skills sit on top: `/spec-generate` (a resumable multi-agent Workflow that writes the book from real evidence) and `/spec-update` (refreshes only the sections a diff touches). A JSON manifest maps each spec section to the code globs it owns; that map is what makes every operation cheap.

**Tech Stack:** Node ≥ 18.13 ESM (`.mjs`), `node:test` + `node:assert/strict` (no Jest, no new runtime deps), git CLI, Claude Code skills + Workflow.

## Global Constraints

Every task implicitly includes these:

- **Zero new runtime dependencies.** The spec tooling is plain Node ESM. No npm installs. Glob matching is hand-rolled and tested.
- **Test runner is `node:test`**, run via `node --test scripts/spec/`. Do **not** route spec tooling through the repo's Jest/ts-jest or web Vitest configs — keep it isolated.
- **Human voice ("humanify") is a hard requirement** for all generated spec prose. Copied verbatim into the section template: *"Write for a human. Plain, clear, a little warm. Full sentences and short paragraphs where they read better than bullets; bullets only when the content is genuinely a list. Explain why, not just what. No hedging, no filler, no stilted AI cadence. A new engineer should be able to read a section top to bottom and simply understand it."*
- **Token discipline.** Operations are section-scoped. Never read or rewrite an unchanged section. `/spec-generate` fans out per section and is resumable.
- **Drift guard is warning-mode pre-launch** — `drift-check` exits 0 by default and only exits 1 with `--strict`.
- **Do not modify product code in this plan.** The known mobile birthday-caption bug is documented as an open gap in the celebrations section and fixed separately via the feature flow.
- **Commits:** the plan includes commit steps, but per the user's "commit only when asked" rule, obtain the user's go-ahead before the first commit, and branch first: `git checkout -b feat/living-spec-system` (the in-flight cross-device-auth working-tree changes must NOT be staged into these commits — stage only the exact paths each step names).

---

## File Structure

**Created:**

```
scripts/spec/
  lib/
    manifest.mjs        # load + validate + save the manifest (pure I/O)
    glob.mjs            # globToRegExp + matchGlob (pure)
    sections.mjs        # sectionMatches + affectedSections (pure)
    drift.mjs           # computeDrift + hasDrift (pure)
    git.mjs             # changedFilesSince + trackedFiles (thin git wrappers)
    manifest.test.mjs
    glob.test.mjs
    sections.test.mjs
    drift.test.mjs
  drift-check.mjs       # CLI: manifest + git → drift report, exit code
  affected.mjs          # CLI: base ref → affected section ids+files (used by /spec-update)

docs/spec/
  SPEC.md               # index / front door (stub now, filled by generate)
  _meta/
    spec-manifest.json  # the code→section map (all sections, status "stale")
    section-template.md  # template + humanify rule (read by generators/updaters)
    CHANGELOG.md        # append-only spec history (stub)

.claude/skills/spec-update/SKILL.md
.claude/skills/spec-generate/SKILL.md
.claude/workflows/spec-generate.js
```

**Modified:**

```
package.json            # add "spec:test" and "spec:drift" scripts
```

Generated later by Task 8 (not authored by hand): `docs/spec/00-glossary.md` … `09-infra-ops.md`.

---

### Task 1: Manifest library

**Files:**
- Create: `scripts/spec/lib/manifest.mjs`
- Test: `scripts/spec/lib/manifest.test.mjs`

**Interfaces:**
- Produces: `validateManifest(obj) -> string[]` (empty = valid); `loadManifest(path) -> manifest` (throws on invalid); `saveManifest(path, manifest) -> void` (throws on invalid). A `manifest` is `{ sections: Array<{ id, file, sources: string[], last_verified_commit: string|null, status?: 'current'|'drifting'|'stale'|'manual' }> }`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/spec/lib/manifest.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateManifest } from './manifest.mjs'

test('valid manifest returns no errors', () => {
  const m = { sections: [{ id: 'auth', file: '03-auth.md', sources: ['src/x.ts'], last_verified_commit: null }] }
  assert.deepEqual(validateManifest(m), [])
})

test('missing sections array is an error', () => {
  assert.ok(validateManifest({}).some((e) => e.includes('sections')))
})

test('duplicate section id is an error', () => {
  const m = { sections: [
    { id: 'a', file: 'a.md', sources: [], last_verified_commit: null },
    { id: 'a', file: 'b.md', sources: [], last_verified_commit: null },
  ] }
  assert.ok(validateManifest(m).some((e) => e.includes('duplicated')))
})

test('invalid status is an error', () => {
  const m = { sections: [{ id: 'a', file: 'a.md', sources: [], last_verified_commit: null, status: 'bogus' }] }
  assert.ok(validateManifest(m).some((e) => e.includes('status')))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/spec/lib/manifest.test.mjs`
Expected: FAIL — `Cannot find module './manifest.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/spec/lib/manifest.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const STATUSES = ['current', 'drifting', 'stale', 'manual']

export function validateManifest(obj) {
  if (!obj || typeof obj !== 'object') return ['manifest must be an object']
  if (!Array.isArray(obj.sections)) return ['manifest.sections must be an array']
  const errors = []
  const ids = new Set()
  obj.sections.forEach((s, i) => {
    const at = `sections[${i}]`
    if (!s.id) errors.push(`${at}.id is required`)
    else if (ids.has(s.id)) errors.push(`${at}.id "${s.id}" is duplicated`)
    else ids.add(s.id)
    if (!s.file) errors.push(`${at}.file is required`)
    if (!Array.isArray(s.sources)) errors.push(`${at}.sources must be an array`)
    if (!('last_verified_commit' in s)) errors.push(`${at}.last_verified_commit is required (null if never verified)`)
    if (s.status && !STATUSES.includes(s.status)) errors.push(`${at}.status "${s.status}" is invalid`)
  })
  return errors
}

export function loadManifest(path) {
  const obj = JSON.parse(readFileSync(path, 'utf8'))
  const errors = validateManifest(obj)
  if (errors.length) throw new Error(`Invalid manifest at ${path}:\n- ${errors.join('\n- ')}`)
  return obj
}

export function saveManifest(path, manifest) {
  const errors = validateManifest(manifest)
  if (errors.length) throw new Error(`Refusing to save invalid manifest:\n- ${errors.join('\n- ')}`)
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/spec/lib/manifest.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/spec/lib/manifest.mjs scripts/spec/lib/manifest.test.mjs
git commit -m "feat(spec): manifest validation library"
```

---

### Task 2: Glob matcher + section mapping

**Files:**
- Create: `scripts/spec/lib/glob.mjs`, `scripts/spec/lib/sections.mjs`
- Test: `scripts/spec/lib/glob.test.mjs`, `scripts/spec/lib/sections.test.mjs`

**Interfaces:**
- Produces: `matchGlob(glob, filePath) -> boolean`; `globToRegExp(glob) -> RegExp`; `sectionMatches(section, filePath) -> boolean`; `affectedSections(manifest, changedFiles: string[]) -> string[]` (section ids).
- Supported glob subset: `**` (any chars including `/`), `*` (any chars except `/`), `?` (one non-`/`). All other characters — including `(` `)` from Next.js route groups — are literal. Paths are normalized so `\` becomes `/`.

- [ ] **Step 1: Write the failing test (glob)**

```js
// scripts/spec/lib/glob.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchGlob } from './glob.mjs'

test('* matches within one segment only', () => {
  assert.ok(matchGlob('src/*.ts', 'src/age.ts'))
  assert.ok(!matchGlob('src/*.ts', 'src/domain/age.ts'))
})

test('** matches across segments', () => {
  assert.ok(matchGlob('app/auth/**', 'app/auth/callback.tsx'))
  assert.ok(matchGlob('app/auth/**', 'app/auth/x/y.tsx'))
})

test('route-group parentheses are literal', () => {
  assert.ok(matchGlob('web/app/(auth)/**', 'web/app/(auth)/login/page.tsx'))
  assert.ok(!matchGlob('web/app/(auth)/**', 'web/app/(app)/login/page.tsx'))
})

test('backslashes are normalized', () => {
  assert.ok(matchGlob('app/auth/**', 'app\\auth\\callback.tsx'))
})

test('dots are literal, not wildcards', () => {
  assert.ok(!matchGlob('src/age.ts', 'src/ageXts'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/spec/lib/glob.test.mjs`
Expected: FAIL — `Cannot find module './glob.mjs'`.

- [ ] **Step 3: Write minimal implementation (glob)**

```js
// scripts/spec/lib/glob.mjs
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++ } // **
      else re += '[^/]*'                            // *
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp('^' + re + '$')
}

export function matchGlob(glob, filePath) {
  return globToRegExp(glob).test(String(filePath).replace(/\\/g, '/'))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/spec/lib/glob.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the failing test (sections)**

```js
// scripts/spec/lib/sections.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { affectedSections, sectionMatches } from './sections.mjs'

const manifest = { sections: [
  { id: 'auth', file: '03-auth.md', sources: ['src/lib/authCallback.ts', 'app/auth/**'], last_verified_commit: null },
  { id: 'celebrations', file: '07-celebrations.md', sources: ['src/domain/age.ts', 'src/components/character/**'], last_verified_commit: null },
] }

test('sectionMatches checks all of a section\'s globs', () => {
  assert.ok(sectionMatches(manifest.sections[0], 'app/auth/callback.tsx'))
  assert.ok(!sectionMatches(manifest.sections[0], 'src/domain/age.ts'))
})

test('affectedSections returns every section a file touches', () => {
  assert.deepEqual(affectedSections(manifest, ['src/domain/age.ts']), ['celebrations'])
})

test('one file can affect multiple sections', () => {
  const m = { sections: [
    { id: 'a', file: 'a.md', sources: ['src/domain/age.ts'], last_verified_commit: null },
    { id: 'b', file: 'b.md', sources: ['src/**'], last_verified_commit: null },
  ] }
  assert.deepEqual(affectedSections(m, ['src/domain/age.ts']).sort(), ['a', 'b'])
})

test('unmatched files affect nothing', () => {
  assert.deepEqual(affectedSections(manifest, ['README.md']), [])
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test scripts/spec/lib/sections.test.mjs`
Expected: FAIL — `Cannot find module './sections.mjs'`.

- [ ] **Step 7: Write minimal implementation (sections)**

```js
// scripts/spec/lib/sections.mjs
import { matchGlob } from './glob.mjs'

export function sectionMatches(section, filePath) {
  return (section.sources || []).some((g) => matchGlob(g, filePath))
}

export function affectedSections(manifest, changedFiles) {
  const files = changedFiles.map((f) => String(f).replace(/\\/g, '/'))
  return manifest.sections
    .filter((s) => files.some((f) => sectionMatches(s, f)))
    .map((s) => s.id)
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test scripts/spec/lib/glob.test.mjs scripts/spec/lib/sections.test.mjs`
Expected: PASS — 9 tests total.

- [ ] **Step 9: Commit**

```bash
git add scripts/spec/lib/glob.mjs scripts/spec/lib/glob.test.mjs scripts/spec/lib/sections.mjs scripts/spec/lib/sections.test.mjs
git commit -m "feat(spec): glob matcher and code-to-section mapping"
```

---

### Task 3: Drift computation

**Files:**
- Create: `scripts/spec/lib/drift.mjs`
- Test: `scripts/spec/lib/drift.test.mjs`

**Interfaces:**
- Consumes: `sectionMatches` from `sections.mjs`.
- Produces: `computeDrift(manifest, changedFilesForSection) -> Array<{ id, status: 'current'|'drifting'|'manual', matched: string[] }>`, where `changedFilesForSection` is a function `(section) => string[]` returning files changed since that section's `last_verified_commit`. `hasDrift(report) -> boolean`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/spec/lib/drift.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDrift, hasDrift } from './drift.mjs'

const manifest = { sections: [
  { id: 'auth', file: '03-auth.md', sources: ['app/auth/**'], last_verified_commit: 'abc' },
  { id: 'glossary', file: '00-glossary.md', sources: [], last_verified_commit: 'abc', status: 'manual' },
] }

test('section whose source changed is drifting', () => {
  const report = computeDrift(manifest, (s) => s.id === 'auth' ? ['app/auth/callback.tsx'] : [])
  assert.equal(report.find((r) => r.id === 'auth').status, 'drifting')
})

test('section whose changed files do not match its globs stays current', () => {
  const report = computeDrift(manifest, () => ['README.md'])
  assert.equal(report.find((r) => r.id === 'auth').status, 'current')
})

test('manual sections are never flagged', () => {
  const report = computeDrift(manifest, () => ['anything'])
  assert.equal(report.find((r) => r.id === 'glossary').status, 'manual')
})

test('hasDrift is true when any section drifts', () => {
  const report = computeDrift(manifest, (s) => s.id === 'auth' ? ['app/auth/x.tsx'] : [])
  assert.equal(hasDrift(report), true)
})

test('hasDrift is false when nothing drifts', () => {
  assert.equal(hasDrift(computeDrift(manifest, () => [])), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/spec/lib/drift.test.mjs`
Expected: FAIL — `Cannot find module './drift.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/spec/lib/drift.mjs
import { sectionMatches } from './sections.mjs'

export function computeDrift(manifest, changedFilesForSection) {
  return manifest.sections.map((s) => {
    if (s.status === 'manual') return { id: s.id, status: 'manual', matched: [] }
    const changed = changedFilesForSection(s) || []
    const matched = changed.filter((f) => sectionMatches(s, String(f).replace(/\\/g, '/')))
    return { id: s.id, status: matched.length ? 'drifting' : 'current', matched }
  })
}

export function hasDrift(report) {
  return report.some((r) => r.status === 'drifting')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/spec/lib/drift.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/spec/lib/drift.mjs scripts/spec/lib/drift.test.mjs
git commit -m "feat(spec): drift computation"
```

---

### Task 4: Spec scaffolding — template, manifest data, index, changelog

**Files:**
- Create: `docs/spec/_meta/section-template.md`, `docs/spec/_meta/spec-manifest.json`, `docs/spec/_meta/CHANGELOG.md`, `docs/spec/SPEC.md`
- Test: `scripts/spec/lib/manifest-data.test.mjs`

**Interfaces:**
- Consumes: `loadManifest` from `manifest.mjs`.
- Produces: a real, validated manifest file the CLI and skills read.

- [ ] **Step 1: Write the section template**

Create `docs/spec/_meta/section-template.md`:

````markdown
<!-- Every docs/spec section file follows THIS shape and voice. Generators and
     updaters MUST read this file before writing. -->

---
section: <id>
sources:
  - <glob>          # the code this section is responsible for
last_verified_commit: <sha|null>
status: current     # current | drifting | stale | manual
---

# <Human Title>

## Purpose
One or two sentences: what this part of the product is for.

## What the user experiences
The behavior as a user would notice it — not the implementation.

## How it works
Key files, functions, and data flow, with `path:line` references.

## Invariants
The rules that must never break. Be specific and load-bearing.

## Edge cases & gotchas
The surprising bits and the traps.

## Tests
What proves this works, and where those tests live.

## Open gaps
What is missing, partial, or known-wrong. Be honest here.

<!-- VOICE (required): Write for a human. Plain, clear, a little warm. Full
sentences and short paragraphs where they read better than bullets; bullets only
when the content is genuinely a list. Explain why, not just what. No hedging, no
filler, no stilted AI cadence. A new engineer should read a section top to bottom
and simply understand it. -->
````

- [ ] **Step 2: Write the manifest data file**

Create `docs/spec/_meta/spec-manifest.json`:

```json
{
  "sections": [
    { "id": "glossary", "file": "00-glossary.md", "sources": [], "last_verified_commit": null, "status": "manual" },
    { "id": "architecture", "file": "01-architecture.md", "sources": ["src/store/**", "src/lib/supabase.ts", "web/lib/server/**", "app/_layout.tsx", "metro.config.js"], "last_verified_commit": null, "status": "stale" },
    { "id": "data-model", "file": "02-data-model.md", "sources": ["supabase/migrations/**", "src/types/index.ts"], "last_verified_commit": null, "status": "stale" },
    { "id": "auth", "file": "03-auth.md", "sources": ["src/lib/authCallback.ts", "src/tests/authCallback.test.ts", "src/store/auth.ts", "app/auth/**", "app/(auth)/**", "web/app/auth/**", "web/app/(auth)/**"], "last_verified_commit": null, "status": "stale" },
    { "id": "identity-profile", "file": "04-identity-profile.md", "sources": ["src/domain/age.ts", "src/lib/mobileNumber.ts", "src/lib/profileLabels.ts", "src/lib/validation.ts", "src/db/repositories/profile.ts", "app/(tabs)/settings.tsx", "web/app/(app)/settings/**"], "last_verified_commit": null, "status": "stale" },
    { "id": "logging", "file": "05-logging.md", "sources": ["src/domain/calc.ts", "src/db/repositories/logs.ts", "src/db/repositories/brands.ts", "app/(tabs)/log.tsx"], "last_verified_commit": null, "status": "stale" },
    { "id": "goals-insights", "file": "06-goals-insights.md", "sources": ["src/domain/goals.ts", "src/domain/insights.ts", "src/domain/correlations.ts", "src/domain/health.ts", "src/domain/savings.ts", "src/db/repositories/goals.ts"], "last_verified_commit": null, "status": "stale" },
    { "id": "celebrations", "file": "07-celebrations.md", "sources": ["src/domain/age.ts", "src/lib/character/**", "web/lib/character/**", "src/components/character/**", "web/components/character/**", "app/(tabs)/index.tsx", "web/app/(app)/dashboard/**"], "last_verified_commit": null, "status": "stale" },
    { "id": "security-privacy", "file": "08-security-privacy.md", "sources": ["supabase/migrations/**", "supabase/functions/**", "web/lib/server/auth.ts", "docs/security/**"], "last_verified_commit": null, "status": "stale" },
    { "id": "infra-ops", "file": "09-infra-ops.md", "sources": ["package.json", "web/package.json", "metro.config.js", "app.json", "app.config.js", "eas.json", ".github/**", "docs/deployment/**", "docs/runbooks/**"], "last_verified_commit": null, "status": "stale" }
  ]
}
```

- [ ] **Step 3: Write the index and changelog stubs**

Create `docs/spec/SPEC.md`:

```markdown
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
```

Create `docs/spec/_meta/CHANGELOG.md`:

```markdown
# Spec Changelog

Append-only. Newest first. One entry per `/spec-update` or `/spec-generate` run.

<!-- Format: ## <date> — <commit> ; then a bullet per section changed. -->
```

- [ ] **Step 4: Write the failing test**

```js
// scripts/spec/lib/manifest-data.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { loadManifest } from './manifest.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const manifestPath = join(root, 'docs', 'spec', '_meta', 'spec-manifest.json')

test('the real manifest validates', () => {
  const m = loadManifest(manifestPath) // throws if invalid
  assert.ok(m.sections.length >= 10)
})

test('every section file path is unique', () => {
  const m = loadManifest(manifestPath)
  const files = m.sections.map((s) => s.file)
  assert.equal(new Set(files).size, files.length)
})

test('the section template exists', () => {
  assert.ok(existsSync(join(root, 'docs', 'spec', '_meta', 'section-template.md')))
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/spec/lib/manifest-data.test.mjs`
Expected: PASS — 3 tests. (If it fails, the manifest JSON has a typo — fix it.)

- [ ] **Step 6: Commit**

```bash
git add docs/spec/_meta/ docs/spec/SPEC.md scripts/spec/lib/manifest-data.test.mjs
git commit -m "feat(spec): scaffold spec tree, manifest, and section template"
```

---

### Task 5: Git adapter, drift-check CLI, affected CLI, npm scripts

**Files:**
- Create: `scripts/spec/lib/git.mjs`, `scripts/spec/drift-check.mjs`, `scripts/spec/affected.mjs`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: `loadManifest`, `computeDrift`, `hasDrift`, `affectedSections`.
- Produces: `changedFilesSince(commit) -> string[]`; `trackedFiles() -> string[]`. CLI `drift-check.mjs` (exit 0 default, 1 with `--strict`). CLI `affected.mjs <base>` prints JSON `{ sections: string[], files: string[] }`.

- [ ] **Step 1: Write the git adapter**

```js
// scripts/spec/lib/git.mjs
import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean)
}

export function changedFilesSince(commit) {
  return git(['diff', '--name-only', commit, 'HEAD'])
}

export function changedFilesDiff(base) {
  return git(['diff', '--name-only', `${base}...HEAD`])
}

export function trackedFiles() {
  return git(['ls-files'])
}
```

- [ ] **Step 2: Write the drift-check CLI**

```js
// scripts/spec/drift-check.mjs
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadManifest } from './lib/manifest.mjs'
import { computeDrift, hasDrift } from './lib/drift.mjs'
import { changedFilesSince, trackedFiles } from './lib/git.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = join(root, 'docs', 'spec', '_meta', 'spec-manifest.json')
const strict = process.argv.includes('--strict')

const manifest = loadManifest(manifestPath)
const report = computeDrift(manifest, (s) =>
  s.last_verified_commit ? changedFilesSince(s.last_verified_commit) : trackedFiles()
)

for (const r of report) {
  const tag = r.status === 'drifting' ? 'DRIFT ' : r.status === 'manual' ? 'manual' : 'ok    '
  console.log(`[${tag}] ${r.id}${r.matched.length ? `  (${r.matched.length} changed file(s))` : ''}`)
}

if (hasDrift(report)) {
  console.log('\nSpec drift detected. Run /spec-update to refresh the drifting sections.')
  process.exit(strict ? 1 : 0)
}
console.log('\nSpec is current.')
```

- [ ] **Step 3: Write the affected CLI (used by /spec-update)**

```js
// scripts/spec/affected.mjs
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadManifest } from './lib/manifest.mjs'
import { affectedSections } from './lib/sections.mjs'
import { changedFilesDiff } from './lib/git.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = join(root, 'docs', 'spec', '_meta', 'spec-manifest.json')
const base = process.argv[2] || 'main'

const manifest = loadManifest(manifestPath)
const files = changedFilesDiff(base)
const sections = affectedSections(manifest, files)
console.log(JSON.stringify({ base, sections, files }, null, 2))
```

- [ ] **Step 4: Add npm scripts**

In `package.json`, add to the `"scripts"` object:

```json
    "spec:test": "node --test scripts/spec/",
    "spec:drift": "node scripts/spec/drift-check.mjs"
```

- [ ] **Step 5: Run the full spec test suite**

Run: `npm run spec:test`
Expected: PASS — all tests from Tasks 1–4 (17 tests) green.

- [ ] **Step 6: Smoke-run the drift CLI on the real repo**

Run: `npm run spec:drift`
Expected: every section prints `[DRIFT ]` except `glossary` (`[manual]`), because every section's `last_verified_commit` is `null` (never generated yet). Exit code 0. This confirms the wiring works end-to-end.

- [ ] **Step 7: Commit**

```bash
git add scripts/spec/lib/git.mjs scripts/spec/drift-check.mjs scripts/spec/affected.mjs package.json
git commit -m "feat(spec): git adapter, drift-check and affected CLIs, npm scripts"
```

---

### Task 6: `/spec-update` skill

**Files:**
- Create: `.claude/skills/spec-update/SKILL.md`

**Interfaces:**
- Consumes: `scripts/spec/affected.mjs`, `docs/spec/_meta/section-template.md`, the manifest.
- Produces: a user-invocable skill that refreshes only drifting sections and records the change.

- [ ] **Step 1: Write the skill**

Create `.claude/skills/spec-update/SKILL.md`:

````markdown
---
name: spec-update
description: Refresh the docs/spec mother book after a change — updates ONLY the sections the diff touches, then records the change. Use after finishing a feature, before a commit, or whenever code and spec may have diverged.
---

# Updating the Spec

You keep `docs/spec/` accurate without rewriting the whole book. Touch only what changed.

## Steps

1. **Find the base.** Default to `main`. If the user names a base ref, use it.

2. **Compute the affected sections deterministically:**
   ```
   node scripts/spec/affected.mjs <base>
   ```
   This prints `{ base, sections, files }`. If `sections` is empty, tell the user
   the spec is already current for this diff and stop.

3. **Read the template once:** `docs/spec/_meta/section-template.md`. Its shape and
   its VOICE rule are mandatory for everything you write.

4. **For each affected section, and ONLY those sections:**
   - Read the current section file (`docs/spec/<file>` from the manifest).
   - Read the changed files for that section (from the `files` list, filtered to
     that section's globs — or just read the ones that look relevant).
   - Rewrite the section so it matches the code now. Preserve the template shape
     and voice. Keep `Open gaps` honest. Do not invent behavior you did not see
     in the code.
   - Set the section's `last_verified_commit` in BOTH the file frontmatter and
     `docs/spec/_meta/spec-manifest.json` to the current HEAD sha
     (`git rev-parse --short HEAD`). Set `status: current`.

5. **Record it.** Prepend an entry to `docs/spec/_meta/CHANGELOG.md`:
   ```
   ## <YYYY-MM-DD> — <sha>
   - <section-id>: <one human line on what changed>
   ```

6. **Self-check.** Re-read each rewritten section for placeholders, contradictions,
   or stilted phrasing. Fix inline.

7. **Verify:** run `npm run spec:drift`. The sections you updated should now read
   `ok`. Report the result.

## Token discipline (the point of this skill)
Never open a section that `affected.mjs` did not name. Never read an unchanged
file. The cost of an update is (changed sections × their changed files) — keep it
there.

## After the run
Save anything you learned about THIS repo's spec conventions (a glob that should
be added to the manifest, a recurring kind of change) as a one-line note for
your future self in `.claude/agent-memory/spec-update.md` (create if absent,
append-only, keep it under ~40 lines — prune oldest if longer).
````

- [ ] **Step 2: Verify it loads**

Run: `node scripts/spec/affected.mjs main`
Expected: prints JSON with `sections` and `files` (the skill's step 2 works). No crash.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/spec-update/SKILL.md
git commit -m "feat(spec): /spec-update skill"
```

---

### Task 7: `/spec-generate` workflow + skill

**Files:**
- Create: `.claude/workflows/spec-generate.js`, `.claude/skills/spec-generate/SKILL.md`

**Interfaces:**
- Consumes: the manifest, the section template, the live codebase + DB + tests.
- Produces: every `docs/spec/NN-*.md` section file, grounded in real evidence; resumable.

- [ ] **Step 1: Write the generation workflow**

Create `.claude/workflows/spec-generate.js`:

```js
export const meta = {
  name: 'spec-generate',
  description: 'Generate the docs/spec mother book from real code, one agent per section, resumable.',
  phases: [
    { title: 'Generate', detail: 'one grounded agent per spec section' },
    { title: 'Index', detail: 'write SPEC.md + glossary from the sections' },
  ],
}

const SECTIONS = [
  { id: 'architecture', file: '01-architecture.md', focus: 'monorepo layout, the domain/repo/validation/store/server layers, how data flows, the @/ alias, metro Hermes shim.' },
  { id: 'data-model', file: '02-data-model.md', focus: 'every table, column, CHECK constraint, RLS policy, trigger, and RPC. Mirror the LIVE database, not migration files (they can lie).' },
  { id: 'auth', file: '03-auth.md', focus: 'signup, login (password + magic link), the three Supabase link shapes, cross-device callbacks, password reset, the justCreated flow.' },
  { id: 'identity-profile', file: '04-identity-profile.md', focus: 'identity fields, the fail-closed 18+ gate, immutability of name/dob/gender, the once-per-30-days mobile change, server-owned mobile_changed_at.' },
  { id: 'logging', file: '05-logging.md', focus: 'cigarette logs, the 30/day rate limit RPC, brands and variants, price snapshots.' },
  { id: 'goals-insights', file: '06-goals-insights.md', focus: 'goals, insight/nudge generation, mood x trigger correlations, health milestone detection, INR savings.' },
  { id: 'celebrations', file: '07-celebrations.md', focus: 'isBirthdayToday, birthday vs streak milestones, the character moods, ConfettiBurst, reduce-motion. NOTE the known mobile bug: src/components/character/MilestoneCelebration.tsx shows "0-day streak." for birthdays — record it under Open gaps, do not fix it here.' },
  { id: 'security-privacy', file: '08-security-privacy.md', focus: 'the RLS model, SECURITY DEFINER + search_path hygiene, the DPDP export/erase RPCs, the peppered audit hash, the service-role-only surfaces.' },
  { id: 'infra-ops', file: '09-infra-ops.md', focus: 'Supabase/Vercel/EAS free-tier limits, the CI gates, deployment, the runbooks.' },
]

const SECTION_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, markdown: { type: 'string' }, sourcesVerified: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'markdown'],
}

phase('Generate')
const sections = await parallel(SECTIONS.map((s) => () =>
  agent(
    `Write the "docs/spec/${s.file}" section for Smoke Ledger India. Focus: ${s.focus}\n` +
    `First READ docs/spec/_meta/section-template.md and follow its shape and VOICE rule exactly (human, plain, warm; explain why; no AI cadence).\n` +
    `Ground everything in real evidence: read the code under this section's manifest globs, the relevant tests, and (for data/security) the live DB schema via the Supabase MCP and the memory master_context. Use path:line references. Do not invent behavior.\n` +
    `Return the full markdown for the file (including frontmatter with section id, sources, last_verified_commit: null, status: current).`,
    { label: `spec:${s.id}`, phase: 'Generate', agentType: 'Explore', schema: SECTION_SCHEMA }
  ).then((r) => r ? { ...r, id: s.id } : null)
))

const ok = sections.filter(Boolean)
log(`Generated ${ok.length}/${SECTIONS.length} sections.`)

phase('Index')
const glossary = await agent(
  `Write docs/spec/00-glossary.md: a human glossary of Smoke Ledger India's domain terms ` +
  `(cigarette log, baseline, streak, milestone, mood, trigger, pepper, RLS, DPDP, keyset pagination, etc.). ` +
  `Follow docs/spec/_meta/section-template.md voice. status: manual.`,
  { label: 'spec:glossary', phase: 'Index', schema: SECTION_SCHEMA }
)

return { sections: ok, glossary }
```

- [ ] **Step 2: Write the trigger skill**

Create `.claude/skills/spec-generate/SKILL.md`:

````markdown
---
name: spec-generate
description: Build (or fully rebuild) the docs/spec mother book from the real codebase. Runs a resumable multi-agent workflow, one grounded agent per section. Use for the initial spec, or a periodic full refresh.
---

# Generating the Spec

This is the heavy, rare operation. It writes the whole book from real evidence.

## Steps
1. Confirm with the user — this fans out one agent per section and spends real tokens.
2. Run the workflow:
   ```
   Workflow({ name: "spec-generate" })
   ```
3. When it returns, write each returned section's `markdown` to its `docs/spec/<file>`.
4. Run `/spec-update` semantics for stamping: set every section's `last_verified_commit`
   to `git rev-parse --short HEAD` in both the files and `docs/spec/_meta/spec-manifest.json`,
   status `current` (glossary stays `manual`).
5. Run `npm run spec:drift` — expect "Spec is current."
6. Hand the generated sections to the user for a voice + accuracy review before committing.

## Note
The workflow is resumable: if a transient API error drops a section, re-run with
`resumeFromRunId` and completed sections replay from cache.
````

- [ ] **Step 3: Verify the workflow script parses**

Run: `node --check .claude/workflows/spec-generate.js`
Expected: no output, exit 0 (valid JS).

- [ ] **Step 4: Commit**

```bash
git add .claude/workflows/spec-generate.js .claude/skills/spec-generate/SKILL.md
git commit -m "feat(spec): /spec-generate workflow and skill"
```

---

### Task 8: Generate the v1 mother book and verify the loop

**Files:**
- Create (generated): `docs/spec/00-glossary.md` … `docs/spec/09-infra-ops.md`
- Modify: `docs/spec/_meta/spec-manifest.json` (stamp `last_verified_commit`), `docs/spec/_meta/CHANGELOG.md`

- [ ] **Step 1: Generate the book**

Invoke the `/spec-generate` skill. Write each returned section to its file.

- [ ] **Step 2: Stamp the manifest**

Set every section's `last_verified_commit` to `git rev-parse --short HEAD` (glossary stays `status: manual` but stamp it too). Use `saveManifest` semantics or edit the JSON directly, then confirm it still validates:

Run: `node --test scripts/spec/lib/manifest-data.test.mjs`
Expected: PASS.

- [ ] **Step 3: Verify no drift**

Run: `npm run spec:drift`
Expected: every section `ok` except `glossary` `manual`. "Spec is current."

- [ ] **Step 4: Human review checkpoint**

Read each generated section. Confirm: accurate against the code, honest `Open gaps` (the mobile birthday bug appears in celebrations), and the human voice holds. Fix anything off by hand.

- [ ] **Step 5: Append changelog + commit**

Add a CHANGELOG entry for the initial generation, then:

```bash
git add docs/spec/
git commit -m "docs(spec): generate v1 mother book"
```

- [ ] **Step 6: Acceptance — exercise `/spec-update` on this branch's real diff**

With the cross-device-auth + DOB changes present, invoke `/spec-update` with base `main`. Confirm it updates only the `auth`, `identity-profile`, and `celebrations` sections, appends a CHANGELOG entry, and that `npm run spec:drift` then reports those sections `ok`. This proves the living-update loop works end to end.

```bash
git add docs/spec/
git commit -m "docs(spec): update spec for cross-device auth + DOB celebrations"
```

---

## Self-Review

**Spec coverage** (design §→task):
- §1 spec tree & structure → Task 4 (scaffold) + Task 8 (generated content). ✓
- §Core manifest map → Task 4 (data) + Tasks 1–2 (lib). ✓
- §`/spec-update` → Task 6, exercised in Task 8 Step 6. ✓
- §`/spec-generate` → Task 7, run in Task 8. ✓
- §CI drift guard → Tasks 3 + 5, tested. ✓
- §Humanify rule → Task 4 template, enforced in Tasks 6–8. ✓
- §Phase 0 bug document-as-gap → Task 7 workflow prompt + Task 8 Step 4. ✓
- §Phase 2 eval loop → intentionally NOT in this plan (separate cycle). ✓

**Placeholder scan:** no "TBD/TODO/handle edge cases" — generated content in Task 8 is the one deliverable that can't be pre-written, and its acceptance is concrete (drift-clean + human review). ✓

**Type consistency:** `validateManifest`/`loadManifest`/`saveManifest`, `matchGlob`/`globToRegExp`, `sectionMatches`/`affectedSections`, `computeDrift`/`hasDrift`, `changedFilesSince`/`changedFilesDiff`/`trackedFiles` are defined once and used with the same signatures throughout. The CLI's `changedFilesForSection` callback matches `computeDrift`'s contract. ✓
