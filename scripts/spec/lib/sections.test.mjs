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
