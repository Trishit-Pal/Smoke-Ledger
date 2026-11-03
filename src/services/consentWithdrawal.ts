// Consent changes that leave a trace on the server, shared by web and Expo.

import { getSupabase } from '@/lib/supabase';
import { logClientError } from '@/lib/logger';
import { recordAuditEvent } from '@/services/audit';
import { setSetting } from '@/db/repositories/settings';

/**
 * Withdrawing the health-data consent cannot leave a working ledger, so it ends
 * in Erase or Delete (the reader chooses). This records the withdrawal itself.
 * The audit write must never stand between the reader and their erasure, so a
 * failure is logged and swallowed.
 */
export async function recordConsentWithdrawal(outcome: 'erase' | 'delete'): Promise<void> {
  try {
    await recordAuditEvent('consent_revoked', 'compliance', {
      reason: `health_data_withdrawn_then_${outcome}`,
    });
  } catch (e) {
    void logClientError(e, { category: 'consent.withdraw_audit' });
  }
}

/**
 * Store the analytics preference. Turning it off first deletes the reader's past
 * usage events, so a failed delete leaves the preference on and the toggle can
 * simply be retried.
 */
export async function saveAnalyticsOptIn(value: boolean): Promise<void> {
  if (!value) {
    const { error } = await getSupabase().rpc('delete_my_usage_events');
    if (error) throw new Error(error.message);
  }
  await setSetting('consent.analyticsOptIn', value);
}
