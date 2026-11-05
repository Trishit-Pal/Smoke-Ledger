import * as fs from 'fs';
import * as path from 'path';

// Expo reads EXPO_PUBLIC_* at build time, so the Ask the ledger flag must be in the EAS profiles
// that make store/preview builds (owner-actions section 8 step 6). The release gate inside the app
// (isChatPolicyLive) still decides whether a build shows the pill; this only pins the build input.
const eas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../eas.json'), 'utf8')) as {
  build: Record<string, { env?: Record<string, string> }>;
};

describe('eas.json build profiles', () => {
  it.each(['preview', 'production'])('%s turns the Ask the ledger build flag on', (profile) => {
    expect(eas.build[profile].env?.EXPO_PUBLIC_LEDGER_CHAT_ENABLED).toBe('true');
  });

  it('keeps the web origin and Supabase values as empty placeholders: the owner fills them, never the repo', () => {
    for (const profile of ['preview', 'production']) {
      const env = eas.build[profile].env ?? {};
      for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_WEB_BASE_URL']) {
        expect(env[key]).toBe('');
      }
    }
  });
});
