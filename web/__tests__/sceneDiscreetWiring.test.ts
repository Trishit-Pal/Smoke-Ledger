import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const layout = readFileSync(join(WEB, 'app', '(app)', 'layout.tsx'), 'utf8');
const reader = readFileSync(join(WEB, 'components', 'marketing', 'SceneForReader.tsx'), 'utf8');
const backdrop = readFileSync(join(WEB, 'components', 'marketing', 'SceneBackdrop.tsx'), 'utf8');

describe('scene discreet wiring', () => {
  it('keeps the app layout synchronous so the shell streams', () => {
    expect(layout).toMatch(/export default function AppLayout\(/);
    expect(layout).not.toMatch(/async function AppLayout/);
    expect(layout).not.toMatch(/getServerProfile/);
  });

  it('renders SceneForReader in Suspense with a haze-only (discreet) fallback', () => {
    expect(layout).toMatch(
      /<React\.Suspense fallback=\{<SceneBackdrop intensity="quiet" discreet \/>\}>\s*<SceneForReader \/>\s*<\/React\.Suspense>/,
    );
  });

  it('resolves discreet from the cached profile via isDiscreetMode', () => {
    expect(reader).toMatch(/import \{ isDiscreetMode \} from '@\/lib\/discreet'/);
    expect(reader).toMatch(/await getServerProfile\(\)\s*\.then\(isDiscreetMode\)/);
    expect(reader).toMatch(/<SceneBackdrop intensity="quiet" discreet=\{discreet\} \/>/);
  });

  it('fails closed to discreet when the profile read rejects', () => {
    expect(reader).toMatch(/\.catch\(\(\) => true\)/);
    expect(reader).not.toMatch(/\.catch\(\(\) => false\)/);
  });

  it('forwards discreet from SceneBackdrop to the scene', () => {
    expect(backdrop).toMatch(/discreet\?: boolean/);
    expect(backdrop).toMatch(/<Scene intensity=\{intensity\} discreet=\{discreet\} \/>/);
  });
});
