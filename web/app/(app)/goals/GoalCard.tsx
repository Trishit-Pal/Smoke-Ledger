'use client';

import * as React from 'react';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { evaluateGoal } from '@/domain/goals';
import { goalTypeLabel } from '@/domain/goalForm';
import { formatMoney } from '@/lib/format';
import { localeForCountry } from '@/lib/regions';
import { isDiscreetMode } from '@/lib/discreet';
import { Button } from '@web/components/ui/Button';
import { ProgressRing } from '@web/components/ui/ProgressRing';

export interface GoalCardProps {
  goal: Goal;
  logs: CigaretteLog[];
  today: string;
  profile: UserProfile;
  busy: boolean;
  onEdit: (goal: Goal) => void;
  onStatus: (goal: Goal, status: Goal['status']) => void;
  onDelete: (goal: Goal) => void;
}

export function GoalCard({ goal, logs, today, profile, busy, onEdit, onStatus, onDelete }: GoalCardProps) {
  const progress = evaluateGoal(goal, logs, today, {
    currency: profile.currency,
    locale: localeForCountry(profile.country),
  });
  // Spend goals embed ₹ values in their label/explanation — hide those under discreet mode.
  const hideMoney = goal.type === 'spend_cap_daily' && isDiscreetMode(profile);
  const pct = Math.round(Math.max(0, Math.min(100, progress.percent)));
  // Teal only when genuinely on track; terracotta for any concern — approaching
  // OR over the limit. Never alarm-red, and never a muted bar for a breached cap:
  // the worst state must read as the loudest, not the quietest. Same token for
  // the figure and the gauge so they read as one mark.
  const toneColor =
    progress.isOnTrack && !progress.atRisk ? 'var(--accent)' : 'var(--warn-earth)';
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
          <span className="editorial-numeral--micro nums-tabular" style={{ color: toneColor }}>
            {pct}%
          </span>
        </div>
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
      </div>

      <p className="text-small text-text-muted">
        {explanation}
        {remainingText ? <span className="text-text-muted"> · {remainingText}</span> : null}
      </p>

      <div className="flex flex-wrap gap-sm mt-xs">
        <Button title="Edit" variant="ghost" size="sm" disabled={busy} onPress={() => onEdit(goal)} />
        {goal.status === 'active' ? (
          <Button title="Pause" variant="ghost" size="sm" disabled={busy} onPress={() => onStatus(goal, 'paused')} />
        ) : (
          <Button title="Resume" variant="ghost" size="sm" disabled={busy} onPress={() => onStatus(goal, 'active')} />
        )}
        {goal.status !== 'completed' ? (
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
