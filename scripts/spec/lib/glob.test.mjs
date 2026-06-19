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
