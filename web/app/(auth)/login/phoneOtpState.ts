// Plain (non-'use server') module for the phone-OTP form's action state.
//
// A 'use server' file may only export async functions, so the state type and its
// initial value live here instead of in ./_actions/phoneOtp.ts (Next 15 throws on
// the first cold request otherwise). Same pattern as ./loginActionState.ts.

export type PhoneOtpActionState = {
  code:
    | 'idle'
    | 'sent'
    | 'invalid'
    | 'rate_limited'
    | 'disabled'
    | 'unavailable'
    | 'error';
  message: string | null;
};

export const initialPhoneOtpActionState: PhoneOtpActionState = {
  code: 'idle',
  message: null,
};
