// Erase user data server-side via RPC (keeps auth account).

import { getSupabase } from '@/lib/supabase';
import { logClientError } from '@/lib/logger';

export async function eraseAllUserData(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('erase_account_data');
  if (error) throw new Error(error.message);

  // Erase removed name / DOB / gender from the sign-in record; refresh so the
  // JWT stops carrying the old user_metadata. The erase itself already
  // succeeded, so a failure here is logged and never blocks the success path.
  try {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
  } catch (e) {
    void logClientError(e, { category: 'erase.refresh_session' });
  }
}
