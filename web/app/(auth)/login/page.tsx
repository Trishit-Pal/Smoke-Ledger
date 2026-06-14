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
import { precheckResendAction } from '../_actions/authPrechecks';
import { withTimeout, DEFAULT_AUTH_TIMEOUT_MS } from '@web/lib/auth/withTimeout';
import { initialLoginActionState, type LoginActionState } from './loginActionState';
import {
  sendPhoneOtpAction,
  verifyPhoneOtpAction,
  initialPhoneOtpActionState,
  type PhoneOtpActionState,
} from './_actions/phoneOtp';
import { PasswordField } from '@web/components/auth/PasswordField';
import {
  INPUT_STYLE,
  PRIMARY_CTA_STYLE,
  SECONDARY_CTA_STYLE,
} from '@web/lib/auth/inputStyle';
import { emailZodStrict } from '@web/lib/auth/email';
import {
  DEFAULT_COUNTRY,
  SUPPORTED_COUNTRIES,
  getCountryByCode,
  isPhoneOtpEnabled,
} from '@web/lib/auth/phone';
// CHARACTER (1): mood dispatcher — no new deps, uses the window event bus.
import { dispatchMood } from '@web/lib/character/mood';

const emailSchema = emailZodStrict;

const SERVICE_UNAVAILABLE_MESSAGE =
  'Service is temporarily unavailable. Please try again in a moment.';

type AuthMode = 'password' | 'email_otp' | 'phone_otp';

const ALL_MODE_OPTIONS: { value: AuthMode; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'email_otp', label: 'Email link' },
  { value: 'phone_otp', label: 'Phone OTP' },
];

const MODE_OPTIONS: { value: AuthMode; label: string }[] = isPhoneOtpEnabled()
  ? ALL_MODE_OPTIONS
  : ALL_MODE_OPTIONS.filter((m) => m.value !== 'phone_otp');

const COUNTRY_SELECT_STYLE: React.CSSProperties = {
  height: 40,
  padding: '0 8px 4px 0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--rule)',
  outline: 'none',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  flexShrink: 0,
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

function PhoneSendButton({ disabled, label }: { disabled: boolean; label: string }) {
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
      {pending ? 'Sending…' : label}
    </button>
  );
}

function PhoneVerifyButton({ disabled }: { disabled: boolean }) {
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
      {pending ? 'Verifying…' : 'Verify OTP →'}
    </button>
  );
}

