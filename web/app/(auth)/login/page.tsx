'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialFieldRow } from '@web/components/editorial/EditorialFieldRow';
import { EditorialModeSwitch } from '@web/components/editorial/EditorialModeSwitch';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { LEGAL_LINKS } from '@web/lib/legal';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';
import { setRememberMePreference } from '@web/lib/auth/rememberMe';
import { sanitizeNextPath } from '@web/lib/auth/redirect';
import { signInWithPasswordAction } from './actions';
import { initialLoginActionState, type LoginActionState } from './loginActionState';
// CHARACTER (1): mood dispatcher — no new deps, uses the window event bus.
import { dispatchMood } from '@web/lib/character/mood';

const emailSchema = z.string().email('Enter a valid email');
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use E.164 format, e.g. +919876543210');

type AuthMode = 'password' | 'email_otp' | 'phone_otp';

const MODE_OPTIONS: { value: AuthMode; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'email_otp', label: 'Email link' },
  { value: 'phone_otp', label: 'Phone OTP' },
];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 0 4px 0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--rule)',
  outline: 'none',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  transition: 'border-color 160ms ease',
};

const PRIMARY_CTA_STYLE: React.CSSProperties = {
  height: 52,
  padding: '0 24px',
  border: 'none',
  borderRadius: 10,
  background: 'var(--accent)',
  color: '#ffffff',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  boxShadow: '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
  transition: 'transform 120ms ease, box-shadow 200ms ease, opacity 140ms ease',
};

const SECONDARY_CTA_STYLE: React.CSSProperties = {
  height: 44,
  padding: '0 18px',
  border: '1px solid var(--rule)',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
};

function PasswordSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isInactive = pending || disabled;
  return (
    <button
      type="submit"
      disabled={isInactive}
      className="focus-ring"
      style={{
        ...PRIMARY_CTA_STYLE,
        marginTop: 16,
        opacity: isInactive ? 0.45 : 1,
        cursor: isInactive ? 'not-allowed' : 'pointer',
      }}
    >
      {pending ? 'Signing in…' : 'Sign in →'}
    </button>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: 320 }} />}>
      <LoginPageInner />
    </React.Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = React.useMemo(
    () => sanitizeNextPath(searchParams.get('next')),
    [searchParams],
  );
  const callbackError = searchParams.get('error');
  const [mode, setMode] = React.useState<AuthMode>('password');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [otpInfo, setOtpInfo] = React.useState<string | null>(null);
  const [otpEmail, setOtpEmail] = React.useState('');
  const [otpPhone, setOtpPhone] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [resendInfo, setResendInfo] = React.useState<string | null>(null);
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;

  const [passwordActionState, passwordFormAction] = useFormState<LoginActionState, FormData>(
    signInWithPasswordAction,
    initialLoginActionState,
  );
  const passwordEmailRef = React.useRef<HTMLInputElement>(null);

  // Persist remember-me preference client-side whenever it changes, so it
  // survives the full-page navigation triggered by the server action redirect.
  React.useEffect(() => {
    setRememberMePreference(rememberMe);
  }, [rememberMe]);

  React.useEffect(() => {
    if (callbackError === 'invalid_or_expired_link') {
      setSubmitError('This verification link is invalid or expired. Request a new one.');
    } else if (callbackError === 'session_missing') {
      setSubmitError('Your session has expired. Please sign in again.');
    } else if (callbackError === 'email_not_confirmed') {
      setSubmitError('Please confirm your email before signing in.');
    }
  }, [callbackError]);

  // CHARACTER (2): greet on first render — the figure waves as the form loads.
  React.useEffect(() => {
    const t = window.setTimeout(
      () => dispatchMood('greet', { durationMs: 2000 }),
      500,
    );
    return () => window.clearTimeout(t);
  }, []);

  const passwordError = passwordActionState.message ?? submitError;
  const showEmailNotConfirmedActions =
    callbackError === 'email_not_confirmed' ||
    passwordActionState.code === 'email_not_confirmed';

  // CHARACTER (3): regret on any sign-in error — figure droops, cigarette wisp.
  React.useEffect(() => {
    if (passwordError) {
      dispatchMood('regret', {
        caption: 'Noted. No judgment.',
        durationMs: 3200,
      });
    }
  }, [passwordError]);

  // CHARACTER (4): thumb on OTP sent — a quiet acknowledgement.
  React.useEffect(() => {
    if (otpInfo) {
      dispatchMood('thumb', {
        caption: 'Link on its way.',
        durationMs: 3000,
      });
    }
  }, [otpInfo]);

  const callbackRedirectTo = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

  const onResendConfirmation = async () => {
    const email = passwordEmailRef.current?.value?.trim();
    if (!email) {
      setSubmitError('Enter your email above, then tap resend.');
      return;
    }
    setResendLoading(true);
    setResendInfo(null);
    try {
      const { error } = await getSupabase().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callbackRedirectTo },
      });
      if (error) {
        setSubmitError(toAuthErrorMessage(error));
        return;
      }
      setSubmitError(null);
      setResendInfo('If your account is pending confirmation, we sent another email.');
    } finally {
      setResendLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    setOtpError(null);
    setOtpInfo(null);
    const parsed = emailSchema.safeParse(otpEmail.trim());
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? 'Enter a valid email.');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setOtpError('Please complete the security check.');
      return;
    }
    setOtpLoading(true);
    try {
      setRememberMePreference(rememberMe);
      const { error } = await getSupabase().auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: callbackRedirectTo,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) {
        setOtpInfo('If this email is registered, we sent a sign-in link.');
        setCaptchaToken(null);
        return;
      }
      setOtpInfo('If this email is registered, we sent a sign-in link.');
    } finally {
      setOtpLoading(false);
    }
  };

  const sendPhoneOtp = async () => {
    setOtpError(null);
    setOtpInfo(null);
    const parsed = phoneSchema.safeParse(otpPhone.trim());
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number.');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setOtpError('Please complete the security check.');
      return;
    }
    setOtpLoading(true);
    try {
      setRememberMePreference(rememberMe);
      const { error } = await getSupabase().auth.signInWithOtp({
        phone: parsed.data,
        options: {
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) {
        setOtpInfo('If this number is registered, an OTP was sent.');
        setCaptchaToken(null);
        return;
      }
      setOtpSent(true);
      setOtpInfo('If this number is registered, an OTP was sent. Enter the code to continue.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setOtpError(null);
    const parsed = phoneSchema.safeParse(otpPhone.trim());
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number.');
      return;
    }
    if (!otpCode.trim()) {
      setOtpError('Enter the OTP code.');
      return;
    }
    setOtpLoading(true);
    try {
      const { error } = await getSupabase().auth.verifyOtp({
        phone: parsed.data,
        token: otpCode.trim(),
        type: 'sms',
      });
      if (error) {
        setOtpError(toAuthErrorMessage(error));
        return;
      }
      router.replace(nextPath);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <>
      <EditorialMasthead
        caption="Account · Sign in"
        title={
          <>
            Welcome <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>back</span>.
          </>
        }
        subtitle="Your ledger, where you left it."
      />

      <EditorialModeSwitch
        options={MODE_OPTIONS}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setOtpError(null);
          setOtpInfo(null);
          setOtpSent(false);
        }}
        ariaLabel="Sign-in method"
      />

      {mode === 'password' ? (
        <form
          action={passwordFormAction}
          className="flex flex-col"
          style={{ gap: 0 }}
          noValidate
        >
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="rememberMe" value={rememberMe ? '1' : ''} />
          {captchaToken ? (
            <input type="hidden" name="captchaToken" value={captchaToken} />
          ) : null}

          <EditorialFieldRow label="Email" strong>
            <input
              ref={passwordEmailRef}
              type="email"
              name="email"
              required
              maxLength={320}
              autoComplete="email"
              placeholder="you@example.com"
              style={INPUT_STYLE}
              className="focus-ring"
            />
          </EditorialFieldRow>
          <EditorialFieldRow label="Password">
            <input
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="current-password"
              placeholder="••••••••"
              style={INPUT_STYLE}
              className="focus-ring"
            />
          </EditorialFieldRow>

          {captchaRequired ? (
            <EditorialFieldRow label="Security check" optional>
              <TurnstileWidget onToken={setCaptchaToken} />
            </EditorialFieldRow>
          ) : null}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 0',
              borderTop: '1px solid var(--rule)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}
          >
            <input
              type="checkbox"
              className="ed-checkbox focus-ring"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Keep me signed in on this device</span>
          </label>

          {passwordError ? <InlineError message={passwordError} /> : null}
          {resendInfo ? <InlineInfo message={resendInfo} /> : null}

          {showEmailNotConfirmedActions ? (
            <button
              type="button"
              onClick={onResendConfirmation}
              disabled={resendLoading}
              className="focus-ring"
              style={{ ...SECONDARY_CTA_STYLE, marginTop: 16 }}
            >
              {resendLoading ? 'Sending…' : 'Resend confirmation email'}
            </button>
          ) : null}

          <PasswordSubmitButton disabled={!captchaReady} />
        </form>
      ) : null}

      {mode === 'email_otp' ? (
        <div className="flex flex-col" style={{ gap: 0 }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
            }}
          >
            We email a one-click sign-in link (not a numeric code). Use an account that already
            exists, or create one on the signup page.
          </p>
          <EditorialFieldRow label="Email" strong>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={otpEmail}
              onChange={(event) => setOtpEmail(event.target.value)}
              style={INPUT_STYLE}
              className="focus-ring"
            />
          </EditorialFieldRow>
          {captchaRequired ? (
            <EditorialFieldRow label="Security check" optional>
              <TurnstileWidget onToken={setCaptchaToken} />
            </EditorialFieldRow>
          ) : null}
          <button
            type="button"
            onClick={sendEmailOtp}
            disabled={otpLoading || !captchaReady}
            className="focus-ring"
            style={{
              ...PRIMARY_CTA_STYLE,
              marginTop: 16,
              opacity: otpLoading || !captchaReady ? 0.45 : 1,
              cursor: otpLoading || !captchaReady ? 'not-allowed' : 'pointer',
            }}
          >
            {otpLoading ? 'Sending…' : 'Send sign-in link →'}
          </button>
        </div>
      ) : null}

      {mode === 'phone_otp' ? (
        <div className="flex flex-col" style={{ gap: 0 }}>
          <EditorialFieldRow label="Phone number" strong>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+919876543210"
              value={otpPhone}
              onChange={(event) => setOtpPhone(event.target.value)}
              style={INPUT_STYLE}
              className="focus-ring"
            />
          </EditorialFieldRow>
          {!otpSent ? (
            <>
              {captchaRequired ? (
                <EditorialFieldRow label="Security check" optional>
                  <TurnstileWidget onToken={setCaptchaToken} />
                </EditorialFieldRow>
              ) : null}
              <button
                type="button"
                onClick={sendPhoneOtp}
                disabled={otpLoading || !captchaReady}
                className="focus-ring"
                style={{
                  ...PRIMARY_CTA_STYLE,
                  marginTop: 16,
                  opacity: otpLoading || !captchaReady ? 0.45 : 1,
                  cursor: otpLoading || !captchaReady ? 'not-allowed' : 'pointer',
                }}
              >
                {otpLoading ? 'Sending…' : 'Send OTP code →'}
              </button>
            </>
          ) : (
            <>
              <EditorialFieldRow label="OTP code">
                <input
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Enter code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  style={INPUT_STYLE}
                  className="focus-ring"
                />
              </EditorialFieldRow>
              <button
                type="button"
                onClick={verifyPhoneOtp}
                disabled={otpLoading}
                className="focus-ring"
                style={{
                  ...PRIMARY_CTA_STYLE,
                  marginTop: 16,
                  opacity: otpLoading ? 0.45 : 1,
                  cursor: otpLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {otpLoading ? 'Verifying…' : 'Verify OTP →'}
              </button>
            </>
          )}
        </div>
      ) : null}

      {mode !== 'password' ? (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--rule)',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          <input
            type="checkbox"
            className="ed-checkbox focus-ring"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Keep me signed in on this device</span>
        </label>
      ) : null}

      {otpInfo ? <InlineInfo message={otpInfo} /> : null}
      {otpError ? <InlineError message={otpError} /> : null}

      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'baseline',
          flexWrap: 'wrap',
          paddingTop: 8,
        }}
      >
        <Link
          href="/signup"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Create an account →
        </Link>
        <Link
          href="/reset"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          Forgot password?
        </Link>
      </div>

      <EditorialClosingSignet align="left">
        By signing in you accept our{' '}
        <Link href={LEGAL_LINKS.terms} style={{ color: 'var(--accent)' }}>
          Terms
        </Link>{' '}
        and{' '}
        <Link href={LEGAL_LINKS.privacy} style={{ color: 'var(--accent)' }}>
          Privacy Policy
        </Link>
        . Quiet entry, quiet exit.
      </EditorialClosingSignet>
    </>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      style={{
        fontSize: 13,
        color: 'var(--warn-earth)',
        margin: '12px 0 0 0',
        lineHeight: 1.5,
      }}
    >
      {message}
    </p>
  );
}

function InlineInfo({ message }: { message: string }) {
  return (
    <p
      role="status"
      style={{
        fontSize: 13,
        color: 'var(--accent)',
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        margin: '12px 0 0 0',
        lineHeight: 1.5,
      }}
    >
      {message}
    </p>
  );
}
