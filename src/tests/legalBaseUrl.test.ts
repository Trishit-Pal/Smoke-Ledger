// LEGAL_URLS are opened from the mobile consent screens every reader must pass. A blank
// EXPO_PUBLIC_WEB_BASE_URL (eas.json ships it as a placeholder) must never yield a relative link,
// which a phone cannot open: it falls back to the default origin, like an unset one.
// Literal process.env access only: Expo inlines EXPO_PUBLIC_* at build time and its lint rule
// forbids dynamic keys.
function legalUrlsWith(value: string | undefined): { terms: string; privacy: string; support: string } {
  const prev = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (value === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
  else process.env.EXPO_PUBLIC_WEB_BASE_URL = value;
  try {
    let urls: { terms: string; privacy: string; support: string } | undefined;
    jest.isolateModules(() => {
      urls = (jest.requireActual('@/lib/legal') as typeof import('@/lib/legal')).LEGAL_URLS;
    });
    return urls!;
  } finally {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    else process.env.EXPO_PUBLIC_WEB_BASE_URL = prev;
  }
}

describe('LEGAL_URLS origin', () => {
  it.each([[''], ['   '], [undefined]])('falls back to an absolute https origin when the value is %p', (value) => {
    const urls = legalUrlsWith(value);
    for (const url of [urls.terms, urls.privacy, urls.support]) expect(url).toMatch(/^https:\/\/[^/]+\//);
  });

  it('uses the configured origin when one is set', () => {
    expect(legalUrlsWith('https://ledger.example').privacy).toBe('https://ledger.example/privacy');
  });
});
