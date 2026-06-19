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
