'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialFieldRow } from '@web/components/editorial/EditorialFieldRow';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { LEGAL_LINKS } from '@web/lib/legal';
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';
import { emailZodStrict } from '@web/lib/auth/email';

const schema = z.object({
  email: emailZodStrict,
});
type FormValues = z.infer<typeof schema>;

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
};

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
    await getSupabase().auth.resetPasswordForEmail(values.email.trim(), {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    });
    setCaptchaToken(null);
    setSuccess(true);
  };

  if (success) {
    return (
      <>
        <EditorialMasthead
          caption="Account · Reset"
          title={
            <>
              Check your <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>inbox</span>.
            </>
          }
          subtitle="If an account exists for that email, we just sent a password reset link."
        />
        <Link
          href="/login"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Back to sign in →
        </Link>
        <EditorialClosingSignet align="left">Quietly, again.</EditorialClosingSignet>
      </>
    );
  }

  return (
    <>
      <EditorialMasthead
        caption="Account · Reset"
        title={
          <>
            A <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>new</span> line.
          </>
        }
        subtitle="Enter your email and we will send you a reset link."
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col"
        style={{ gap: 0 }}
        noValidate
      >
        <EditorialFieldRow label="Email" error={errors.email?.message ?? null} strong>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            style={INPUT_STYLE}
            className="focus-ring"
            {...register('email')}
          />
        </EditorialFieldRow>

        {captchaRequired ? (
          <EditorialFieldRow label="Security check" optional>
            <TurnstileWidget onToken={setCaptchaToken} />
          </EditorialFieldRow>
        ) : null}

        {submitError ? (
          <p
            role="alert"
            style={{ fontSize: 13, color: 'var(--warn-earth)', margin: '12px 0 0 0' }}
          >
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !captchaReady}
          className="focus-ring"
          style={{
            ...PRIMARY_CTA_STYLE,
            marginTop: 16,
            opacity: isSubmitting || !captchaReady ? 0.45 : 1,
            cursor: isSubmitting || !captchaReady ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link →'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', paddingTop: 4 }}>
        <Link
          href="/login"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          Back to sign in
        </Link>
        <Link
          href={LEGAL_LINKS.support}
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Need account help? Contact support →
        </Link>
      </div>

      <EditorialClosingSignet align="left">Quietly, again.</EditorialClosingSignet>
    </>
  );
}
