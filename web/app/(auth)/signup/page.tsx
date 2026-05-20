'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { Card } from '@web/components/ui/Card';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { LEGAL_LINKS } from '@web/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';

// Legal acceptance is captured (and persisted) inside the onboarding/privacy
// step which runs immediately after email confirmation. We keep a single
// affirmative checkbox here so the user cannot create an account without
// acknowledging that consent is part of the funnel.
const schema = z
  .object({
    email: z.string().email('Enter a valid email').max(254),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long'),
    confirmPassword: z.string(),
    acknowledged: z.literal(true, {
      errorMap: () => ({
        message: 'You must acknowledge that you are 18+ and will accept the legal terms next.',
      }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [otpSignupError, setOtpSignupError] = React.useState<string | null>(null);
  const [otpSignupLoading, setOtpSignupLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const emailValue = watch('email');

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (captchaRequired && !captchaToken) {
      setSubmitError('Please complete the security check.');
      return;
    }
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await getSupabase().auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        emailRedirectTo,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) {
      setSubmitError(toSafeErrorMessage(error, 'authentication_error'));
      setCaptchaToken(null);
      return;
    }
    setSuccess(true);
  };

  const onSignupWithOtp = async () => {
    setOtpSignupError(null);
    const parsed = z.string().email('Enter a valid email first').safeParse(emailValue?.trim() ?? '');
    if (!parsed.success) {
      setOtpSignupError(parsed.error.issues[0]?.message ?? 'Enter a valid email first');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setOtpSignupError('Please complete the security check.');
      return;
    }
    setOtpSignupLoading(true);
    try {
      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
      const { error } = await getSupabase().auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) {
        setOtpSignupError(toSafeErrorMessage(error, 'authentication_error'));
        setCaptchaToken(null);
        return;
      }
      setSuccess(true);
    } finally {
      setOtpSignupLoading(false);
    }
  };

  if (success) {
    return (
      <Card>
        <div className="flex flex-col gap-md text-center">
          <Text variant="h2">Check your email</Text>
          <Text variant="small" muted>
            We sent a confirmation link to your inbox. Confirm your email to continue. The next step
            captures your privacy and consent preferences.
          </Text>
          <Link href="/login" className="text-accent text-small font-medium hover:opacity-80 mt-md">
            Back to sign in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message ?? null}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            error={errors.confirmPassword?.message ?? null}
            {...register('confirmPassword')}
          />
        </div>

        <div className="flex flex-col gap-sm rounded-md border border-border bg-bg-elevated p-md">
          <label
            htmlFor="signup-acknowledged"
            className="flex items-start gap-sm text-small text-text-muted"
          >
            <input
              id="signup-acknowledged"
              type="checkbox"
              className="mt-0.5"
              aria-describedby={errors.acknowledged ? 'signup-acknowledged-error' : undefined}
              {...register('acknowledged')}
            />
            <span>
              I am 18 or older and understand the next step will ask me to review and accept the{' '}
              <Link href={LEGAL_LINKS.terms} className="text-accent hover:opacity-80">
                Terms
              </Link>
              ,{' '}
              <Link href={LEGAL_LINKS.privacy} className="text-accent hover:opacity-80">
                Privacy Policy
              </Link>
              , and medical disclaimer.
            </span>
          </label>
          {errors.acknowledged ? (
            <Text
              id="signup-acknowledged-error"
              variant="small"
              color="var(--danger, #C85A54)"
              role="alert"
            >
              {errors.acknowledged.message}
            </Text>
          ) : null}
        </div>

        {captchaRequired ? <TurnstileWidget onToken={setCaptchaToken} /> : null}

        {submitError ? (
          <Text variant="small" color="var(--danger, #C85A54)" className="text-center" role="alert">
            {submitError}
          </Text>
        ) : null}

        <Button
          type="submit"
          title={isSubmitting ? 'Creating account…' : 'Create account'}
          variant="primary"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting || !captchaReady}
        />
        <Button
          type="button"
          title={otpSignupLoading ? 'Sending OTP…' : 'Sign up with email OTP'}
          variant="secondary"
          fullWidth
          loading={otpSignupLoading}
          onPress={onSignupWithOtp}
          disabled={otpSignupLoading || !captchaReady}
        />

        {otpSignupError ? (
          <Text variant="small" color="var(--danger, #C85A54)" className="text-center" role="alert">
            {otpSignupError}
          </Text>
        ) : null}

        <div className="text-center text-small">
          <span className="text-text-muted">Already have an account? </span>
          <Link href="/login" className="text-accent hover:opacity-80 font-medium">
            Sign in
          </Link>
        </div>
      </form>
    </Card>
  );
}
