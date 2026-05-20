// User-scoped usage events in Supabase (RLS). Never throws into UI.

import { getSupabase } from '@/lib/supabase';
import type { AnalyticsEvent, EventPayloadMap } from '@/constants/events';

const ANALYTICS_CONSENT_KEY = 'consent.analyticsOptIn';
const CONSENT_CACHE_TTL_MS = 5 * 60 * 1000;

let consentCache: {
  userId: string;
  value: boolean;
  expiresAt: number;
} | null = null;

export function invalidateAnalyticsConsentCache(userId?: string): void {
  if (!consentCache) return;
  if (!userId || consentCache.userId === userId) {
    consentCache = null;
  }
}

export function primeAnalyticsConsentCache(userId: string, value: boolean): void {
  consentCache = {
    userId,
    value,
    expiresAt: Date.now() + CONSENT_CACHE_TTL_MS,
  };
}

async function hasAnalyticsConsent(userId: string): Promise<boolean> {
  const now = Date.now();
  if (consentCache && consentCache.userId === userId && consentCache.expiresAt > now) {
    return consentCache.value;
  }

  const supabase = getSupabase();
  const { data } = await supabase
    .from('settings_kv')
    .select('value_json')
    .eq('user_id', userId)
    .eq('key', ANALYTICS_CONSENT_KEY)
    .maybeSingle();

  const value = data?.value_json === true;
  consentCache = {
    userId,
    value,
    expiresAt: now + CONSENT_CACHE_TTL_MS,
  };
  return value;
}

export async function track<K extends AnalyticsEvent>(
  name: K,
  props?: K extends keyof EventPayloadMap ? EventPayloadMap[K] : Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const consent = await hasAnalyticsConsent(user.id);
    if (!consent) return;
    await supabase.from('usage_events').insert({
      user_id: user.id,
      name,
      props_json: props ?? null,
      ts: new Date().toISOString(),
    });
  } catch {
    // Analytics should never throw into UI.
  }
}

export async function recentEvents(limit = 50) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const consent = await hasAnalyticsConsent(user.id);
  if (!consent) return [];
  const { data, error } = await supabase
    .from('usage_events')
    .select('id, name, props_json, ts')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    props_json: r.props_json ? JSON.stringify(r.props_json) : null,
    ts: r.ts,
  }));
}
