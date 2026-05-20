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
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';

const schema = z.object({
  email: z.string().email('Enter a valid email').max(254),
});
type FormValues = z.infer<typeof schema>;

export default function ResetPage() {
  const [success, setSuccess] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (captchaRequired && !captchaToken) {
      setSubmitError('Please complete the security check.');
      return;
    }
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`
        : undefined;
    // Neutral copy regardless of whether the email is registered, to avoid
    // account enumeration. Errors are swallowed intentionally.
    await getSupabase().auth.resetPasswordForEmail(values.email.trim(), {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    });
    setCaptchaToken(null);
    setSuccess(true);
  };

  if (success) {
    return (
      <Card>
        <div className="flex flex-col gap-md text-center">
          <Text variant="h2">Check your email</Text>
          <Text variant="small" muted>
            If an account exists for that email, we just sent a password reset link.
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
        <Text variant="small" muted className="text-center">
          Enter your email and we will send you a reset link.
        </Text>

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message ?? null}
          {...register('email')}
        />

        {captchaRequired ? <TurnstileWidget onToken={setCaptchaToken} /> : null}

        {submitError ? (
          <Text variant="small" color="var(--danger, #C85A54)" className="text-center" role="alert">
            {submitError}
          </Text>
        ) : null}

        <Button
          type="submit"
          title={isSubmitting ? 'Sending…' : 'Send reset link'}
          variant="primary"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting || !captchaReady}
        />

        <div className="text-center text-small">
          <Link href="/login" className="text-text-muted hover:text-text">
            Back to sign in
          </Link>
        </div>
        <Text variant="caption" muted className="text-center">
          Need account help?{' '}
          <Link href={LEGAL_LINKS.support} className="text-accent hover:opacity-80">
            Contact support
          </Link>
        </Text>
      </form>
    </Card>
  );
}
