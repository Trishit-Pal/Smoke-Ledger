'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSupabase } from '@web/lib/supabase/client';
import { Card } from '@web/components/ui/Card';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
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
      <Card>
        <div className="flex flex-col gap-md text-center">
          <Text variant="h2">Password updated</Text>
          <Text variant="small" muted>
            Your password has been reset. Sign in with your new password.
          </Text>
          <Link href="/login" className="text-accent text-small font-medium hover:opacity-80 mt-md">
            Continue to sign in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-lg" noValidate>
        <Text variant="small" muted className="text-center">
          Enter a new password for your account.
        </Text>

        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message ?? null}
          {...register('password')}
        />

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          error={errors.confirmPassword?.message ?? null}
          {...register('confirmPassword')}
        />

        {submitError ? (
          <Text variant="small" color="var(--danger, #C85A54)" className="text-center">
            {submitError}
          </Text>
        ) : null}

        <Button
          type="submit"
          title={isSubmitting ? 'Updating…' : 'Update password'}
          variant="primary"
          fullWidth
          loading={isSubmitting}
        />
      </form>
    </Card>
  );
}
