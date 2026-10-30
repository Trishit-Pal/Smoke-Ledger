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

  it('ci.yml cancels superseded PR runs, but never a main run (its secret scan covers only that push)', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
    expect(ci).not.toMatch(/^ {2}cancel-in-progress: true/m);
  });

  it.each(workflows.map((w) => [w.name, w.text]))(
    '%s never leaves the checkout token on disk while running a downloaded scanner',
    (_name, text) => {
      for (const job of text.split(/\n {2}(?=[a-z-]+:\n)/).filter((j) => j.includes('gitleaks'))) {
        expect(job).toContain('persist-credentials: false');
      }
    },
  );

  it('posture audit runs on a weekly schedule', () => {
    expect(read('.github', 'workflows', 'posture-audit.yml')).toMatch(/schedule:\n\s+- cron:/);
  });

  it('posture audit reports npm advisories without failing every week until the Next 15 track', () => {
    const audit = read('.github', 'workflows', 'posture-audit.yml');
    const npmAuditLines = audit.split('\n').filter((l) => l.includes('npm audit --'));
    expect(npmAuditLines.length).toBeGreaterThan(0);
    for (const line of npmAuditLines) expect(line).toMatch(/\|\| true\s*$/);
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
