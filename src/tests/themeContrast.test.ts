import { lightTheme, darkTheme } from '../constants/theme';

// Same WCAG 2.x formula as web/__tests__/tokenContrast.test.ts.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const FOREGROUNDS = ['text', 'textMuted', 'textFaint'] as const;
const SURFACES = ['bg', 'card', 'bgElevated'] as const;

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme text contrast', (_name, theme) => {
  const pairs = FOREGROUNDS.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const));

  it.each(pairs)('%s on %s meets AA (4.5:1)', (fg, bg) => {
    expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

// Mobile and web share one faint token so the two surfaces don't drift.
describe('textFaint matches web --text-faint', () => {
  it('light', () => expect(lightTheme.textFaint).toBe('#64707D'));
  it('dark', () => expect(darkTheme.textFaint).toBe('#7D8896'));
});
