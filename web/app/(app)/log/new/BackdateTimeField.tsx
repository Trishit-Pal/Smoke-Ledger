/*
 * BackdateTimeField — let the user stamp a log with a custom date+time
 * up to 24 hours back, never in the future.
 *
 * Why a dedicated component:
 *  - The form already has 9+ fields; a full-width datetime-local input would
 *    feel heavy. The ChoiceRun pattern (small-caps, middot-separated) fits
 *    the editorial surface.
 *  - The 24h cap is enforced both in the UI (max/min on the native picker)
 *    and in Zod (defense in depth) — see src/lib/validation.ts.
 *  - The resolution preview ("14:30 today") keeps the field legible without
 *    forcing the user to read a raw `2026-06-24T14:30` string.
 *
 * Default = "Now". Presets: 30 min, 1 hr, 2 hr ago. Custom… opens a native
 * `datetime-local` picker whose min/max mirror the cap.
 *
 * Timezone: the native datetime-local picker is timezone-naive — it shows a
 * bare wall clock with no zone. We interpret that wall clock in the ledger's
 * zone (the reader's country: IST in India, e.g. Europe/Paris in France) by
 * formatting into and parsing out of the picker through `formatDatetimeLocal` /
 * `parseDatetimeLocal` in `src/lib/date.ts`. This keeps the resolved tsUtc —
 * and the `toLocalDate` / `toLocalHour` derived from it on save — correct
 * whatever the device timezone is.
 */

'use client';

import * as React from 'react';
import {
  IST,
  formatTime,
  formatDatetimeLocal,
  parseDatetimeLocal,
  toLocalDate,
  zoneLabel,
} from '@/lib/date';
import { MAX_BACKDATE_MS } from '@/lib/validation';
import { ChoiceRun } from '@web/components/visual';

export type BackdatePreset = 'now' | '30m' | '1h' | '2h' | 'custom';

export interface BackdateTimeFieldProps {
  /** Currently-resolved timestamp. `null` means "now" (no backdate). */
  value: Date | null;
  /** Called with the new resolved timestamp. Pass `null` to clear. */
  onChange: (next: Date | null) => void;
  /** Optional error message (e.g. from server-side validation). */
  error?: string | null;
  /** Locale for the date label inside the picker; defaults to en-IN. */
  locale?: string;
  /** The ledger's IANA zone (timezoneForCountry); defaults to IST. */
  zone?: string;
}

const PRESETS: { value: BackdatePreset; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: '30m', label: '30 min ago' },
  { value: '1h', label: '1 hr ago' },
  { value: '2h', label: '2 hr ago' },
  { value: 'custom', label: 'Custom…' },
];

/** Earliest allowed timestamp for a backdated log. Shares the single cap
 *  constant with the Zod schema so the picker bounds and the validation
 *  refinement can never drift apart. */
export function maxBackdateMs(now: Date = new Date()): number {
  return now.getTime() - MAX_BACKDATE_MS;
}

function presetToDate(preset: BackdatePreset, now: Date): Date | null {
  switch (preset) {
    case 'now':
      return null;
    case '30m':
      return new Date(now.getTime() - 30 * 60 * 1000);
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '2h':
      return new Date(now.getTime() - 2 * 60 * 60 * 1000);
    case 'custom':
      return null; // custom handled via the picker
  }
}

/** Humane relative label for a value inside the 24h backdate window:
 *  "just now" · "25 min ago" · "1 hr ago" · "1 hr 25 min ago" · "23 hr ago". */
