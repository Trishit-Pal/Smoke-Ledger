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
