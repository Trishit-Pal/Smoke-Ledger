// Facts repository. Calls the `get_random_facts` RPC when available; falls back
// to the bundled dataset on any error so the carousel still renders offline /
// pre-migration.

import { getSupabase } from '@/lib/supabase';
import { SMOKING_FACTS, pickRandomFacts, type SmokingFact } from '@/constants/facts';

export async function fetchRandomFacts(limit = 5): Promise<SmokingFact[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_random_facts', { p_limit: limit });
    if (error || !Array.isArray(data) || data.length === 0) throw error ?? new Error('empty');
    return data.map((r: any) => ({
      id: String(r.id),
      category: r.category,
      headline: r.headline,
      body: r.body,
      source: r.source,
      sourceUrl: r.source_url ?? undefined,
    }));
  } catch {
    return pickRandomFacts(limit);
  }
}

export async function markFactSeen(factId: string, liked?: boolean): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.rpc('mark_fact_seen', { p_fact_id: factId, p_liked: liked ?? null });
  } catch {
    // Non-essential; ignore.
  }
}

export function bundledFacts(): SmokingFact[] {
  return [...SMOKING_FACTS];
}