function formatAgo(minutes: number): string {
  if (minutes <= 0) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hrs} hr ago` : `${hrs} hr ${mins} min ago`;
}

function resolvePreview(d: Date | null, now: Date, zone: string): string {
  if (!d) {
    return `Now · ${formatTime(now.toISOString(), zone)} ${zoneLabel(zone)}`;
  }
  const minutesAgo = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  // The 24h cap guarantees the pick is either today or yesterday in the ledger's
  // zone, so those two labels are exhaustive — no general date formatting needed.
  const sameDay = toLocalDate(d.toISOString(), zone) === toLocalDate(now.toISOString(), zone);
  const dateLabel = sameDay ? 'today' : 'yesterday';
  const timeLabel = formatTime(d.toISOString(), zone);
  return `Logging as ${timeLabel} ${dateLabel} · ${formatAgo(minutesAgo)}`;
}

export function BackdateTimeField({
  value,
  onChange,
  error,
  locale = 'en-IN',
  zone = IST,
}: BackdateTimeFieldProps) {
  // Track the preset the user is currently on so the picker can show/hide
  // when "Custom…" is selected. We intentionally don't lock `value` to the
  // preset: the parent owns the timestamp and may pass back whatever a
  // subsequent re-render produces.
  const initialPreset: BackdatePreset = value == null ? 'now' : 'custom';
  const [preset, setPreset] = React.useState<BackdatePreset>(initialPreset);
  const [customDraft, setCustomDraft] = React.useState<string>(
    formatDatetimeLocal(value ?? new Date(), zone),
  );
  // `now` is intentionally frozen at mount so the picker bounds and preview
  // render stably. Presets ("2 hr ago") are relative to this frozen `now`; on a
  // form left open for hours that drifts slightly, but the parent's handleSave
  // re-checks against a fresh clock, so an out-of-window value is still caught.
  const now = React.useMemo(() => new Date(), []);

  const minLocal = formatDatetimeLocal(new Date(maxBackdateMs(now)), zone);
  const maxLocal = formatDatetimeLocal(now, zone);

  const handleSelect = (next: BackdatePreset) => {
    setPreset(next);
    if (next === 'custom') {
      // Seed the picker draft from the existing value, or "now − 30 min", and
      // resolve it now so value/draft/preview agree before the first edit.
      const seed = value ?? new Date(now.getTime() - 30 * 60 * 1000);
      setCustomDraft(formatDatetimeLocal(seed, zone));
      onChange(seed);
      return;
    }
    const resolved = presetToDate(next, now);
    onChange(resolved);
  };

  const handleCustomChange = (raw: string) => {
    setCustomDraft(raw);
    const parsed = parseDatetimeLocal(raw, zone);
    if (!parsed) return;
    // Clamp to the [maxBackdateMs, now] range.
    const minMs = maxBackdateMs(now);
    const clamped = new Date(
      Math.max(minMs, Math.min(now.getTime(), parsed.getTime())),
    );
    // If the typed value fell outside the window, snap the visible input to the
    // clamped instant so the picker and the resolution preview never disagree.
    if (clamped.getTime() !== parsed.getTime()) {
      setCustomDraft(formatDatetimeLocal(clamped, zone));
    }
    onChange(clamped);
  };

  const preview = resolvePreview(value, now, zone);
  const isError = Boolean(error);

  return (
    <div className="flex flex-col gap-sm">
      <ChoiceRun
        options={PRESETS}
        value={preset}
        onSelect={(next) => { if (next) handleSelect(next); }}
        allowClear={false}
        ariaLabel="When did you smoke this?"
      />

      {preset === 'custom' ? (
        <div className="flex flex-col gap-xs field-reveal">
          <input
            type="datetime-local"
            value={customDraft}
            min={minLocal}
            max={maxLocal}
            step={60}
            onChange={(e) => handleCustomChange(e.target.value)}
            aria-label="Custom date and time"
            lang={locale}
            className="w-full md:w-auto bg-transparent border-0 border-b border-[var(--rule)] focus:border-[var(--text)] py-sm text-body text-text outline-none transition-colors nums-tabular"
          />
          <span className="text-caption text-text-muted nums-tabular">
            Up to 24 hours back, never in the future. Times in {zoneLabel(zone)}.
          </span>
        </div>
      ) : null}

      <p
        className={'text-caption nums-tabular ' + (isError ? '' : 'text-text-muted')}
        style={isError ? { color: 'var(--warn-earth-ink)' } : undefined}
        role={isError ? 'alert' : 'status'}
        aria-live="polite"
      >
        {error ?? preview}
      </p>
    </div>
  );
}
