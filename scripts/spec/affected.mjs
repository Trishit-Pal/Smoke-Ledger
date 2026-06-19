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
