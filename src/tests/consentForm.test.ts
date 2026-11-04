import { AGREEMENT_LABEL_PARTS, AGREEMENT_SUB } from '../lib/healthConsent';
import { canContinueConsent } from '../lib/consentForm';

const base = { agreed: true, needsHealth: true, health: true, chatShown: true, chatAnswer: true };

describe('agreement copy', () => {
  it('joins to the verbatim label', () => {
    const p = AGREEMENT_LABEL_PARTS;
    expect(p.before + p.terms + p.middle + p.privacy + p.after).toBe(
      'I am 18 or older, I agree to the Terms of Service and the Privacy Policy, and I understand this app does not provide medical advice.',
    );
    expect(p.terms).toBe('Terms of Service');
    expect(p.privacy).toBe('Privacy Policy');
  });

  it('has the verbatim sub-line', () => {
    expect(AGREEMENT_SUB).toBe(
      'We process your data to run your account, sync it and keep it secure.',
    );
  });
});

describe('canContinueConsent', () => {
  it('continues when every shown tick is ticked and the chat is answered', () => {
    expect(canContinueConsent(base)).toBe(true);
  });

  it('is false until the agreement is ticked', () => {
    expect(canContinueConsent({ ...base, agreed: false })).toBe(false);
  });

  it('is false while a needed health tick is missing', () => {
    expect(canContinueConsent({ ...base, health: false })).toBe(false);
  });

  it('ignores the health tick when it is not needed', () => {
    expect(canContinueConsent({ ...base, needsHealth: false, health: false })).toBe(true);
  });

  it('is false while a shown chat pair is unanswered', () => {
    expect(canContinueConsent({ ...base, chatAnswer: null })).toBe(false);
  });

  it('still continues on a No answer', () => {
    expect(canContinueConsent({ ...base, chatAnswer: false })).toBe(true);
  });

  it('ignores the chat answer when the pair is not shown', () => {
    expect(canContinueConsent({ ...base, chatShown: false, chatAnswer: null })).toBe(true);
  });

  it('flips back to false when a tick is undone', () => {
    expect(canContinueConsent(base)).toBe(true);
    expect(canContinueConsent({ ...base, agreed: false })).toBe(false);
  });
});
