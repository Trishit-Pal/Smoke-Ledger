'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { EditorialMasthead } from '@web/components/editorial/EditorialMasthead';
import { EditorialFieldRow } from '@web/components/editorial/EditorialFieldRow';
import { EditorialClosingSignet } from '@web/components/editorial/EditorialClosingSignet';
import { toSafeErrorMessage } from '@/lib/errors';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setSubmitError(toSafeErrorMessage(error, 'authentication_error'));
      return;
    }
    await supabase.auth.signOut();
    setSuccess(true);
    setTimeout(() => {
      router.replace('/login');
    }, 800);
  };

  if (success) {
    return (
      <>
        <EditorialMasthead
          caption="Account · Updated"
          title={
            <>
              <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Filed</span>.
            </>
          }
          subtitle="Your password has been reset. Sign in with your new password."
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
          Continue to sign in →
        </Link>
        <EditorialClosingSignet align="left">Quietly entered.</EditorialClosingSignet>
      </>
    );
  }

  return (
    <>
      <EditorialMasthead
        caption="Account · New password"
        title={
          <>
            Set a <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>new</span> line.
          </>
        }
        subtitle="Enter a new password for your account."
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col"
        style={{ gap: 0 }}
        noValidate
      >
        <EditorialFieldRow label="New password" error={errors.password?.message ?? null} strong>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            style={INPUT_STYLE}
            className="focus-ring"
            {...register('password')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow
          label="Confirm new password"
          error={errors.confirmPassword?.message ?? null}
        >
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            style={INPUT_STYLE}
            className="focus-ring"
            {...register('confirmPassword')}
          />
        </EditorialFieldRow>

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
          disabled={isSubmitting}
          className="focus-ring"
          style={{
            ...PRIMARY_CTA_STYLE,
            marginTop: 16,
            opacity: isSubmitting ? 0.45 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Updating…' : 'Update password →'}
        </button>
      </form>

      <EditorialClosingSignet align="left">Quietly entered.</EditorialClosingSignet>
    </>
  );
}
