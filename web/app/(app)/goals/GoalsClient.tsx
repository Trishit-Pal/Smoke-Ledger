'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeRevalidateAppViews as revalidateAppViews } from '@web/lib/safeRevalidate';
import { createGoal, updateGoal, setGoalStatus, deleteGoal } from '@/db/repositories/goals';
import { toSafeErrorMessage } from '@/lib/errors';
import {
  GOAL_TYPE_META,
  creatableGoalTypes,
  emptyGoalForm,
  proposalToForm,
  goalToFormState,
  buildGoalPayload,
  buildGoalPatch,
  acceptProposalPatch,
  dismissProposalPatch,
  blockingSameTypeGoal,
  goalTypeLabel,
  deriveReductionBaseline,
  type GoalFormState,
} from '@/domain/goalForm';
import { describeProposal, proposeStart, type Proposal } from '@/domain/goalProposals';
import type { DismissKind, SpendPeriod } from '@/domain/goalMeta';
import { formatMoney } from '@/lib/format';
import { localeForCountry } from '@/lib/regions';
import { formatIndianDate } from '@/lib/date';
import { isDiscreetMode } from '@/lib/discreet';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { GoalCard } from './GoalCard';
import { GoalProposal } from './GoalProposal';
import {
  goalCardModel,
  isFromProposal,
  offersStartProposal,
  parseTypeParam,
  periodUnitLabel,
  unseenActiveTypes,
} from './goalsView';
import { useGoalReconcile } from '@web/lib/goals/useGoalReconcile';
import { Button } from '@web/components/ui/Button';
import { Input } from '@web/components/ui/Input';
import { ConfirmDialog } from '@web/components/ui/ConfirmDialog';
import { EmptyState } from '@web/components/ui/EmptyState';
import { ChoiceRun, SectionLabel } from '@web/components/visual';
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

const TYPE_OPTIONS = creatableGoalTypes().map((m) => ({ value: m.type, label: m.label }));
const PERIOD_OPTIONS: readonly { value: SpendPeriod; label: string }[] = [
  { value: 'day', label: 'Per day' },
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per month' },
];
const NO_PROPOSAL_LINE = 'Not enough days logged to suggest one yet — enter a number.';

// ── Goal create / edit form ─────────────────────────────────────────────────

