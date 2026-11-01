import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

// Security review F1: every loader built its own cookie client, so a Bearer-auth
// route (native chat) could not reuse them without copying the service-role
// shortcut. Loaders now also exist in an explicit-client form, and the only
// admin-client use in data.ts stays the brand catalog cache.
const src = readFileSync(path.resolve(__dirname, '..', 'lib/server/data.ts'), 'utf8');

describe('server data loaders take an explicit client', () => {
  test('exports client-parameterised loaders for profile, logs page, goals, daily summary', () => {
    // Whitespace-insensitive: the signature may wrap across lines.
    const flat = src.replace(/\s+/g, ' ').replace(/\( /g, '(');
    for (const name of ['loadProfile', 'loadLogsPage', 'loadGoals', 'loadDailySummary']) {
      expect(flat, `missing export ${name}(supabase, userId, …)`).toContain(
        `export async function ${name}(supabase: SupabaseClient, userId: string`,
      );
    }
  });
  test('createAdminClient is used only for the brand catalog', () => {
    const uses = src.split('\n').filter((l) => /createAdminClient\(\)/.test(l));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/admin/);
  });
});
