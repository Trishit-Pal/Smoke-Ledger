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
import { PasswordField } from '@web/components/auth/PasswordField';
import { ConfettiBurst } from '@web/components/character/ConfettiBurst';
import { PRIMARY_CTA_STYLE } from '@web/lib/auth/inputStyle';
import { toSafeErrorMessage } from '@/lib/errors';

const RESET_SESS_HOLD_WEB = 2600;

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

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
    setSuccess(true);
    // Sign out right before redirecting (not now) so the success screen keeps a
    // valid session while the celebratory burst (~1.4s) plays — signing out first
    // can let middleware bounce the user to /login before the burst is seen. The
    // manual "Continue to sign in →" link lets impatient users skip ahead.
    timerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace('/login');
    }, RESET_SESS_HOLD_WEB);
  };

  const reduceMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  if (success) {
    return (
      <div style={{ position: 'relative' }}>
        <ConfettiBurst active={!reduceMotion} />
        <EditorialMasthead
          caption="Account · Updated"
          title={
            <>
              <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>Filed</span>.
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
            color: 'var(--accent-ink)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Continue to sign in →
        </Link>
        <EditorialClosingSignet align="left">Quietly entered.</EditorialClosingSignet>
      </div>
    );
  }

  return (
    <>
      <EditorialMasthead
        caption="Account · New password"
        title={
          <>
            Set a <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>new</span> line.
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
          <PasswordField
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('password')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow
          label="Confirm new password"
          error={errors.confirmPassword?.message ?? null}
        >
          <PasswordField
            autoComplete="new-password"
            placeholder="Repeat password"
            {...register('confirmPassword')}
          />
        </EditorialFieldRow>

        {submitError ? (
          <p
            role="alert"
            style={{ fontSize: 13, color: 'var(--warn-earth-ink)', margin: '12px 0 0 0' }}
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
