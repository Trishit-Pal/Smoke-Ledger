'use client';

import * as React from 'react';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { evaluateGoal } from '@/domain/goals';
import { goalTypeLabel } from '@/domain/goalForm';
import { isDiscreetMode } from '@/lib/discreet';
import { Button } from '@web/components/ui/Button';
import { ProgressBar } from '@web/components/ui/ProgressBar';

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
  const progress = evaluateGoal(goal, logs, today);
  // Spend goals embed ₹ values in their label/explanation — hide those under discreet mode.
  const hideMoney = goal.type === 'spend_cap_daily' && isDiscreetMode(profile);
  const pct = Math.round(Math.max(0, Math.min(100, progress.percent)));
  const tone = progress.atRisk ? 'warn' : progress.isOnTrack ? 'success' : 'default';
  const heading = hideMoney ? goalTypeLabel(goal.type) : progress.label;
  const explanation = hideMoney ? 'Spend hidden in discreet mode.' : progress.explanation;

  return (
    <div className="border border-border rounded-lg p-lg flex flex-col gap-sm bg-card">
      <div className="flex items-baseline justify-between gap-md">
        <h3 className="text-body-strong text-text">{heading}</h3>
        <span
          className="text-small nums-tabular shrink-0"
          style={{
            color: progress.atRisk
              ? 'var(--warn-earth)'
              : progress.isOnTrack
              ? 'var(--accent)'
              : 'var(--text-muted)',
          }}
        >
          {pct}%
        </span>
      </div>

      <ProgressBar value={pct} tone={tone} aria-label={`${goalTypeLabel(goal.type)} progress`} />

      <p className="text-small text-text-muted">{explanation}</p>

      <div className="flex flex-wrap gap-sm mt-sm">
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
    </div>
  );
}

export default GoalCard;
