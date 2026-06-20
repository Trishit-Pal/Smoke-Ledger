import { ProfilePatchSchema } from '@/lib/validation';

const ok = (patch: Record<string, unknown>) => ProfilePatchSchema.safeParse(patch).success;

describe('ProfilePatchSchema — identity + optional fields', () => {
  it('accepts a valid name, dob, and gender', () => {
    expect(ok({ fullName: 'Asha Rao' })).toBe(true);
    expect(ok({ dateOfBirth: '2000-01-01' })).toBe(true);
    expect(ok({ gender: 'male' })).toBe(true);
    expect(ok({ gender: 'undisclosed' })).toBe(true);
  });

  it('rejects an empty name and an over-long name', () => {
    expect(ok({ fullName: '   ' })).toBe(false);
    expect(ok({ fullName: 'x'.repeat(81) })).toBe(false);
  });

  it('rejects a malformed or impossible date of birth', () => {
    expect(ok({ dateOfBirth: '2000-1-1' })).toBe(false);
    expect(ok({ dateOfBirth: '01/01/2000' })).toBe(false);
    expect(ok({ dateOfBirth: '2000-02-30' })).toBe(false); // calendar-invalid
  });

  it('rejects an unknown gender value', () => {
    expect(ok({ gender: 'x' })).toBe(false);
  });

  it('accepts a valid Indian mobile and null, rejects junk', () => {
    expect(ok({ mobileE164: '+919876543210' })).toBe(true);
    expect(ok({ mobileE164: null })).toBe(true);
    expect(ok({ mobileE164: '98765' })).toBe(false);
    expect(ok({ mobileE164: '+0123456789' })).toBe(false);
  });

  it('rejects non-Indian and malformed mobile numbers (India-only)', () => {
    expect(ok({ mobileE164: '+14155552671' })).toBe(false); // US country code
    expect(ok({ mobileE164: '+447911123456' })).toBe(false); // UK country code
    expect(ok({ mobileE164: '+915876543210' })).toBe(false); // lead digit < 6
    expect(ok({ mobileE164: '+9198765432' })).toBe(false); // too short
    expect(ok({ mobileE164: '9876543210' })).toBe(false); // missing +91
  });

  it('accepts a place up to 80 chars and rejects longer', () => {
    expect(ok({ place: 'Mumbai' })).toBe(true);
    expect(ok({ place: null })).toBe(true);
    expect(ok({ place: 'x'.repeat(81) })).toBe(false);
  });

  it('still rejects unknown keys (strict)', () => {
    expect(ok({ notARealField: 1 })).toBe(false);
  });
});
