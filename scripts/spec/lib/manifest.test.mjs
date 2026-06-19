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
