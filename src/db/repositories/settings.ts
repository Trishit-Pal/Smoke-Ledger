import { getSupabase } from '@/lib/supabase';
import { requireUserId } from '@/db/repositories/_supabase';

export async function getSetting<T>(key: string): Promise<T | null> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('settings_kv')
    .select('value_json')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value_json) return null;
  return data.value_json as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('settings_kv').upsert(
    { user_id: userId, key, value_json: value as object },
    { onConflict: 'user_id,key' },
  );
  if (error) throw new Error(error.message);
}

export async function removeSetting(key: string): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('settings_kv').delete().eq('user_id', userId).eq('key', key);
  if (error) throw new Error(error.message);
}