interface GoalFormProps {
  form: GoalFormState;
  logs: CigaretteLog[];
  today: string;
  profile: UserProfile;
  isEdit: boolean;
  busy: boolean;
  error: string | null;
  /** True once the user has taken ("Use") or declined ("Choose my own") the offered proposal. */
  proposalDecided: boolean;
  onFormChange: (updates: Partial<GoalFormState>) => void;
  onUseProposal: (updates: Partial<GoalFormState>) => void;
  onChooseOwn: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function GoalForm({
  form,
  logs,
  today,
  profile,
  isEdit,
  busy,
  error,
  proposalDecided,
  onFormChange,
  onUseProposal,
  onChooseOwn,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const meta = GOAL_TYPE_META.find((m) => m.type === form.type)!;
  const firstFieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isSpend = form.type === 'spend_cap_daily';
  const targetUnit = isSpend ? periodUnitLabel(profile.currency, form.period) : meta.targetUnit;
  const derivedBaseline = deriveReductionBaseline(logs, today);
  const baselineHint =
    derivedBaseline > 0
      ? `Your 30-day average is ${derivedBaseline} sticks/day — leave blank to use this.`
      : 'Not enough recent logs to derive a baseline — enter one manually.';

  const proposal = React.useMemo(
    () =>
      isEdit || !offersStartProposal(form.type)
        ? null
        : proposeStart(form.type, logs, today, { currency: profile.currency, period: form.period }),
    [isEdit, form.type, form.period, logs, today, profile.currency],
  );
  const hideMoney = isDiscreetMode(profile) && form.type === 'spend_cap_daily';
  const copy = proposal
    ? describeProposal(proposal, {
        formatMoney: (n) => formatMoney(n, profile.currency, { locale: localeForCountry(profile.country) }),
        formatDate: formatIndianDate,
        hideMoney,
      })
    : null;
  const offered = !isEdit && !proposalDecided && proposal && copy ? { proposal, copy } : null;
  const showInputs = isEdit || !offered;
  const showNoProposal = !isEdit && offersStartProposal(form.type) && proposal === null;

  // Use / Choose my own unmount the buttons that held focus; land it on the first field instead.
  React.useEffect(() => {
    if (proposalDecided && !isEdit) firstFieldRef.current?.focus();
  }, [proposalDecided, isEdit]);

  return (
    <div className="border border-border rounded-lg p-lg flex flex-col gap-md bg-card">
      <SectionLabel spacing="sm">{isEdit ? 'Edit goal' : 'New goal'}</SectionLabel>

      {!isEdit ? (
        <div className="flex flex-col gap-sm">
          <span className="text-caption uppercase text-text-muted">Type</span>
          <ChoiceRun
            ariaLabel="Goal type"
            options={TYPE_OPTIONS}
            value={form.type}
            allowClear={false}
            onSelect={(t) => {
              if (t && !busy && t !== form.type) onFormChange({ type: t, target: '', baseline: '', quitDate: '', finalTarget: '', period: 'day' });
            }}
          />
          <p className="text-small text-text-muted">{meta.blurb}</p>
        </div>
      ) : (
        <p className="text-small text-text-muted">{meta.label} · {meta.blurb}</p>
      )}

      {isSpend && !isEdit ? (
        <ChoiceRun
          ariaLabel="Spend period"
          options={PERIOD_OPTIONS}
          value={form.period}
          allowClear={false}
          onSelect={(period) => {
            if (period && !busy && period !== form.period) onFormChange({ period, target: '' });
          }}
        />
      ) : null}
      {isSpend && isEdit ? (
        <p className="text-small text-text-muted">
          {PERIOD_OPTIONS.find((o) => o.value === form.period)?.label}, fixed when the goal was created.
        </p>
      ) : null}

      {offered ? (
        <GoalProposal
          proposal={offered.proposal}
          copy={offered.copy}
          busy={busy}
          hidden={hideMoney}
          onUse={() => onUseProposal(proposalToForm(offered.proposal))}
          onChooseOwn={onChooseOwn}
        />
      ) : null}
      {showNoProposal ? <p className="text-small text-text-muted">{NO_PROPOSAL_LINE}</p> : null}

      {showInputs && (form.type === 'daily_cap' || form.type === 'weekly_target' || form.type === 'spend_cap_daily') && (
        <Input
          ref={firstFieldRef}
          label={`Target (${targetUnit})`}
          type="number"
          min="0.01"
          step="any"
          value={form.target}
          onChange={(e) => onFormChange({ target: e.target.value })}
          disabled={busy}
          placeholder="e.g. 5"
        />
      )}

      {showInputs && form.type === 'taper' && (
        <>
          <Input
            ref={firstFieldRef}
            label="Starting cap (sticks/day)"
            type="number"
            min="0.01"
            step="any"
            value={form.target}
            onChange={(e) => onFormChange({ target: e.target.value })}
            disabled={busy}
            placeholder="e.g. 8"
          />
          <Input
            label="Final target (sticks/day)"
            type="number"
            min="0.01"
            step="any"
            value={form.finalTarget}
            onChange={(e) => onFormChange({ finalTarget: e.target.value })}
            disabled={busy}
            placeholder="e.g. 2"
          />
          <p className="text-small text-text-muted">Steps down every 14 days, each one offered first.</p>
        </>
      )}

      {showInputs && form.type === 'reduction_target' && (
        <>
          <Input
            ref={firstFieldRef}
            label={`Target (${targetUnit})`}
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

      {showInputs && form.type === 'no_smoke_window' && (
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

      {showInputs && form.type === 'quit_date' && (
        <>
          <Input
            ref={firstFieldRef}
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
        <Button title={isEdit ? 'Save' : 'Create goal'} onPress={onSubmit} loading={busy} disabled={offered !== null} />
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
  // The form as seeded by "Use" (null until then) and whether the user took "Choose my own".
  const [seeded, setSeeded] = React.useState<GoalFormState | null>(null);
  const [choseOwn, setChoseOwn] = React.useState(false);
  const searchParams = useSearchParams();
  const typeParam = parseTypeParam(searchParams.get('type'));

  const [notice, setNotice] = React.useState<string | null>(null);
  const { view, failedNotice } = useGoalReconcile(goals, logs, today);

  const active = view.filter((g) => g.status === 'active');
  const paused = view.filter((g) => g.status === 'paused');
  const done = view.filter((g) => g.status === 'completed' || g.status === 'abandoned');
  const pageNotice = [notice, failedNotice].filter(Boolean).join(' ') || null;

  const cardModels = React.useMemo(() => {
    const fmtMoney = (n: number) => formatMoney(n, profile.currency, { locale: localeForCountry(profile.country) });
    return new Map(
      view.map((g) => [
        g.id,
        goalCardModel(g, logs, today, {
          currency: profile.currency,
          formatMoney: fmtMoney,
          formatDate: formatIndianDate,
          hideMoney: isDiscreetMode(profile) && g.type === 'spend_cap_daily',
        }),
      ]),
    );
  }, [view, logs, today, profile]);

  // One progress-viewed event per goal type per mount.
  const viewedTypes = React.useRef(new Set<Goal['type']>());
  React.useEffect(() => {
    for (const type of unseenActiveTypes(view, viewedTypes.current)) {
      viewedTypes.current.add(type);
      void track(AnalyticsEvents.GOAL_PROGRESS_VIEWED, { goal_type: type });
    }
  }, [view]);

  function openCreate(type?: GoalFormState['type']) {
    setEditing(null);
    setFormState(emptyGoalForm(type));
    setSeeded(null);
    setChoseOwn(false);
    setFormError(null);
    setShowForm(true);
  }

  // `?type=` opens the create form with that type selected, once, on mount.
  const openedFromParam = React.useRef(false);
  React.useEffect(() => {
    if (openedFromParam.current || !typeParam) return;
    openedFromParam.current = true;
    openCreate(typeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  function openEdit(goal: Goal, targetPrefill?: string) {
    setEditing(goal);
    const base = goalToFormState(goal);
    setFormState(targetPrefill === undefined ? base : { ...base, target: targetPrefill });
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
    // A new type or period means a new proposal: offer it afresh.
    if (updates.type !== undefined || updates.period !== undefined) {
      setSeeded(null);
      setChoseOwn(false);
    }
    setFormError(null);
  }

  function useProposal(updates: Partial<GoalFormState>) {
    const next = { ...formState, ...updates };
    setFormState(next);
    setSeeded(next);
    setFormError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    if (editing) {
      const result = buildGoalPatch(formState, logs, today, editing);
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
      const blocker = blockingSameTypeGoal(formState.type, view);
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
        void track(AnalyticsEvents.GOAL_CREATED, {
          type: formState.type,
          from_proposal: isFromProposal(formState, seeded),
        });
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

  // Runs a card action: busy while it runs, a quiet page notice if it fails, never swallowed.
  async function runGoalAction(id: string, action: () => Promise<void>) {
    setNotice(null);
    setBusy(id);
    try {
      await action();
      await revalidateAppViews();
      router.refresh();
    } catch (err) {
      setNotice(toSafeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const handleStatus = (goal: Goal, status: Goal['status']) =>
    runGoalAction(goal.id, async () => {
      await setGoalStatus(goal.id, status);
      if (status === 'completed') {
        dispatchGoalCompletion({
          title: 'Well kept.',
          body: `You stayed true to your ${goalTypeLabel(goal.type).toLowerCase()}. That counts.`,
        });
      }
    });

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, status } = deleteTarget;
    setDeleteTarget(null);
    await runGoalAction(id, async () => {
      await deleteGoal(id);
      // Sentiment only when an unaccomplished goal is let go — not a completed/abandoned one.
      if (status === 'active' || status === 'paused') {
        dispatchGoalDeletion({
          title: 'No judgment.',
          body: 'Every attempt teaches you something.',
        });
      }
    });
  }

  const handleAccept = (goal: Goal, p: Proposal) =>
    runGoalAction(goal.id, async () => {
      await updateGoal(goal.id, acceptProposalPatch(goal, p, today));
      void track(AnalyticsEvents.GOAL_PROPOSAL_ACCEPTED, { type: goal.type, kind: p.kind });
    });

  const handleDismiss = (goal: Goal, kind: DismissKind) =>
    runGoalAction(goal.id, async () => {
      await updateGoal(goal.id, dismissProposalPatch(goal, kind, today));
      void track(AnalyticsEvents.GOAL_PROPOSAL_DISMISSED, { type: goal.type, kind });
    });

  const cardBusy = busy !== null && busy !== 'submit';
  const renderCard = (g: Goal) => {
    const m = cardModels.get(g.id)!;
    return (
      <GoalCard
        key={g.id}
        goal={g}
        logs={logs}
        today={today}
        profile={profile}
        busy={cardBusy && busy === g.id}
        state={m.state}
        overDays={m.overDays}
        heldDays={m.heldDays}
        proposal={m.proposal}
        proposalCopy={m.copy}
        onEdit={openEdit}
        onStatus={handleStatus}
        onDelete={setDeleteTarget}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
      />
    );
  };
  const idx = (n: number): React.CSSProperties => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  return (
    <div className="editorial-stage flex flex-col subsection-gap page-column">
      {/* Masthead */}
      <div style={idx(0)} className="flex items-start justify-between gap-md">
        <EditorialMasthead
          caption="the ledger"
          title="Goals"
          subtitle="The ledger suggests; you decide. Reviewed quietly."
        />
        {!showForm ? (
          <Button title="New goal" variant="secondary" size="sm" onPress={() => openCreate()} />
        ) : null}
      </div>

      {pageNotice ? (
        <p role="alert" className="text-small text-danger">
          {pageNotice}
        </p>
      ) : null}

      {/* Create / edit form */}
      {showForm ? (
        <div style={idx(1)}>
          <GoalForm
            form={formState}
            logs={logs}
            today={today}
            profile={profile}
            isEdit={editing !== null}
            busy={busy === 'submit'}
            error={formError}
            proposalDecided={seeded !== null || choseOwn}
            onFormChange={patchForm}
            onUseProposal={useProposal}
            onChooseOwn={() => setChoseOwn(true)}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      {/* Empty state */}
      {view.length === 0 && !showForm ? (
        <div style={idx(1)}>
          <EmptyState
            title="No goals yet"
            description="Set a daily cap, a spend limit, or a quit date to start tracking progress."
            actionLabel="Set your first goal"
            onAction={() => openCreate()}
          />
        </div>
      ) : null}

      {/* Active */}
      {active.length > 0 ? (
        <section style={idx(2)} aria-labelledby="goals-active">
          <SectionLabel id="goals-active">Active</SectionLabel>
          <div className="flex flex-col">
            {active.map(renderCard)}
          </div>
        </section>
      ) : null}

      {/* Paused */}
      {paused.length > 0 ? (
        <section style={idx(3)} aria-labelledby="goals-paused">
          <SectionLabel id="goals-paused">Paused</SectionLabel>
          <div className="flex flex-col">
            {paused.map(renderCard)}
          </div>
        </section>
      ) : null}

      {/* Completed / abandoned */}
      {done.length > 0 ? (
        <section style={idx(4)} aria-labelledby="goals-done">
          <SectionLabel id="goals-done">Completed &amp; abandoned</SectionLabel>
          <div className="flex flex-col">
            {done.map(renderCard)}
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
