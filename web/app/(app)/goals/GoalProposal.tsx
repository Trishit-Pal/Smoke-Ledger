'use client';

import * as React from 'react';
import { Button } from '@web/components/ui/Button';
import { MetricRow } from '@web/components/visual';
import type { Proposal } from '@/domain/goalProposals';
import { proposalButtonLabel } from './goalsView';

export interface GoalProposalProps {
  proposal: Proposal;
  copy: { headline: string; basis: string; valueLabel: string };
  onUse: () => void;
  onChooseOwn: () => void;
  busy: boolean;
  /** Discreet mode: the value is masked, so the button must not name it. */
  hidden?: boolean;
}

/** A ledger-derived starting value, offered before the form's inputs. Presentational only. */
export function GoalProposal({ copy, onUse, onChooseOwn, busy, hidden = false }: GoalProposalProps) {
  return (
    <div className="flex flex-col gap-sm">
      <dl>
        <MetricRow variant="first" label="Your last 14 days" subtitle={copy.basis} value={copy.valueLabel} />
      </dl>
      <p className="editorial-headline text-[clamp(1.125rem,2vw,1.375rem)] text-text">{copy.headline}</p>
      <div className="flex flex-wrap gap-sm">
        <Button title={proposalButtonLabel(copy.valueLabel, hidden)} variant="secondary" size="sm" onPress={onUse} disabled={busy} />
        <Button title="Choose my own" variant="ghost" size="sm" onPress={onChooseOwn} disabled={busy} />
      </div>
    </div>
  );
}
