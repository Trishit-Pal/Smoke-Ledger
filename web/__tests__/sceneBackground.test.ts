import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DisposeBin } from '@web/components/marketing/scene/disposables';

const MARKETING = join(__dirname, '..', 'components', 'marketing');
const SCENE_DIR = join(MARKETING, 'scene');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Drop comments so prose such as "#1" or "rgb(" in docs never trips the guards. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
}

const component = stripComments(read(join(MARKETING, 'SceneBackground.tsx')));
const sceneFiles = readdirSync(SCENE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ name: f, src: stripComments(read(join(SCENE_DIR, f))) }));

/** Any colour literal: #hex, rgb()/rgba(), hsl()/hsla(), or a three.js 0xRRGGBB numeral. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-fA-F]{6}\b/g;

/** The only colour literals allowed anywhere: readVar fallbacks in scene/tokens.ts. */
const TOKEN_FALLBACKS = ['#0B0F14', '#A9B3BF', '#2FA39B', '#D08267'];

describe('scene colour guard', () => {
  it('has no colour literals in SceneBackground.tsx', () => {
    expect(component.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });

  it.each(sceneFiles.filter((f) => f.name !== 'tokens.ts'))('has no colour literals in scene/$name', ({ src }) => {
    expect(src.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });

  it('allows only the four named readVar fallbacks, and only in scene/tokens.ts', () => {
    const tokens = sceneFiles.find((f) => f.name === 'tokens.ts');
    expect(tokens).toBeDefined();
    expect(tokens!.src.match(COLOUR_LITERAL)).toEqual(TOKEN_FALLBACKS);
  });

  it('reads the four design tokens at runtime', () => {
    const tokens = sceneFiles.find((f) => f.name === 'tokens.ts')!.src;
    for (const name of ['--bg', '--text-muted', '--accent', '--warn-earth']) {
      expect(tokens).toContain(`'${name}'`);
    }
  });
});

describe('scene feature gating', () => {
  it('creates the sign only at full intensity and not in discreet mode', () => {
    expect(component).toMatch(/const showSign = intensity === 'full' && !discreet;/);
    expect(component.match(/buildSign\(/g)).toHaveLength(1);
    expect(component).toMatch(/showSign \? buildSign\(/);
  });

  it('skips the lobes and airways in discreet mode', () => {
    expect(component).toMatch(/discreet \? null : buildLungs\(/);
    expect(component.match(/buildLungs\(/g)).toHaveLength(1);
  });

  it('keeps bloom to full intensity on a capable tier', () => {
    expect(component).toMatch(/const useBloom = intensity === 'full' && budget\.bloom;/);
  });

  it('accepts a discreet prop', () => {
    expect(component).toMatch(/discreet\?: boolean/);
  });
});

describe('scene theme resync and quiet tier', () => {
  it('resyncs tokens from a class-attribute observer, not a [resolvedTheme] effect', () => {
    // next-themes flips the <html> class in its own effect, after any child effect has run.
    expect(component).toMatch(/new MutationObserver\(applyTheme\)/);
    expect(component).toMatch(/observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['class'\] \}\)/);
    expect(component).toContain('themeObserver.disconnect()');
    expect(component).not.toContain('useTheme');
    expect(component).not.toContain('resolvedTheme]');
  });

  it('paints the page colour behind the scene so light-theme ink sits on a pale ground', () => {
    expect(component).toContain('scene.background = currentBg;');
  });

  it('renders the light theme directly, so the bloom path never tone-maps the page colour', () => {
    expect(component).toContain('if (composer && !isLight) composer.render();');
    expect(component).toContain('else renderer.render(scene, camera);');
  });

  it('thins the haze on the quiet tier', () => {
    expect(component).toMatch(/hazeCountFor\(budget, intensity === 'quiet'\)/);
  });
});

describe('scene early returns', () => {
  it('still renders nothing under prefers-reduced-motion', () => {
    expect(component).toContain('(prefers-reduced-motion: reduce)');
    expect(component).toMatch(/reduce\.matches \|\| !hasWebGL\(\)\) return;/);
  });

  it('still renders nothing without WebGL or in the off tier', () => {
    expect(component).toContain('function hasWebGL()');
    expect(component).toMatch(/tier === 'off'\) return;/);
  });

  it('keeps the idle pause, hidden-tab pause and parallax', () => {
    expect(component).toContain('IDLE_PAUSE_MS');
    expect(component).toContain("document.addEventListener('visibilitychange'");
    expect(component).toContain("window.addEventListener('mousemove'");
  });
});

describe('scene disposal', () => {
  const builders = sceneFiles.filter((f) => f.name !== 'disposables.ts');

  it('routes every geometry, material and texture through the dispose bin', () => {
    const created = /new THREE\.\w*(Geometry|Material|Texture)\(/;
    let seen = 0;
    for (const { name, src } of [{ name: 'SceneBackground.tsx', src: component }, ...builders]) {
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!created.test(line)) return;
        seen += 1;
        // The `bin.track(` wrapper may sit on the previous line when the constructor is wrapped.
        expect(`${lines[i - 1] ?? ''}\n${line}`, `${name}: ${line.trim()}`).toContain('.track(');
      });
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('disposes the bin, renderer and composer on teardown, with the env map and PMREM in the bin', () => {
    for (const call of ['bin.disposeAll()', 'renderer.dispose()', 'composer?.dispose()']) {
      expect(component).toContain(call);
    }
    expect(component).toMatch(/bin\.track\(new THREE\.PMREMGenerator\(/);
    expect(component).toMatch(/bin\.track\(pmrem\.fromScene\(/);
  });

  it('frees the renderer and the bin when the build throws, without an unhandled rejection', () => {
    expect(component).toMatch(/rendererToDispose = renderer;/);
    expect(component).toMatch(
      /\}\)\(\)\.catch\(\(\) => \{[\s\S]*?bin\.disposeAll\(\);[\s\S]*?rendererToDispose\?\.dispose\(\);[\s\S]*?visibility = 'hidden';[\s\S]*?\}\);/,
    );
  });

  it('DisposeBin disposes everything it tracked, once, and returns the item', () => {
    const bin = new DisposeBin();
    const a = { dispose: vi.fn() };
    const b = { dispose: vi.fn() };
    expect(bin.track(a)).toBe(a);
    bin.track(b);
    bin.disposeAll();
    bin.disposeAll();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
  });
});
