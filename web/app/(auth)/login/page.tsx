'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { Card } from '@web/components/ui/Card';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';
import {
  toAuthErrorMessage,
} from '@/lib/auth-errors';
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';
import { setRememberMePreference } from '@web/lib/auth/rememberMe';
import { sanitizeNextPath } from '@web/lib/auth/redirect';

const emailSchema = z.string().email('Enter a valid email');
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use E.164 format, e.g. +919876543210');

const schema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
type FormValues = z.infer<typeof schema>;
type AuthMode = 'password' | 'email_otp' | 'phone_otp';

export default function LoginPage() {
  // useSearchParams forces a client boundary at the leaf; wrap in Suspense to
  // satisfy Next 14's bailout warning and keep the static shell streaming.
  return (
    <React.Suspense fallback={<Card><div className="h-[20rem]" /></Card>}>
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
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;

  React.useEffect(() => {
    if (callbackError === 'invalid_or_expired_link') {
      setSubmitError('This verification link is invalid or expired. Request a new one.');
    } else if (callbackError === 'session_missing') {
      setSubmitError('Your session has expired. Please sign in again.');
    } else if (callbackError === 'email_not_confirmed') {
      setSubmitError('Please confirm your email before signing in.');
    }
  }, [callbackError]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (captchaRequired && !captchaToken) {
      setSubmitError('Please complete the security check.');
      return;
    }
    setRememberMePreference(rememberMe);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          rememberMe,
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
        const code = body.code ?? '';
        if (code === 'email_not_confirmed') {
          setSubmitError(body.message ?? toAuthErrorMessage({ code: 'email_not_confirmed' }));
        } else if (code === 'invalid_credentials') {
          setSubmitError(body.message ?? toAuthErrorMessage({ code: 'invalid_credentials' }));
        } else {
          setSubmitError(body.message ?? toAuthErrorMessage({ code }));
        }
        setCaptchaToken(null);
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setSubmitError('Unable to sign in. Please try again.');
      setCaptchaToken(null);
    }
  };

  const callbackRedirectTo = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }, [nextPath]);

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
        // Neutral copy regardless of whether the account exists, to defeat
        // account enumeration. Supabase's "enumeration protection" setting
        // should also be enabled in the dashboard for defense in depth.
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
    <Card>
      <div className="flex flex-col gap-lg">
        <div className="grid grid-cols-3 gap-sm">
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setOtpError(null);
              setOtpInfo(null);
            }}
            className={`rounded-md border px-sm py-xs text-small ${
              mode === 'password'
                ? 'bg-accent text-white border-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('email_otp');
              setOtpSent(false);
              setOtpError(null);
              setOtpInfo(null);
            }}
            className={`rounded-md border px-sm py-xs text-small ${
              mode === 'email_otp'
                ? 'bg-accent text-white border-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            Email link
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('phone_otp');
              setOtpSent(false);
              setOtpError(null);
              setOtpInfo(null);
            }}
            className={`rounded-md border px-sm py-xs text-small ${
              mode === 'phone_otp'
                ? 'bg-accent text-white border-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            Phone OTP
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-lg" noValidate>
            <div className="flex flex-col gap-md">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                error={errors.email?.message ?? null}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message ?? null}
                {...register('password')}
              />
            </div>

            {captchaRequired ? <TurnstileWidget onToken={setCaptchaToken} /> : null}

            <label className="flex items-start gap-sm text-small text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mt-0.5"
              />
              <span>Keep me signed in on this device</span>
            </label>

            {submitError ? (
              <Text
                variant="small"
                color="var(--danger, #C85A54)"
                className="text-center"
                role="alert"
              >
                {submitError}
              </Text>
            ) : null}

            <Button
              type="submit"
              title={isSubmitting ? 'Signing in…' : 'Sign in'}
              variant="primary"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting || !captchaReady}
            />
          </form>
        ) : null}

        {mode === 'email_otp' ? (
          <div className="flex flex-col gap-md">
            <Text variant="caption" muted>
              We email a one-click sign-in link (not a numeric code). Use an account that already
              exists, or create one on the signup page.
            </Text>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={otpEmail}
              onChange={(event) => setOtpEmail(event.target.value)}
            />
            {captchaRequired ? <TurnstileWidget onToken={setCaptchaToken} /> : null}
            <Button
              title={otpLoading ? 'Sending…' : 'Send sign-in link'}
              variant="secondary"
              fullWidth
              loading={otpLoading}
              onPress={sendEmailOtp}
              disabled={otpLoading || !captchaReady}
            />
          </div>
        ) : null}

        {mode === 'phone_otp' ? (
          <div className="flex flex-col gap-md">
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              placeholder="+919876543210"
              value={otpPhone}
              onChange={(event) => setOtpPhone(event.target.value)}
            />
            {!otpSent ? (
              <>
                {captchaRequired ? <TurnstileWidget onToken={setCaptchaToken} /> : null}
                <Button
                  title={otpLoading ? 'Sending…' : 'Send OTP code'}
                  variant="secondary"
                  fullWidth
                  loading={otpLoading}
                  onPress={sendPhoneOtp}
                  disabled={otpLoading || !captchaReady}
                />
              </>
            ) : (
              <>
                <Input
                  label="OTP code"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Enter code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
                <Button
                  title={otpLoading ? 'Verifying…' : 'Verify OTP and sign in'}
                  variant="primary"
                  fullWidth
                  loading={otpLoading}
                  onPress={verifyPhoneOtp}
                />
              </>
            )}
          </div>
        ) : null}

        {mode !== 'password' ? (
          <label className="flex items-start gap-sm text-small text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mt-0.5"
            />
            <span>Keep me signed in on this device</span>
          </label>
        ) : null}

        {otpInfo ? (
          <Text variant="small" muted className="text-center">
            {otpInfo}
          </Text>
        ) : null}
        {otpError ? (
          <Text variant="small" color="var(--danger, #C85A54)" className="text-center">
            {otpError}
          </Text>
        ) : null}

        <div className="flex items-center justify-between text-small">
          <Link href="/signup" className="text-accent hover:opacity-80 font-medium">
            Create account
          </Link>
          <Link href="/reset" className="text-text-muted hover:text-text">
            Forgot password?
          </Link>
        </div>

        <Text variant="caption" muted className="text-center">
          By signing in you agree to our{' '}
          <Link href={LEGAL_LINKS.terms} className="text-accent hover:opacity-80">
            Terms
          </Link>{' '}
          and{' '}
          <Link href={LEGAL_LINKS.privacy} className="text-accent hover:opacity-80">
            Privacy Policy
          </Link>
          .
        </Text>
      </div>
    </Card>
  );
}
