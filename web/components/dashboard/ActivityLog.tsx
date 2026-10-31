'use client';

/*
 * ActivityLog — the last few logged entries as a compact, tokenized list.
 * Only real logged-cigarette events; no fabricated "craving"/"insight"/
 * "security" event types (insights already have their own home in the
 * Editor's-note blockquote, and there's no real security check to log).
 */

import * as React from 'react';
import { Cigarette } from 'lucide-react';

export interface ActivityEvent {
  message: string;
  subtitle?: string;
  /** Absolute IST date of the entry (not a relative "time ago"). */
  when: string;
}

export interface ActivityLogProps {
  events: ActivityEvent[];
}

export function ActivityLog({ events }: ActivityLogProps) {
  return (
    <div className="flex flex-col gap-sm">
      {events.map((ev, i) => (
        <div key={i} className="elevated flex items-start gap-sm rounded-md p-sm">
          <div
            className="mt-xs flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
          >
            <Cigarette className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-sm">
              <p className="text-small font-medium text-text">{ev.message}</p>
              <span className="shrink-0 text-caption text-text-faint">{ev.when}</span>
            </div>
            {ev.subtitle ? <p className="mt-xs text-caption text-text-muted">{ev.subtitle}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityLog;