function PhoneResendButton({
  cooldownSec,
}: {
  cooldownSec: number;
}) {
  const { pending } = useFormStatus();
  const isInactive = pending || cooldownSec > 0;
  const label =
    pending
      ? 'Resending…'
      : cooldownSec > 0
        ? `Resend code in ${cooldownSec}s`
        : 'Resend code';
  return (
    <button
      type="submit"
      disabled={isInactive}
      className="focus-ring"
      style={{
        background: 'transparent',
        border: 'none',
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--accent)',
        textDecoration: 'underline',
        textUnderlineOffset: 4,
        padding: 0,
        cursor: isInactive ? 'not-allowed' : 'pointer',
        opacity: isInactive ? 0.5 : 1,
      }}
    >
      {label}
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
  const reason = searchParams.get('reason');
  const [mode, setMode] = React.useState<AuthMode>('password');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [otpInfo, setOtpInfo] = React.useState<string | null>(null);
  const [otpEmail, setOtpEmail] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [resendInfo, setResendInfo] = React.useState<string | null>(null);
  const [countryCode, setCountryCode] = React.useState<string>(DEFAULT_COUNTRY.code);
  const [localPhone, setLocalPhone] = React.useState('');
  const [cooldownSec, setCooldownSec] = React.useState(0);
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;
  const selectedCountry = React.useMemo(
    () => getCountryByCode(countryCode) ?? DEFAULT_COUNTRY,
    [countryCode],
  );

  const [passwordActionState, passwordFormAction] = useFormState<LoginActionState, FormData>(
    signInWithPasswordAction,
    initialLoginActionState,
  );
  const [sendPhoneOtpState, sendPhoneOtpFormAction] = useFormState<PhoneOtpActionState, FormData>(
    sendPhoneOtpAction,
    initialPhoneOtpActionState,
  );
  const [verifyPhoneOtpState, verifyPhoneOtpFormAction] = useFormState<PhoneOtpActionState, FormData>(
    verifyPhoneOtpAction,
    initialPhoneOtpActionState,
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

  // Phone OTP send → flip into verify step + start resend cooldown.
  React.useEffect(() => {
    if (!sendPhoneOtpState.message) return;
    if (sendPhoneOtpState.code === 'sent') {
      setOtpInfo(sendPhoneOtpState.message);
      setOtpError(null);
      setOtpSent(true);
      setCooldownSec(30);
    } else {
      setOtpError(sendPhoneOtpState.message);
      setOtpInfo(null);
    }
  }, [sendPhoneOtpState]);

  // Phone OTP verify → surface invalid/rate-limit messages. On success the
  // server action redirects, so the only messages reaching here are failures.
  React.useEffect(() => {
    if (verifyPhoneOtpState.code === 'idle' || !verifyPhoneOtpState.message) return;
    setOtpError(verifyPhoneOtpState.message);
  }, [verifyPhoneOtpState]);

  // Cooldown countdown for the resend button.
  React.useEffect(() => {
    if (cooldownSec <= 0) return;
    const handle = window.setTimeout(
      () => setCooldownSec((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearTimeout(handle);
  }, [cooldownSec]);

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
      const gate = await precheckResendAction(email);
      if (!gate.ok) {
        setSubmitError(gate.message ?? SERVICE_UNAVAILABLE_MESSAGE);
        return;
      }
      const { error } = await withTimeout(
        getSupabase().auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: callbackRedirectTo },
        }),
        DEFAULT_AUTH_TIMEOUT_MS,
      );
      if (error) {
        setSubmitError(toAuthErrorMessage(error));
        return;
      }
      setSubmitError(null);
      setResendInfo('If your account is pending confirmation, we sent another email.');
    } catch {
      setSubmitError(SERVICE_UNAVAILABLE_MESSAGE);
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
          setOtpCode('');
          setCooldownSec(0);
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
            <PasswordField
              name="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="current-password"
              placeholder="••••••••"
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

          {reason === 'reauth' && !passwordError ? (
            <InlineInfo message="Confirm it's you to finish deleting your account." />
          ) : null}
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
            We send a 6-digit code by SMS to a registered phone number.
          </p>

          <EditorialFieldRow label="Phone number" strong>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <select
                aria-label="Country code"
                value={countryCode}
                onChange={(event) => {
                  setCountryCode(event.target.value);
                  setLocalPhone('');
                }}
                style={COUNTRY_SELECT_STYLE}
                className="focus-ring"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={selectedCountry.localLength}
                pattern={selectedCountry.regex.source}
                autoComplete="tel-national"
                placeholder={selectedCountry.placeholder}
                value={localPhone}
                onChange={(event) =>
                  setLocalPhone(
                    event.target.value.replace(/\D+/g, '').slice(0, selectedCountry.localLength),
                  )
                }
                style={{ ...INPUT_STYLE, flex: 1 }}
                className="focus-ring"
                disabled={otpSent}
              />
            </div>
          </EditorialFieldRow>

          {!otpSent ? (
            <form action={sendPhoneOtpFormAction} style={{ display: 'contents' }}>
              <input type="hidden" name="countryCode" value={countryCode} />
              <input type="hidden" name="localNumber" value={localPhone} />
              {captchaToken ? (
                <input type="hidden" name="captchaToken" value={captchaToken} />
              ) : null}
              {captchaRequired ? (
                <EditorialFieldRow label="Security check" optional>
                  <TurnstileWidget onToken={setCaptchaToken} />
                </EditorialFieldRow>
              ) : null}
              <PhoneSendButton
                disabled={
                  !captchaReady ||
                  !selectedCountry.regex.test(localPhone)
                }
                label="Send OTP code →"
              />
            </form>
          ) : (
            <>
              <form action={verifyPhoneOtpFormAction} style={{ display: 'contents' }}>
                <input type="hidden" name="countryCode" value={countryCode} />
                <input type="hidden" name="localNumber" value={localPhone} />
                <input type="hidden" name="next" value={nextPath} />
                <EditorialFieldRow label="OTP code">
                  <input
                    name="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{6}"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(event.target.value.replace(/\D+/g, '').slice(0, 6))
                    }
                    style={INPUT_STYLE}
                    className="focus-ring"
                    required
                  />
                </EditorialFieldRow>
                <PhoneVerifyButton disabled={otpCode.length < 6} />
              </form>
              <form
                action={sendPhoneOtpFormAction}
                style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start' }}
              >
                <input type="hidden" name="countryCode" value={countryCode} />
                <input type="hidden" name="localNumber" value={localPhone} />
                {captchaToken ? (
                  <input type="hidden" name="captchaToken" value={captchaToken} />
                ) : null}
                <PhoneResendButton cooldownSec={cooldownSec} />
              </form>
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
          gap: 12,
          alignItems: 'baseline',
          flexWrap: 'wrap',
          paddingTop: 4,
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
