import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@web/components/layout/GoToHomepageLink', () => ({ GoToHomepageLink: () => null }));
vi.mock('@web/components/character/CharacterCompanion', () => ({ CharacterCompanion: () => null }));

import { EditorialPageShell } from '@web/components/editorial/EditorialPageShell';

const VEIL = 'color-mix(in srgb, var(--bg) 85%, transparent)';

const render = (backdrop?: React.ReactNode) =>
  renderToStaticMarkup(
    React.createElement(EditorialPageShell, { backdrop, children: React.createElement('p', null, 'body') }),
  );

describe('EditorialPageShell veil', () => {
  it('renders one fixed full-bleed veil between the backdrop and the content when a backdrop is passed', () => {
    const html = render(React.createElement('canvas', { id: 'bk' }));
    const veils = html.split(VEIL).length - 1;
    expect(veils).toBe(1); // the column no longer carries its own veil
    const veil = html.indexOf(VEIL);
    expect(html.indexOf('id="bk"')).toBeLessThan(veil);
    expect(veil).toBeLessThan(html.indexOf('<main'));
    expect(html).toMatch(/position:fixed;inset:0[^"]*background:color-mix/);
  });

  it('renders no veil without a backdrop', () => {
    expect(render()).not.toContain('color-mix');
  });
});
