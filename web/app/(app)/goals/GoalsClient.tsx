'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { safeRevalidateAppViews as revalidateAppViews } from '@web/lib/safeRevalidate';
import { createGoal, updateGoal, setGoalStatus, deleteGoal } from '@/db/repositories/goals';
import { toSafeErrorMessage } from '@/lib/errors';
import {
  GOAL_TYPE_META,
  emptyGoalForm,
  goalToFormState,
  buildGoalPayload,
  buildGoalPatch,
  blockingSameTypeGoal,
  goalTypeLabel,
  deriveReductionBaseline,
  type GoalFormState,
} from '@/domain/goalForm';
import { GoalCard } from './GoalCard';
import { Button } from '@web/components/ui/Button';
import { Input } from '@web/components/ui/Input';
import { ConfirmDialog } from '@web/components/ui/ConfirmDialog';
import { EmptyState } from '@web/components/ui/EmptyState';
import { Text } from '@web/components/ui/Text';
import { cn } from '@web/components/ui/cn';
import { SectionLabel } from '@web/components/visual';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { dispatchGoalCompletion, dispatchGoalDeletion } from '@web/lib/character/mood';

export interface GoalsClientProps {
  goals: Goal[];
  logs: CigaretteLog[];
  today: string;
  profile: UserProfile;
}

type BusyKey = null | 'submit' | string;

// ── Goal type picker ────────────────────────────────────────────────────────

interface TypePickerProps {
  value: GoalFormState['type'];
  onChange: (t: GoalFormState['type']) => void;
  disabled?: boolean;
}

