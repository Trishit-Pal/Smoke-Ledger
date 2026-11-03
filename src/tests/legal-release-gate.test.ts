/**
 * Release gate for the V3 privacy policy and terms (owner decision O1, Task 12).
 * Bumping LEGAL_VERSIONS asks every live reader to accept again, so it must not
 * happen while the policy still says the EU representative is "being appointed".
 */
import * as fs from 'fs';
import * as path from 'path';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { EU_REPRESENTATIVE, euRepresentativeIsNamed } from '@/lib/legalEntity';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

/** The versions live readers accepted before V3. Change only when a bump has shipped. */
const PUBLISHED = { terms: '2026-05-19', privacy: '2026-11-02' } as const;

describe('legal release gate', () => {
  it.each([
    ['privacy', 'web/app/privacy/page.tsx', 'docs/legal/privacy-policy.md'],
    ['terms', 'web/app/terms/page.tsx', 'docs/legal/terms-of-service.md'],
  ] as const)('the %s page and its doc show the LEGAL_VERSIONS date', (doc, pageRel, mdRel) => {
    expect(read(pageRel)).toContain(`effectiveDate={LEGAL_VERSIONS.${doc}}`);
    expect(read(mdRel)).toContain(`Effective date: ${LEGAL_VERSIONS[doc]}`);
  });

  it('a version later than the published one needs a named EU representative', () => {
    const bumped = (['terms', 'privacy'] as const).some((doc) => LEGAL_VERSIONS[doc] > PUBLISHED[doc]);
    if (!bumped) return;
    expect(euRepresentativeIsNamed(EU_REPRESENTATIVE)).toBe(true);
    for (const field of [EU_REPRESENTATIVE.name, EU_REPRESENTATIVE.address, EU_REPRESENTATIVE.email]) {
      expect(field.trim()).not.toBe('');
    }
  });

  it('never moves a version backwards from what readers accepted', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      expect(LEGAL_VERSIONS[doc] >= PUBLISHED[doc]).toBe(true);
    }
  });
});
