import { describe, it, expect } from 'vitest';
import { parseEdgeFunctionError } from '@/lib/edgeFunctionError';

describe('parseEdgeFunctionError', () => {
  it('maps reauth_required to authentication_error', () => {
    // Arrange
    const body = { error: 'reauth_required', window_min: 15 };

    // Act
    const result = parseEdgeFunctionError(body);

    // Assert
    expect(result).toEqual({ code: 'authentication_error', serverCode: 'reauth_required' });
  });

  it('maps rate_limited to rate_limited', () => {
    const result = parseEdgeFunctionError({ error: 'rate_limited' });
    expect(result).toEqual({ code: 'rate_limited', serverCode: 'rate_limited' });
  });

  it('maps origin_not_allowed to dependency_failure', () => {
    const result = parseEdgeFunctionError({ error: 'origin_not_allowed' });
    expect(result).toEqual({ code: 'dependency_failure', serverCode: 'origin_not_allowed' });
  });

  it('maps server_misconfigured to dependency_failure', () => {
    const result = parseEdgeFunctionError({ error: 'server_misconfigured' });
    expect(result).toEqual({ code: 'dependency_failure', serverCode: 'server_misconfigured' });
  });

  it('maps null body to dependency_failure with null serverCode', () => {
    const result = parseEdgeFunctionError(null);
    expect(result).toEqual({ code: 'dependency_failure', serverCode: null });
  });

  it('maps unknown error code to dependency_failure', () => {
    const result = parseEdgeFunctionError({ error: 'some_unknown_code' });
    expect(result).toEqual({ code: 'dependency_failure', serverCode: 'some_unknown_code' });
  });

  it('returns null serverCode when body has no error field', () => {
    const result = parseEdgeFunctionError({ window_min: 15 });
    expect(result).toEqual({ code: 'dependency_failure', serverCode: null });
  });

  it('returns null serverCode when error field is not a string', () => {
    const result = parseEdgeFunctionError({ error: 42 } as unknown as { error?: string });
    expect(result).toEqual({ code: 'dependency_failure', serverCode: null });
  });
});
