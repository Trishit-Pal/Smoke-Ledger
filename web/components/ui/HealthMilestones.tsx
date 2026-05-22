'use client';

import * as React from 'react';
import { milestoneProgress, formatMinutesUntil } from '@/domain/health';
import { HEALTH_MILESTONES } from '@/constants/milestones';
import { Card } from '@web/components/ui/Card';
import { cn } from '@web/components/ui/cn';

export interface HealthMilestonesProps {
  lastSmokeIso: string | null | undefined;
}

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function HealthMilestones({ lastSmokeIso }: HealthMilestonesProps) {
  const progress = React.useMemo(
    () => milestoneProgress(lastSmokeIso ?? null),
    [lastSmokeIso],
  );

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress.fractionToNext);

  const currentIdx = progress.current
    ? HEALTH_MILESTONES.findIndex((m) => m.minutes === progress.current!.minutes)
    : -1;
  const nextIdx = progress.next
    ? HEALTH_MILESTONES.findIndex((m) => m.minutes === progress.next!.minutes)
    : -1;

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase text-text-muted">Body recovery</span>
        {progress.next ? (
          <span className="text-caption text-text-muted">
            Next in {formatMinutesUntil(progress.minutesToNext)}
          </span>
        ) : (
          <span className="text-caption text-success">All milestones reached</span>
        )}
      </div>

      <div className="flex items-center gap-md">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden
          className="shrink-0"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>

        <div className="flex flex-col min-w-0">
          <h3 className="text-h3 font-semibold text-text">
            {progress.current ? progress.current.title : 'Just starting'}
          </h3>
          <p className="text-small text-text-muted">
            {progress.current
              ? progress.current.body
              : 'Each minute smoke-free reduces strain on your heart and lungs.'}
          </p>
          {progress.current ? (
            <span className="text-caption uppercase text-text-faint mt-xs">
              Source:{' '}
              {progress.current.sourceUrl ? (
                <a
                  href={progress.current.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-text"
                >
                  {progress.current.source}
                </a>
              ) : (
                progress.current.source
              )}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {HEALTH_MILESTONES.map((m, idx) => {
          const reached = currentIdx >= 0 && idx <= currentIdx;
          const isNext = idx === nextIdx;
          return (
            <span
              key={m.minutes}
              className={cn(
                'rounded-pill border px-md py-xs text-caption font-medium',
                reached && 'bg-accent-soft text-accent border-accent/30',
                !reached && isNext && 'border-accent text-text',
                !reached && !isNext && 'border-border text-text-muted opacity-60',
              )}
            >
              {m.title}
            </span>
          );
        })}
      </div>

      <p className="text-caption text-text-muted italic">
        General health information from public-health institutions. Not medical
        advice — consult a clinician for personal guidance.
      </p>
    </Card>
  );
}

export default HealthMilestones;
