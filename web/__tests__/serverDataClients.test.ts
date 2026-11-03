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
    for (const name of ['loadProfile', 'loadLogsPage', 'loadGoals']) {
      expect(flat, `missing export ${name}(supabase, userId, …)`).toContain(
        `export async function ${name}(supabase: SupabaseClient, userId: string`,
      );
    }
    // get_daily_summary scopes by auth.uid() inside the RPC: no userId, and the
    // cookie wrapper must not pay an extra auth round-trip to fetch one.
    expect(flat).toContain('export async function loadDailySummary(supabase: SupabaseClient, opts:');
    const wrapper = flat.slice(flat.indexOf('export const getServerDailySummary'));
    expect(wrapper.slice(0, 400)).not.toContain('requireServerUserId');
  });
  test('loadGoals can bound its read, and the chat route always bounds it', () => {
    const flat = src.replace(/\s+/g, ' ');
    const start = flat.indexOf('export async function loadGoals');
    const body = flat.slice(start, flat.indexOf('export const getServerGoals', start));
    expect(body).toContain('.limit(limit)');
    const route = readFileSync(path.resolve(__dirname, '..', 'app/api/ledger-chat/route.ts'), 'utf8').replace(/\s+/g, ' ');
    expect(route).toContain('loadGoals(db, userId, { activeOnly: forStarters, limit: CHAT_GOALS_READ_LIMIT })');
  });
  test('createAdminClient is used only for the brand catalog', () => {
    const uses = src.split('\n').filter((l) => /createAdminClient\(\)/.test(l));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/admin/);
  });
});
