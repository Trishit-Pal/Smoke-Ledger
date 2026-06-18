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
