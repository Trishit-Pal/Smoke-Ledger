import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const layout = readFileSync(join(WEB, 'app', '(app)', 'layout.tsx'), 'utf8');
const backdrop = readFileSync(join(WEB, 'components', 'marketing', 'SceneBackdrop.tsx'), 'utf8');

describe('scene discreet wiring', () => {
  it('derives discreet in the app layout from the cached profile via isDiscreetMode', () => {
    expect(layout).toMatch(/import \{ isDiscreetMode \} from '@\/lib\/discreet'/);
    expect(layout).toMatch(/getServerProfile\(\)\s*\.then\(isDiscreetMode\)/);
  });

  it('falls back to false when the profile read fails, so the layout never throws', () => {
    expect(layout).toMatch(/\.catch\(\(\) => false\)/);
  });

  it('passes discreet to SceneBackdrop', () => {
    expect(layout).toMatch(/<SceneBackdrop intensity="quiet" discreet=\{discreet\} \/>/);
  });

  it('forwards discreet from SceneBackdrop to the scene', () => {
    expect(backdrop).toMatch(/discreet\?: boolean/);
    expect(backdrop).toMatch(/<Scene intensity=\{intensity\} discreet=\{discreet\} \/>/);
  });
});
