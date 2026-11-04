import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const getServerProfile = vi.fn();
const getServerLatestLogIso = vi.fn();
vi.mock('@web/lib/server/data', () => ({
  getServerProfile: () => getServerProfile(),
  getServerLatestLogIso: () => getServerLatestLogIso(),
}));
vi.mock('@web/components/marketing/SceneBackdrop', () => ({ SceneBackdrop: () => null }));

import { SceneForReader } from '@web/components/marketing/SceneForReader';

interface SceneProps {
  discreet: boolean;
  intensity: string;
  lastSmokeIso: string | null;
}

async function propsFor(): Promise<SceneProps> {
  const element = (await SceneForReader()) as React.ReactElement<SceneProps>;
  expect(element.props.intensity).toBe('quiet');
  return element.props;
}

const ISO = '2026-11-03T18:30:00.000Z';

describe('SceneForReader (runtime)', () => {
  beforeEach(() => {
    getServerProfile.mockReset();
    getServerLatestLogIso.mockReset();
    getServerLatestLogIso.mockResolvedValue(null);
  });

  it('fails closed to discreet when the profile read rejects', async () => {
    getServerProfile.mockImplementation(() => Promise.reject(new Error('NEXT_REDIRECT')));
    expect((await propsFor()).discreet).toBe(true);
  });

  it('passes discreet mode through when it is on', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: true });
    expect((await propsFor()).discreet).toBe(true);
  });

  it('shows the lungs when discreet mode is off', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: false });
    expect((await propsFor()).discreet).toBe(false);
  });

  it('passes the latest log time through as lastSmokeIso', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: false });
    getServerLatestLogIso.mockResolvedValue(ISO);
    expect(await propsFor()).toMatchObject({ discreet: false, lastSmokeIso: ISO });
  });

  it('gives lastSmokeIso null when the latest-log read rejects, discreet still follows the profile', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: false });
    getServerLatestLogIso.mockImplementation(() => Promise.reject(new Error('boom')));
    expect(await propsFor()).toMatchObject({ discreet: false, lastSmokeIso: null });
  });

  it('keeps discreet true for a discreet reader (the overlay renders nothing then)', async () => {
    getServerProfile.mockResolvedValue({ discreetMode: true });
    getServerLatestLogIso.mockResolvedValue(ISO);
    expect((await propsFor()).discreet).toBe(true);
  });

  it('still reads the log time when the profile read rejects', async () => {
    getServerProfile.mockImplementation(() => Promise.reject(new Error('NEXT_REDIRECT')));
    getServerLatestLogIso.mockResolvedValue(ISO);
    expect(await propsFor()).toMatchObject({ discreet: true, lastSmokeIso: ISO });
  });
});

describe('SceneBackdrop (source guard)', () => {
  const backdrop = readFileSync(
    join(__dirname, '..', 'components', 'marketing', 'SceneBackdrop.tsx'),
    'utf8',
  );

  it('accepts lastSmokeIso, defaults it to null and forwards it', () => {
    expect(backdrop).toMatch(/lastSmokeIso\?: string \| null/);
    expect(backdrop).toMatch(/lastSmokeIso = null/);
    expect(backdrop).toMatch(/lastSmokeIso=\{lastSmokeIso\}/);
  });
});
