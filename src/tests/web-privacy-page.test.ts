/**
 * The privacy policy and terms make promises the code has to keep. These read the
 * page sources, like the other web-* guard tests: the pages are static data with
 * no logic to render. The data promises themselves are checked in
 * privacy-promises.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { EU_REPRESENTATIVE, euRepresentativeIsNamed, LEGAL_ENTITY } from '@/lib/legalEntity';
import { DELETE_ACCOUNT_NOTE, RETENTION } from '@/lib/privacy/retention';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8').replace(/\r\n/g, '\n');

const page = read('web/app/privacy/page.tsx');
const terms = read('web/app/terms/page.tsx');

const sectionTitles = (source: string) =>
  [...source.matchAll(/^\s{4}title: '(.+)',$/gm)].map((m) => m[1]);

describe('legal entity', () => {
  it('names the operator, the Grievance Officer and the 30-day response (O2, O12)', () => {
    expect(LEGAL_ENTITY.operatorName).toBe('Trishit Pal');
    expect(LEGAL_ENTITY.city).toBe('Kolkata');
    expect(LEGAL_ENTITY.contactEmail).toBe('support@smokeledger.app');
    expect(LEGAL_ENTITY.grievanceOfficer).toEqual({
      name: 'Trishit Pal',
      email: 'support@smokeledger.app',
      responseDays: 30,
    });
  });

  it('leaves the EU representative empty until the appointment is signed (O1)', () => {
    expect(EU_REPRESENTATIVE).toEqual({ name: '', address: '', email: '' });
    expect(euRepresentativeIsNamed(EU_REPRESENTATIVE)).toBe(false);
    expect(euRepresentativeIsNamed({ name: 'Rep', address: 'Dublin', email: 'a@b.eu' })).toBe(true);
    expect(euRepresentativeIsNamed({ name: 'Rep', address: '', email: 'a@b.eu' })).toBe(false);
  });
});

describe('privacy policy', () => {
  it('renders the operator, grievance and EU representative from legalEntity', () => {
    expect(page).toMatch(/LEGAL_ENTITY\.operatorName/);
    expect(page).toMatch(/LEGAL_ENTITY\.grievanceOfficer/);
    expect(page).toMatch(/euRepresentativeIsNamed\(EU_REPRESENTATIVE\)/);
  });

  it('renders retention periods from the RETENTION constants, not literals', () => {
    for (const key of ['auditEventsMonths', 'errorEventsDays', 'usageEventsMonths', 'rateLimitCountersDays']) {
      expect(page).toContain(`RETENTION.${key}`);
    }
    const retention = page.slice(page.indexOf("title: 'How long we keep it'"), page.indexOf("title: 'Your rights"));
    expect(retention).not.toMatch(/\d+ (months|days)/);
  });

  it('names every recipient that touches personal data', () => {
    for (const recipient of ['Supabase', 'Vercel', 'Anthropic', 'MSG91', 'Cloudflare Turnstile', 'LEGAL_ENTITY.emailDeliveryProvider', 'Expo']) {
      expect(page).toContain(recipient);
    }
  });

  it('describes the chat payload as the route sends it, earlier turns included (O4)', () => {
    expect(page).toMatch(/earlier turns/);
    expect(page).toContain('CHAT_HISTORY_MAX_TURNS');
    expect(page).toContain('GOAL_WINDOW_LOG_LIMIT');
    expect(page).toContain('RECENT_MAX_ROWS');
    expect(page).toContain('LEGAL_ENTITY.anthropicRetention');
  });

  it('gives the legal basis for health data and the transfer safeguard', () => {
    expect(page).toContain('Article 9(2)(a)');
    expect(page).toContain('Standard Contractual Clauses');
    expect(page).toMatch(/us-east-2/);
  });

  it('covers the required headings', () => {
    expect(sectionTitles(page)).toEqual(
      expect.arrayContaining([
        'Who is responsible',
        'Our data promises',
        'What we collect',
        'Why we use it, and the legal basis',
        'Who receives it',
        'Transfers outside India and the EU',
        'How long we keep it',
        'Your rights, and how to use them',
        'Withdrawing consent',
        'Complaints',
        'The AI feature, and no automated decisions',
        'On your device',
        'Security, and if something goes wrong',
        'Adults only',
        'Name, date of birth and gender',
        'Languages',
        'Versions and changes',
      ]),
    );
  });
});

describe('terms of service', () => {
  it('covers the required headings', () => {
    expect(sectionTitles(terms)).toEqual(
      expect.arrayContaining([
        'Who runs Smoke Ledger',
        'Who can use it',
        'What the service is',
        'Not medical advice',
        'Tobacco and acceptable use',
        'Liability',
        'Changes to these terms',
        'Ending your use',
        'Governing law and courts',
        'Your right to complain',
        'How acceptance is recorded',
      ]),
    );
  });

  it('keeps liability limits within what the law allows and the helplines in view', () => {
    expect(terms).toMatch(/to the extent the law allows/i);
    expect(terms).toMatch(/death or personal injury/);
    expect(terms).toContain('LEGAL_ENTITY.helplines');
    expect(terms).not.toMatch(/as-is and as-available/);
  });

  it('keeps EU consumers their home-country law and courts (O8)', () => {
    expect(terms).toContain('LEGAL_ENTITY.governingLaw');
    expect(terms).toMatch(/where you live/);
  });
});

describe('docs/legal mirrors the pages', () => {
  it.each([
    ['web/app/privacy/page.tsx', 'docs/legal/privacy-policy.md'],
    ['web/app/terms/page.tsx', 'docs/legal/terms-of-service.md'],
  ])('%s headings appear in %s', (pageRel, docRel) => {
    const doc = read(docRel);
    for (const title of sectionTitles(read(pageRel))) {
      expect(doc).toContain(`## ${title}`);
    }
  });
});

describe('delete-account copy matches the policy', () => {
  it('says audit history is anonymised and the deletion record is kept for the audit retention', () => {
    expect(DELETE_ACCOUNT_NOTE).toContain(`anonymised and kept for ${RETENTION.auditEventsMonths} months`);
    expect(DELETE_ACCOUNT_NOTE).toContain('a record that the deletion happened');
    for (const rel of ['web/app/(app)/settings/SettingsClient.tsx', 'app/(tabs)/settings.tsx']) {
      const source = read(rel);
      expect(source).toContain('sublabel={DELETE_ACCOUNT_NOTE}');
      expect(source).not.toMatch(/audit history (are|is) erased|retained per DPDP|deletion record is retained for compliance/);
    }
  });
});
