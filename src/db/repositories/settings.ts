import { getSupabase } from '@/lib/supabase';
import { mapDbError, requireUserId } from '@/db/repositories/_supabase';

export async function getSetting<T>(key: string): Promise<T | null> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('settings_kv')
    .select('value_json')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw mapDbError(error);
  // Only a missing row (or a JSON null) is null: a stored false or 0 is a real answer.
  return (data?.value_json ?? null) as T | null;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('settings_kv').upsert(
    { user_id: userId, key, value_json: value as object },
    { onConflict: 'user_id,key' },
  );
  if (error) throw mapDbError(error);
}

export async function removeSetting(key: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('settings_kv').delete().eq('user_id', userId).eq('key', key);
  if (error) throw mapDbError(error);
}
