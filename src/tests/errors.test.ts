import { AppError, classifyError, describeError } from '@/lib/errors';

describe('classifyError', () => {
  it('maps authored "Enter a valid…" phrasing to validation_error', () => {
    expect(
      classifyError(new Error('Enter a valid Indian mobile: +91 followed by 10 digits starting 6-9')),
    ).toBe('validation_error');
    expect(classifyError(new Error('Enter a 10-digit Indian mobile starting 6-9.'))).toBe(
      'validation_error',
    );
  });

  it('classifies network failures as dependency_failure', () => {
    expect(classifyError(new Error('Failed to fetch'))).toBe('dependency_failure');
  });

  it('passes an AppError code straight through', () => {
    expect(classifyError(new AppError('authentication_error'))).toBe('authentication_error');
  });
});

describe('describeError', () => {
  it('shows an authored, display-safe validation message verbatim', () => {
    const msg = 'Enter a 10-digit Indian mobile starting 6-9.';
    expect(describeError(new AppError('validation_error', msg))).toBe(msg);
  });

  it('never leaks raw Postgres detail for a DB-derived validation error', () => {
    const raw = 'new row for relation "user_profiles" violates check constraint "x"';
    const out = describeError(new AppError('validation_error', raw));
    expect(out).not.toContain('constraint');
    expect(out).not.toContain('relation');
  });

  it('gives specific, actionable copy per error code', () => {
    expect(describeError(new AppError('authentication_error'))).toMatch(/sign in/i);
    expect(describeError(new AppError('dependency_failure'))).toMatch(/connection|reach/i);
    expect(describeError(new AppError('timeout'))).toMatch(/connection|timed out/i);
  });

  it('classifies and describes a plain network Error as a connection problem', () => {
    expect(describeError(new Error('Failed to fetch'))).toMatch(/connection|reach/i);
  });

  it('falls back to a safe generic message for unknown input', () => {
    expect(describeError('weird')).toMatch(/something went wrong/i);
    expect(describeError(null)).toMatch(/something went wrong/i);
  });
});
