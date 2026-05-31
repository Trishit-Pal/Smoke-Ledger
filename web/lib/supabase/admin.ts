import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanEnvValue, readSupabaseUrl } from '@web/lib/supabase/env';

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient;

  const supabaseUrl = readSupabaseUrl();
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceKey) return null;

  adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
