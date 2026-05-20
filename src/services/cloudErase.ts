// Erase user data server-side via RPC (keeps auth account).

import { getSupabase } from '@/lib/supabase';

export async function eraseAllUserData(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('erase_account_data');
  if (error) throw new Error(error.message);
}