function TypePicker({ value, onChange, disabled }: TypePickerProps) {
  return (
    <div role="group" aria-label="Goal type" className="flex flex-wrap gap-sm">
      {GOAL_TYPE_META.map((m) => (
        <button
          key={m.type}
          type="button"
          role="button"
          aria-pressed={value === m.type}
          disabled={disabled}
          onClick={() => onChange(m.type)}
          className={cn(
            'px-md py-sm rounded-full border text-small font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === m.type
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-transparent text-text-muted hover:border-text-muted',
            disabled && 'opacity-50 pointer-events-none',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── Goal create / edit form ─────────────────────────────────────────────────

interface GoalFormProps {
  form: GoalFormState;
  logs: CigaretteLog[];
  today: string;
  isEdit: boolean;
  busy: boolean;
  error: string | null;
  onFormChange: (updates: Partial<GoalFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function GoalForm({
  form,
  logs,
  today,
  isEdit,
  busy,
  error,
  onFormChange,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const meta = GOAL_TYPE_META.find((m) => m.type === form.type)!;
  const derivedBaseline = deriveReductionBaseline(logs, today);
  const baselineHint =
    derivedBaseline > 0
      ? `Your 30-day average is ${derivedBaseline} sticks/day — leave blank to use this.`
      : 'Not enough recent logs to derive a baseline — enter one manually.';

  return (
    <div className="border border-border rounded-lg p-lg flex flex-col gap-md bg-card">
      <Text variant="h3">{isEdit ? 'Edit goal' : 'New goal'}</Text>

      {!isEdit ? (
        <div className="flex flex-col gap-sm">
          <span className="text-caption uppercase text-text-muted">Type</span>
          <TypePicker value={form.type} onChange={(t) => onFormChange({ type: t, target: '', baseline: '', quitDate: '' })} disabled={busy} />
          <p className="text-small text-text-muted">{meta.blurb}</p>
        </div>
      ) : (
        <p className="text-small text-text-muted">{meta.label} · {meta.blurb}</p>
      )}

      {(form.type === 'daily_cap' || form.type === 'weekly_target' || form.type === 'spend_cap_daily') && (
        <Input
          label={`Target (${meta.targetUnit})`}
          type="number"
          min="0.01"
          step="any"
          value={form.target}
          onChange={(e) => onFormChange({ target: e.target.value })}
          disabled={busy}
          placeholder="e.g. 5"
        />
      )}

      {form.type === 'reduction_target' && (
        <>
          <Input
            label={`Target (${meta.targetUnit})`}
            type="number"
            min="0.01"
            step="any"
            value={form.target}
            onChange={(e) => onFormChange({ target: e.target.value })}
            disabled={busy}
            placeholder="e.g. 5"
          />
          <Input
            label="Baseline (sticks/day)"
            type="number"
            min="0.01"
            step="any"
            value={form.baseline}
            onChange={(e) => onFormChange({ baseline: e.target.value })}
            disabled={busy}
            placeholder={String(derivedBaseline || '')}
            hint={baselineHint}
          />
        </>
      )}

      {form.type === 'no_smoke_window' && (
        <div className="flex gap-md">
          <Input
            label="Start hour (0–23)"
            type="number"
            min="0"
            max="23"
            step="1"
            value={String(form.startHour)}
            onChange={(e) => onFormChange({ startHour: Number(e.target.value) })}
            disabled={busy}
            containerClassName="flex-1"
          />
          <Input
            label="End hour (0–23)"
            type="number"
            min="0"
            max="23"
            step="1"
            value={String(form.endHour)}
            onChange={(e) => onFormChange({ endHour: Number(e.target.value) })}
            disabled={busy}
            containerClassName="flex-1"
          />
        </div>
      )}

      {form.type === 'quit_date' && (
        <>
          <Input
            label="Quit date"
            type="date"
            min={today}
            value={form.quitDate}
            onChange={(e) => onFormChange({ quitDate: e.target.value })}
            disabled={busy}
          />
          <Input
            label="Baseline (sticks/day, optional)"
            type="number"
            min="0.01"
            step="any"
            value={form.baseline}
            onChange={(e) => onFormChange({ baseline: e.target.value })}
            disabled={busy}
            placeholder={String(derivedBaseline || '')}
            hint={baselineHint}
          />
        </>
      )}

      {error ? <p className="text-small text-danger">{error}</p> : null}

      <div className="flex gap-sm mt-sm">
        <Button title={isEdit ? 'Save' : 'Create goal'} onPress={onSubmit} loading={busy} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
      </div>
    </div>
  );
}

// ── Main client ─────────────────────────────────────────────────────────────

export function GoalsClient({ goals, logs, today, profile }: GoalsClientProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<BusyKey>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Goal | null>(null);
  const [formState, setFormState] = React.useState<GoalFormState>(emptyGoalForm());
  const [formError, setFormError] = React.useState<string | null>(null);

  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status === 'paused');
  const done = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');

  function openCreate() {
    setEditing(null);
    setFormState(emptyGoalForm());
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setFormState(goalToFormState(goal));
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }

  function patchForm(updates: Partial<GoalFormState>) {
    setFormState((prev) => ({ ...prev, ...updates }));
    setFormError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    if (editing) {
      const result = buildGoalPatch(formState, logs, today);
      if (!result.ok) { setFormError(result.error); return; }
      setBusy('submit');
      try {
        await updateGoal(editing.id, result.patch);
        await revalidateAppViews();
        router.refresh();
        closeForm();
      } catch (err) {
        setFormError(toSafeErrorMessage(err));
      } finally {
        setBusy(null);
      }
    } else {
      const blocker = blockingSameTypeGoal(formState.type, goals);
      if (blocker) {
        setFormError(
          `You already have a ${goalTypeLabel(formState.type).toLowerCase()} goal. Complete it before adding another.`,
        );
        return;
      }
      const result = buildGoalPayload(formState, logs, today);
      if (!result.ok) { setFormError(result.error); return; }
      setBusy('submit');
      try {
        await createGoal(result.payload);
        await revalidateAppViews();
        router.refresh();
        closeForm();
      } catch (err) {
        setFormError(toSafeErrorMessage(err));
      } finally {
        setBusy(null);
      }
    }
  }

  async function handleStatus(goal: Goal, status: Goal['status']) {
    setBusy(goal.id);
    try {
      await setGoalStatus(goal.id, status);
      if (status === 'completed') {
        dispatchGoalCompletion({
          title: 'Well kept.',
          body: `You stayed true to your ${goalTypeLabel(goal.type).toLowerCase()}. That counts.`,
        });
      }
      await revalidateAppViews();
      router.refresh();
    } catch {
      // status change failure is non-critical; just unblock
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, status } = deleteTarget;
    setDeleteTarget(null);
    setBusy(id);
    try {
      await deleteGoal(id);
      // Sentiment only when an unaccomplished goal is let go — not a completed/abandoned one.
      if (status === 'active' || status === 'paused') {
        dispatchGoalDeletion({
          title: 'No judgment.',
          body: 'Every attempt teaches you something.',
        });
      }
      await revalidateAppViews();
      router.refresh();
    } catch {
      // deletion failure is non-critical; page will re-render fresh
    } finally {
      setBusy(null);
    }
  }

  const cardBusy = busy !== null && busy !== 'submit';
  const idx = (n: number): React.CSSProperties => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="editorial-stage flex flex-col subsection-gap max-w-2xl mx-auto px-lg md:px-xxl">
      {/* Masthead */}
      <div style={idx(0)} className="flex items-start justify-between gap-md">
        <EditorialMasthead
          caption="the ledger"
          title="Goals"
          subtitle="Set a cap, a window, or a quit date. Reviewed quietly."
        />
        {!showForm ? (
          <Button title="New goal" variant="secondary" size="sm" onPress={openCreate} />
        ) : null}
      </div>

      {/* Create / edit form */}
      {showForm ? (
        <div style={idx(1)}>
          <GoalForm
            form={formState}
            logs={logs}
            today={today}
            isEdit={editing !== null}
            busy={busy === 'submit'}
            error={formError}
            onFormChange={patchForm}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      {/* Empty state */}
      {goals.length === 0 && !showForm ? (
        <div style={idx(1)}>
          <EmptyState
            title="No goals yet"
            description="Set a daily cap, a spend limit, or a quit date to start tracking progress."
            actionLabel="Set your first goal"
            onAction={openCreate}
          />
        </div>
      ) : null}

      {/* Active */}
      {active.length > 0 ? (
        <section style={idx(2)} aria-labelledby="goals-active">
          <SectionLabel id="goals-active">Active</SectionLabel>
          <div className="flex flex-col">
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                logs={logs}
                today={today}
                profile={profile}
                busy={cardBusy && busy === g.id}
                onEdit={openEdit}
                onStatus={handleStatus}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Paused */}
      {paused.length > 0 ? (
        <section style={idx(3)} aria-labelledby="goals-paused">
          <SectionLabel id="goals-paused">Paused</SectionLabel>
          <div className="flex flex-col">
            {paused.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                logs={logs}
                today={today}
                profile={profile}
                busy={cardBusy && busy === g.id}
                onEdit={openEdit}
                onStatus={handleStatus}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Completed / abandoned */}
      {done.length > 0 ? (
        <section style={idx(4)} aria-labelledby="goals-done">
          <SectionLabel id="goals-done">Completed &amp; abandoned</SectionLabel>
          <div className="flex flex-col">
            {done.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                logs={logs}
                today={today}
                profile={profile}
                busy={cardBusy && busy === g.id}
                onEdit={openEdit}
                onStatus={handleStatus}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete goal?"
        description="This cannot be undone. Your logged progress is not affected."
        confirmLabel="Delete"
        destructive
        loading={busy === deleteTarget?.id}
        onConfirm={handleDelete}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      />
    </div>
  );
}

export default GoalsClient;
