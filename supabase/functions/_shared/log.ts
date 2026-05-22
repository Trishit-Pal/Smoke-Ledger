// Shared structured logger for Edge Functions.
//
// LOW-tier audit: before this module existed each function emitted log lines
// with ad-hoc shapes (some structured JSON, some "label: payload" tuples,
// some bare strings). That made grep-based triage and ops dashboards
// brittle. This module gives every function the same shape:
//
//   { level, function, event, ...callerFields }
//
// where `function` identifies the emitter (e.g. "delete-account"), `event` is
// a lowercase-underscore identifier the operator can pivot on
// (e.g. "audit_insert_failed"), and `callerFields` carries the request_id and
// any other diagnostic context.
//
// Output sink: stdout for info / warn, stderr for error (via the underlying
// console.log/warn/error). No external transport — there is no Sentry / Slack
// integration, intentionally. Supabase Edge Function logs are surfaced via the
// dashboard and any future log-shipping integration can grep on these fields.

type LogFields = Record<string, unknown>;

export interface FunctionLogger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

/**
 * Creates a logger bound to `functionName` (typically the directory name of
 * the calling Edge Function, e.g. `'delete-account'`). Callers should
 * instantiate one logger at module scope and reuse it for every log call so
 * the `function` field is consistent.
 */
export function createLogger(functionName: string): FunctionLogger {
  function emit(
    level: 'info' | 'warn' | 'error',
    event: string,
    fields: LogFields = {},
  ): void {
    const payload = JSON.stringify({
      level,
      function: functionName,
      event,
      ...fields,
    });
    if (level === 'error') {
      console.error(payload);
    } else if (level === 'warn') {
      console.warn(payload);
    } else {
      console.log(payload);
    }
  }
  return {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}
