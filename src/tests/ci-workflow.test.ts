/**
 * Guards the CI supply chain. CI was silently dead from Sept to Oct 2026: a
 * `secrets.*` reference in a step `if:` made GitHub reject the whole workflow,
 * every run reported 0 jobs, and red merges went through (no branch protection
 * on a private free-plan repo). These checks fail on that class of mistake.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
// Windows checkouts (core.autocrlf) turn these files CRLF; compare on LF.
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

const workflows = fs
  .readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map((f) => ({ name: f, text: read('.github', 'workflows', f) }));

describe('GitHub workflows', () => {
  it('includes the weekly posture audit alongside CI', () => {
    expect(workflows.map((w) => w.name).sort()).toEqual(['ci.yml', 'posture-audit.yml']);
  });

  it.each(workflows.map((w) => [w.name, w.text]))(
    '%s never reads secrets in an if: (GitHub rejects the workflow)',
    (_name, text) => {
      const ifLines = text.split('\n').filter((l) => /^\s*if:/.test(l));
      for (const line of ifLines) expect(line).not.toMatch(/secrets\./);
    },
  );

  it.each(workflows.map((w) => [w.name, w.text]))(
    '%s pins every action to a full commit SHA',
    (_name, text) => {
      const uses = text.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
      expect(uses.length).toBeGreaterThan(0);
      for (const line of uses) expect(line).toMatch(/@[0-9a-f]{40}\b/);
    },
  );

  it.each(workflows.map((w) => [w.name, w.text]))(
    '%s declares least-privilege top-level permissions',
    (_name, text) => {
      expect(text).toMatch(/^permissions:\n\s+contents: read/m);
    },
  );

  it('ci.yml scans for secrets with a checksum-verified gitleaks, redacted', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci).toMatch(/sha256sum (-c|--check)/);
    expect(ci).toMatch(/gitleaks git[^\n]*--redact/);
  });

  it('ci.yml cancels superseded runs to stay inside the free Actions minutes', () => {
    expect(read('.github', 'workflows', 'ci.yml')).toMatch(/cancel-in-progress: true/);
  });

  it('posture audit runs on a weekly schedule', () => {
    expect(read('.github', 'workflows', 'posture-audit.yml')).toMatch(/schedule:\n\s+- cron:/);
  });
});

describe('dependency and repo hygiene', () => {
  it('Dependabot watches root npm, web npm and GitHub Actions', () => {
    const cfg = read('.github', 'dependabot.yml');
    expect(cfg).toMatch(/package-ecosystem: npm\n\s+directory: \/\n/);
    expect(cfg).toMatch(/package-ecosystem: npm\n\s+directory: \/web\n/);
    expect(cfg).toMatch(/package-ecosystem: github-actions/);
  });

  it.each(['.cursor/', '.superpowers/', 'play-service-account.json'])(
    '.gitignore excludes %s',
    (entry) => {
      expect(read('.gitignore').split(/\r?\n/)).toContain(entry);
    },
  );
});
