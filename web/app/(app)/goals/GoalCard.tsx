'use client';

import * as React from 'react';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { evaluateGoal } from '@/domain/goals';
import { goalTypeLabel } from '@/domain/goalForm';
import type { GoalState } from '@/domain/goalAdherence';
import type { DismissKind } from '@/domain/goalMeta';
import type { Proposal } from '@/domain/goalProposals';
import { formatMoney } from '@/lib/format';
import { localeForCountry, timezoneForCountry } from '@/lib/regions';
import { isDiscreetMode } from '@/lib/discreet';
import { Button } from '@web/components/ui/Button';
import { ProgressRing } from '@web/components/ui/ProgressRing';
import { MetricRow } from '@web/components/visual';
import { GoalStateCaption } from './GoalStateCaption';
import { stateColor, type ProposalCopy } from '@web/lib/goals/goalCardModel';
import { doneLabel, proposalRowLabel } from './goalsView';

export interface GoalCardProps {
  goal: Goal;
  logs: CigaretteLog[];
  today: string;
  profile: UserProfile;
  busy: boolean;
  state: GoalState;
  overDays: number;
  heldDays: number;
  proposal: Proposal | null;
  proposalCopy: ProposalCopy | null;
  /** `targetPrefill` seeds the form's target (the proposal's value) when editing from a proposal. */
  onEdit: (goal: Goal, targetPrefill?: string) => void;
  onStatus: (goal: Goal, status: Goal['status']) => void;
  onDelete: (goal: Goal) => void;
  onAccept: (goal: Goal, p: Proposal) => void;
  onDismiss: (goal: Goal, kind: DismissKind) => void;
}

export function GoalCard({
  goal,
  logs,
  today,
  profile,
  busy,
  state,
  overDays,
  heldDays,
  proposal,
  proposalCopy,
  onEdit,
  onStatus,
  onDelete,
  onAccept,
  onDismiss,
}: GoalCardProps) {
  const progress = evaluateGoal(goal, logs, today, {
    currency: profile.currency,
    locale: localeForCountry(profile.country),
  });
  // Spend goals embed ₹ values in their label/explanation — hide those under discreet mode.
  const hideMoney = goal.type === 'spend_cap_daily' && isDiscreetMode(profile);
  const pct = Math.round(Math.max(0, Math.min(100, progress.percent)));
  // Teal only when on track or met; terracotta for any concern. Never alarm-red.
  // Same token for the figure and the gauge so they read as one mark.
  const toneColor = stateColor(state);
  const isDone = goal.status === 'completed' || goal.status === 'abandoned';
  // A proposal is only ever next/reanchor on a card; "start" belongs to the create form.
  const dismissKind: DismissKind | null =
    proposal && proposalCopy && proposal.kind !== 'start' ? proposal.kind : null;
  const heading = hideMoney ? goalTypeLabel(goal.type) : progress.label;
  const explanation = hideMoney ? 'Spend hidden in discreet mode.' : progress.explanation;

  // Surface remaining headroom for cap-type goals — data evaluateGoal already returns.
  const isCap =
    goal.type === 'daily_cap' || goal.type === 'weekly_target' || goal.type === 'spend_cap_daily';
  const remainingText =
    !isCap || hideMoney || !progress.isOnTrack
      ? null
      : goal.type === 'spend_cap_daily'
        ? `${formatMoney(progress.remaining, profile.currency, { locale: localeForCountry(profile.country) })} of ${formatMoney(progress.valueTarget, profile.currency, { locale: localeForCountry(profile.country) })} left today`
        : `${progress.remaining} of ${progress.valueTarget} left ${goal.type === 'weekly_target' ? 'this week' : 'today'}`;

  return (
    <article className="rule-hair py-md flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-md">
        <div className="min-w-0 flex-1">
          <h3 className="text-body text-text min-w-0">{heading}</h3>
          {goal.status === 'active' ? (
            <div>
              <GoalStateCaption state={state} overDays={overDays} heldDays={heldDays} />
            </div>
          ) : null}
          {!isDone ? (
            <span className="editorial-numeral--micro nums-tabular" style={{ color: toneColor }}>
              {pct}%
            </span>
          ) : null}
        </div>
        {!isDone ? (
          <div
            role="progressbar"
            aria-label={`${goalTypeLabel(goal.type)} progress`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="shrink-0"
          >
            <ProgressRing percent={pct} color={toneColor} ringBg="var(--rule)" size={44} strokeWidth={4} />
          </div>
        ) : null}
      </div>

      {isDone ? (
        <p className="text-small text-text-muted">{doneLabel(goal.status, goal.completedAt, timezoneForCountry(profile.country))}</p>
      ) : (
        <p className="text-small text-text-muted">
          {explanation}
          {remainingText ? <span className="text-text-muted"> · {remainingText}</span> : null}
        </p>
      )}

      {proposal && proposalCopy && dismissKind ? (
        <div className="flex flex-col gap-sm">
          <dl>
            <MetricRow
              label={proposalRowLabel(proposal.kind)}
              subtitle={proposalCopy.basis}
              value={proposalCopy.valueLabel}
            />
          </dl>
          <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">{proposalCopy.headline}</p>
          <div className="flex flex-wrap gap-sm">
            <Button title="Accept" variant="secondary" size="sm" disabled={busy} onPress={() => onAccept(goal, proposal)} />
            <Button
              title="Edit"
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={() => onEdit(goal, String(proposal.value))}
            />
            <Button title="Not now" variant="ghost" size="sm" disabled={busy} onPress={() => onDismiss(goal, dismissKind)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-sm mt-xs">
        {!isDone && !dismissKind ? (
          <Button title="Edit" variant="ghost" size="sm" disabled={busy} onPress={() => onEdit(goal)} />
        ) : null}
        {goal.status === 'active' ? (
          <Button title="Pause" variant="ghost" size="sm" disabled={busy} onPress={() => onStatus(goal, 'paused')} />
        ) : null}
        {goal.status === 'paused' ? (
          <Button title="Resume" variant="ghost" size="sm" disabled={busy} onPress={() => onStatus(goal, 'active')} />
        ) : null}
        {!isDone ? (
          <Button
            title="Mark complete"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => onStatus(goal, 'completed')}
          />
        ) : null}
        <Button title="Delete" variant="danger" size="sm" disabled={busy} onPress={() => onDelete(goal)} />
      </div>
    </article>
  );
}

export default GoalCard;
