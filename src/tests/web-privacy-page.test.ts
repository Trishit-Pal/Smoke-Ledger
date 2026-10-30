/**
 * The privacy policy makes promises the code has to keep. These guard the claims
 * that were wrong or missing; they read the page source, like the other
 * web-* guard tests, because the page is static JSX with no logic to render.
 */
import * as fs from 'fs';
import * as path from 'path';

const page = fs.readFileSync(
  path.resolve(__dirname, '../../web/app/privacy/page.tsx'),
  'utf8',
);

describe('privacy policy claims', () => {
  it('says erase clears the identity details, as erase_account_data now does', () => {
    expect(page).toMatch(/name, date of birth, gender, mobile number and place/);
  });

  it('discloses where the database is hosted and that data crosses borders', () => {
    expect(page).toMatch(/United States/);
    expect(page).toMatch(/outside India and the European Economic Area/);
  });

  it('names the processors that actually touch personal data', () => {
    for (const processor of ['Supabase', 'Vercel', 'Cloudflare', 'SMS']) {
      expect(page).toContain(processor);
    }
  });

  it('names the statutory rights regimes the product is exposed to', () => {
    expect(page).toContain('Digital Personal Data Protection Act');
    expect(page).toContain('GDPR');
  });
});
