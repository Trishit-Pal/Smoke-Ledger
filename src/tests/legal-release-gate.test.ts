/**
 * Release gate for the privacy policy and terms. Bumping LEGAL_VERSIONS asks every live reader to
 * accept again. Decision O-MVP (2026-11-05, docs/legal/owner-actions.md section 2): the Ask the
 * ledger launch bumps before an EU representative is signed, so the policy must keep saying the
 * representative is being appointed until one is named.
 */
import * as fs from 'fs';
import * as path from 'path';
import { CHAT_UNDISCLOSED_PRIVACY, isChatPolicyLive, LEGAL_VERSIONS } from '@/lib/legal';
import { EU_REPRESENTATIVE, euRepresentativeIsNamed } from '@/lib/legalEntity';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

/**
 * The versions live readers had accepted before the latest bump. Move them to LEGAL_VERSIONS once
 * that bump has shipped (after the 2026-11-05 launch merges, both become '2026-11-05').
 */
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

  it('the chat launch bumped terms and privacy together, and no later version goes below it', () => {
    // One /consent screen covered both at launch. Later bumps may move either document on its own.
    const LAUNCH = '2026-11-05';
    expect(LEGAL_VERSIONS.terms >= LAUNCH).toBe(true);
    expect(LEGAL_VERSIONS.privacy >= LAUNCH).toBe(true);
  });

  it('the live privacy version opens the chat gate', () => {
    expect(isChatPolicyLive(LEGAL_VERSIONS.privacy)).toBe(true);
  });

  it('the chat gate stays shut at the last policy that did not describe the chat', () => {
    // Literals, not PUBLISHED: PUBLISHED moves when a bump ships, the gate date must not.
    expect(CHAT_UNDISCLOSED_PRIVACY).toBe('2026-11-02');
    expect(CHAT_UNDISCLOSED_PRIVACY <= PUBLISHED.privacy).toBe(true);
    expect(isChatPolicyLive('2026-11-02')).toBe(false);
    expect(isChatPolicyLive('2026-11-03')).toBe(true);
  });

  it('never moves a version backwards from what readers accepted', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      expect(LEGAL_VERSIONS[doc] >= PUBLISHED[doc]).toBe(true);
    }
  });
});
