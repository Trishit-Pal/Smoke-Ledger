import type { Goal, GoalType } from '@/types';
import { makeId } from '@/lib/id';
import { todayIst } from '@/lib/date';
import { getSupabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';
import { mapDbError, requireUserId } from '@/db/repositories/_supabase';
import {
  GoalSchema,
  GoalPatchSchema,
  GoalStatusSchema,
  IdSchema,
  parseOrThrow,
  type GoalPatchInput,
} from '@/lib/validation';

type Row = {
  id: string;
  user_id: string;
  type: GoalType;
  target_value: number;
  current_baseline: number | null;
  start_date: string;
  end_date: string | null;
  status: Goal['status'];
  meta_json: Record<string, unknown> | string | null;
  created_at: string;
  completed_at: string | null;
};

function rowToGoal(r: Row): Goal {
  let meta: Record<string, unknown> | null = null;
  const raw = r.meta_json;
  if (raw == null) {
    meta = null;
  } else if (typeof raw === 'string') {
    try {
      meta = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  } else {
    meta = raw;
  }
  return {
    id: r.id,
    type: r.type,
    targetValue: Number(r.target_value),
    currentBaseline: r.current_baseline != null ? Number(r.current_baseline) : null,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    meta,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
  };
}

export async function listAllGoals(): Promise<Goal[]> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error);
  return (data as Row[]).map(rowToGoal);
}

export async function createGoal(input: {
  type: GoalType;
  targetValue: number;
  currentBaseline?: number | null;
  startDate?: string;
  endDate?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<Goal> {
  const validated = parseOrThrow(
    GoalSchema,
    {
      type: input.type,
      targetValue: input.targetValue,
      currentBaseline: input.currentBaseline ?? null,
      startDate: input.startDate ?? todayIst(),
      endDate: input.endDate ?? null,
      meta: input.meta ?? null,
    },
    'goal',
  );
  const supabase = getSupabase();
  const userId = await requireUserId();
  // Dedup: at most one active-or-paused goal per type. A same-type goal can be
  // created again once the prior is completed/abandoned. The form guards this for
  // UX; this catches direct/API/race paths.
  const { data: clashing, error: clashErr } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('type', validated.type)
    .in('status', ['active', 'paused'])
    .limit(1);
  if (clashErr) throw mapDbError(clashErr);
  if (clashing && clashing.length > 0) {
    throw new AppError('conflict', 'A goal of this type is already active.');
  }
  const id = makeId('gol');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('goals')
    .insert({
      id,
      user_id: userId,
      type: validated.type,
      target_value: validated.targetValue,
      current_baseline: validated.currentBaseline ?? null,
      start_date: validated.startDate,
      end_date: validated.endDate ?? null,
      status: 'active',
      meta_json: validated.meta ?? null,
      created_at: now,
    })
    .select('*')
    .single();
  if (error) throw mapDbError(error);
  return rowToGoal(data as Row);
}

export async function updateGoal(id: string, patch: GoalPatchInput): Promise<Goal> {
  parseOrThrow(IdSchema, id, 'goal_id');
  const validated = parseOrThrow(GoalPatchSchema, patch, 'goal_patch');
  const update: Record<string, unknown> = {};
  if (validated.targetValue !== undefined) update.target_value = validated.targetValue;
  if (validated.currentBaseline !== undefined) update.current_baseline = validated.currentBaseline;
  if (validated.endDate !== undefined) update.end_date = validated.endDate;
  if (validated.meta !== undefined) update.meta_json = validated.meta;

  const supabase = getSupabase();
  const userId = await requireUserId();
  // Empty patch is a no-op: return the current row rather than issue a blank UPDATE.
  const query =
    Object.keys(update).length === 0
      ? supabase.from('goals').select('*').eq('user_id', userId).eq('id', id).single()
      : supabase.from('goals').update(update).eq('user_id', userId).eq('id', id).select('*').single();
  const { data, error } = await query;
  if (error) throw mapDbError(error);
  return rowToGoal(data as Row);
}

export async function setGoalStatus(id: string, status: Goal['status']): Promise<void> {
  parseOrThrow(IdSchema, id, 'goal_id');
  parseOrThrow(GoalStatusSchema, status, 'goal_status');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('goals')
    .update({ status })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw mapDbError(error);
}

/**
 * Reconcile's completion: flips an ACTIVE goal to completed and reports whether a row
 * changed. 0 rows means another device set it aside or deleted it, so nothing happened
 * and no "Quit day." moment is owed. (A user's own status change uses `setGoalStatus`,
 * which must stay unconditional.)
 */
export async function completeGoalIfActive(id: string): Promise<boolean> {
  parseOrThrow(IdSchema, id, 'goal_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('goals')
    .update({ status: 'completed' })
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'active')
    .select('id');
  if (error) throw mapDbError(error);
  return (data?.length ?? 0) > 0;
}

/**
 * Reconcile's "met" mark: sets `metOn` on the CURRENT row's meta (never a stale snapshot
 * copy, which would resurrect steps and dismissals written since). Returns false when the
 * goal is gone, no longer active, or its cap moved since the plan was made.
 *
 * Not racy for the accept case: the UPDATE is conditional on `target_value`, and accepting a
 * proposal changes target_value and meta in one statement, so either accept lands first (0
 * rows here, replanned next time) or it lands after and rebuilds its meta without `metOn`.
 * ponytail: the meta itself is read-then-write, so a write that changes only meta (a dismissal)
 * inside the read-to-write gap is lost; a jsonb `||` merge in an RPC closes it if that ever matters.
 */
export async function markGoalMet(id: string, metOn: string, expectedTarget: number): Promise<boolean> {
  parseOrThrow(IdSchema, id, 'goal_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data: row, error: readError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();
  if (readError) throw mapDbError(readError);
  if (!row) return false;
  const current = rowToGoal(row as Row);
  if (current.targetValue !== expectedTarget) return false;
  const { data, error } = await supabase
    .from('goals')
    .update({ meta_json: { ...(current.meta ?? {}), metOn } })
    .eq('user_id', userId)
    .eq('id', id)
    .eq('status', 'active')
    .eq('target_value', expectedTarget)
    .select('id');
  if (error) throw mapDbError(error);
  return (data?.length ?? 0) > 0;
}

export async function deleteGoal(id: string): Promise<void> {
  parseOrThrow(IdSchema, id, 'goal_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('goals').delete().eq('user_id', userId).eq('id', id);
  if (error) throw mapDbError(error);
}
