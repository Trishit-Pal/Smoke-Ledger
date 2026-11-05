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

  // The owner fills these public values in eas.json before a store build (owner-actions section 8
  // step 6); a blank origin would make the Ask screen report "unavailable". Once set, it must be an
  // https origin with no path, because the app appends /api/ledger-chat and /privacy to it.
  it.each(['preview', 'production'])('%s: the web origin, when set, is a bare https origin', (profile) => {
    const origin = eas.build[profile].env?.EXPO_PUBLIC_WEB_BASE_URL ?? '';
    if (origin === '') return;
    expect(origin).toMatch(/^https:\/\/[^/\s]+$/);
  });
});
