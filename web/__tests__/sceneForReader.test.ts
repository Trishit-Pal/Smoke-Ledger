import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as React from 'react';

const getServerProfile = vi.fn();
vi.mock('@web/lib/server/data', () => ({ getServerProfile: () => getServerProfile() }));
vi.mock('@web/components/marketing/SceneBackdrop', () => ({ SceneBackdrop: () => null }));

import { SceneForReader } from '@web/components/marketing/SceneForReader';

async function discreetFor(): Promise<unknown> {
  const element = (await SceneForReader()) as React.ReactElement<{ discreet: boolean; intensity: string }>;
  expect(element.props.intensity).toBe('quiet');
  return element.props.discreet;
}

describe('SceneForReader (runtime)', () => {
  beforeEach(() => {
    getServerProfile.mockReset();
  });

  it('fails closed to discreet when the profile read rejects', async () => {
    getServerProfile.mockImplementation(() => Promise.reject(new Error('NEXT_REDIRECT')));
    expect(await discreetFor()).toBe(true);
  });

  it('passes discreet mode through when it is on', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: true });
    expect(await discreetFor()).toBe(true);
  });

  it('shows the lungs when discreet mode is off', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: false });
    expect(await discreetFor()).toBe(false);
  });
});
