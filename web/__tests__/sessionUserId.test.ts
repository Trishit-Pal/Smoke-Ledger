import { describe, expect, test } from 'vitest';
import { sessionUserId } from '../lib/goals/sessionUserId';

describe('sessionUserId', () => {
  test('resolves the signed-in user id', async () => {
    const id = await sessionUserId(async () => ({ data: { session: { user: { id: 'u1' } } } }));
    expect(id).toBe('u1');
  });
  test('resolves null when there is no session', async () => {
    expect(await sessionUserId(async () => ({ data: { session: null } }))).toBeNull();
  });
  test('resolves null when the getter rejects', async () => {
    expect(await sessionUserId(() => Promise.reject(new Error('lock contention')))).toBeNull();
  });
  test('resolves null when the getter throws synchronously', async () => {
    expect(
      await sessionUserId(() => {
        throw new Error('no client');
      }),
    ).toBeNull();
  });
});
