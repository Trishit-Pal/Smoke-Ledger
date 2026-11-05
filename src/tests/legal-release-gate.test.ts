/**
 * Release gate for the V3 privacy policy and terms (owner decision O1, Task 12).
 * Bumping LEGAL_VERSIONS asks every live reader to accept again, so it must not
 * happen while the policy still says the EU representative is "being appointed".
 */
import * as fs from 'fs';
import * as path from 'path';
import { CHAT_UNDISCLOSED_PRIVACY, isChatPolicyLive, LEGAL_VERSIONS } from '@/lib/legal';
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

  // Owner decision (2026-11-05): ship the Ask the ledger MVP before an Art 27 representative is
  // signed. The bump is allowed without one, but only while the policy says so in plain words,
  // never by silently dropping the line. Once a representative is named this check steps aside.
  it('a bump without a named EU representative keeps the "appointing" line in the policy', () => {
    const bumped = (['terms', 'privacy'] as const).some((doc) => LEGAL_VERSIONS[doc] > PUBLISHED[doc]);
    if (!bumped || euRepresentativeIsNamed(EU_REPRESENTATIVE)) return;
    expect(read('web/app/privacy/page.tsx')).toContain('We are appointing a representative in the EU');
    expect(read('docs/legal/privacy-policy.md')).toContain('being appointed');
  });

  it('terms and privacy are bumped together, so one /consent screen covers both', () => {
    expect(LEGAL_VERSIONS.terms > PUBLISHED.terms).toBe(true);
    expect(LEGAL_VERSIONS.privacy > PUBLISHED.privacy).toBe(true);
    expect(LEGAL_VERSIONS.terms).toBe(LEGAL_VERSIONS.privacy);
  });

  it('the live privacy version opens the chat gate', () => {
    expect(isChatPolicyLive(LEGAL_VERSIONS.privacy)).toBe(true);
  });

  it('the chat gate stays shut at exactly the privacy version readers accepted', () => {
    // A literal, not PUBLISHED.privacy: PUBLISHED moves when the bump ships, the gate date must not.
    expect(CHAT_UNDISCLOSED_PRIVACY).toBe('2026-11-02');
    expect(CHAT_UNDISCLOSED_PRIVACY <= PUBLISHED.privacy).toBe(true);
    expect(isChatPolicyLive(PUBLISHED.privacy)).toBe(false);
    expect(isChatPolicyLive('2026-11-03')).toBe(true);
  });

  it('never moves a version backwards from what readers accepted', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      expect(LEGAL_VERSIONS[doc] >= PUBLISHED[doc]).toBe(true);
    }
  });
});
