jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

import { mapDbError } from '@/db/repositories/_supabase';
import { AppError } from '@/lib/errors';

describe('mapDbError', () => {
  it('maps permission denied to authorization_error', () => {
    const err = mapDbError({ code: '42501', message: 'permission denied' });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('authorization_error');
  });

  it('maps unique violation to conflict', () => {
    const err = mapDbError({ code: '23505', message: 'duplicate' });
    expect((err as AppError).code).toBe('conflict');
  });
});
