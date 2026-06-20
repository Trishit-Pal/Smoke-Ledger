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
import { LEGAL_COPY, LEGAL_LINKS } from '@web/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import { isAdult } from '@/domain/age';
import { GENDER_VALUES } from '@/lib/validation';
import { GENDER_LABELS } from '@/lib/profileLabels';
import { TurnstileWidget, isCaptchaConfigured } from '@web/components/security/Turnstile';
import { PasswordField } from '@web/components/auth/PasswordField';
import { ThemedSelect } from '@web/components/ui/ThemedSelect';
import {
  INPUT_STYLE,
  DATE_INPUT_STYLE,
  PRIMARY_CTA_STYLE,
  SECONDARY_CTA_STYLE,
} from '@web/lib/auth/inputStyle';
import { emailZodStrict, useDebouncedEmailValidity } from '@web/lib/auth/email';
import { withTimeout, DEFAULT_AUTH_TIMEOUT_MS } from '@web/lib/auth/withTimeout';
import { precheckSignupAction, precheckResendAction } from '../_actions/authPrechecks';
// CHARACTER (1): mood dispatcher.
import { dispatchMood } from '@web/lib/character/mood';

const SERVICE_UNAVAILABLE_MESSAGE =
  'Service is temporarily unavailable. Please try again in a moment.';

const schema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your name').max(80, 'Name is too long'),
    email: emailZodStrict,
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth'),
    gender: z.enum(GENDER_VALUES, {
      errorMap: () => ({ message: 'Select an option' }),
    }),
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
  })
  .refine((d) => isAdult(d.dateOfBirth), {
    path: ['dateOfBirth'],
    message: 'You must be 18 or older to use Smoke Ledger.',
  });
type FormValues = z.infer<typeof schema>;

function emailRedirectTo(): string | undefined {
  // Always carry a `?next=` so the email template can append `&token_hash=…&type=…`
  // with a valid query string. New accounts are routed to onboarding by the
  // callback regardless of this value (consent gates), so it is a safe default.
  return typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding/privacy')}`
    : undefined;
}

function SignupEmailSuccess({ email }: { email: string }) {
  const [resendLoading, setResendLoading] = React.useState(false);
  const [resendInfo, setResendInfo] = React.useState<string | null>(null);
  const [resendError, setResendError] = React.useState<string | null>(null);

  const onResend = async () => {
    setResendLoading(true);
    setResendInfo(null);
    setResendError(null);
    try {
      const gate = await precheckResendAction(email);
      if (!gate.ok) {
        setResendError(gate.message ?? SERVICE_UNAVAILABLE_MESSAGE);
        return;
      }
      const { error } = await withTimeout(
        getSupabase().auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: emailRedirectTo() },
        }),
        DEFAULT_AUTH_TIMEOUT_MS,
      );
      if (error) {
        setResendError(toSafeErrorMessage(error, 'dependency_failure'));
        return;
      }
      setResendInfo('If your account is pending confirmation, we sent another email.');
    } catch {
      setResendError(SERVICE_UNAVAILABLE_MESSAGE);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <>
      <EditorialMasthead
        caption="Account · Pending"
        title={
          <>
            Check your <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>inbox</span>.
          </>
        }
        subtitle={
          <>
            We sent a confirmation link to <span style={{ color: 'var(--text)' }}>{email}</span>.
            Open it to continue — the next step captures your privacy and consent preferences.
          </>
        }
      />

      <p
        style={{
          fontSize: 12,
          color: 'var(--text-faint)',
          lineHeight: 1.55,
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
        }}
      >
        Didn&rsquo;t arrive? Check spam or Promotions, wait a few minutes, then tap resend below.
      </p>

      <button
        type="button"
        onClick={onResend}
        disabled={resendLoading}
        className="focus-ring"
        style={{
          ...SECONDARY_CTA_STYLE,
          opacity: resendLoading ? 0.45 : 1,
          cursor: resendLoading ? 'not-allowed' : 'pointer',
        }}
      >
        {resendLoading ? 'Sending…' : 'Resend confirmation email'}
      </button>

      {resendInfo ? (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: 'var(--accent)',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          {resendInfo}
        </p>
      ) : null}
      {resendError ? (
        <p
          role="alert"
          style={{ fontSize: 13, color: 'var(--warn-earth)', margin: 0 }}
        >
          {resendError}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
        <Link
          href={`mailto:${LEGAL_COPY.supportEmail}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          Contact support
        </Link>
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
      </div>
    </>
  );
}

export default function SignupPage() {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [existingEmail, setExistingEmail] = React.useState<string | null>(null);
  const [otpSignupError, setOtpSignupError] = React.useState<string | null>(null);
  const [otpSignupLoading, setOtpSignupLoading] = React.useState(false);
  const [successEmail, setSuccessEmail] = React.useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const captchaRequired = isCaptchaConfigured();
  const captchaReady = !captchaRequired || !!captchaToken;
  const isDev = process.env.NODE_ENV !== 'production';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Gender uses a custom themed dropdown (not a native <input>), so register it
  // manually and drive it via setValue.
  React.useEffect(() => {
    register('gender');
  }, [register]);

  const fullNameValue = watch('fullName');
  const emailValue = watch('email');
  const dobValue = watch('dateOfBirth');
  const genderValue = watch('gender');
  const passwordValue = watch('password');
  const confirmValue = watch('confirmPassword');
  const acknowledgedValue = watch('acknowledged');
  const emailValidity = useDebouncedEmailValidity(emailValue);
  // Only surface live errors that are high-signal (disposable domain). Format
  // typos wait for submit so we don't nag while the user is still typing.
  const liveEmailError =
    emailValidity.state === 'invalid' && emailValidity.message.startsWith('Disposable')
      ? emailValidity.message
      : null;

  // CHARACTER (2): greet on mount — figure waves as the form appears.
  React.useEffect(() => {
    const t = window.setTimeout(
      () => dispatchMood('greet', { durationMs: 2000 }),
      500,
    );
    return () => window.clearTimeout(t);
  }, []);

  // CHARACTER (3): thumb when all fields look correctly filled. Encouragement
  // before the user clicks submit — "ready when you are."
  const formLooksComplete =
    (fullNameValue?.trim().length ?? 0) > 0 &&
    emailValue?.includes('@') &&
    isAdult(dobValue ?? '') &&
    !!genderValue &&
    (passwordValue?.length ?? 0) >= 8 &&
    confirmValue === passwordValue &&
    acknowledgedValue === true;

  React.useEffect(() => {
    if (formLooksComplete) {
      dispatchMood('thumb', {
        caption: 'Ready when you are.',
        durationMs: 5000,
      });
    }
  }, [formLooksComplete]);

  // CHARACTER (4): applaud on successful account creation.
  React.useEffect(() => {
    if (successEmail) {
      dispatchMood('applaud', {
        caption: 'Welcome aboard.',
        celebrate: true,
        durationMs: 3200,
      });
    }
  }, [successEmail]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setExistingEmail(null);
    if (captchaRequired && !captchaToken) {
      setSubmitError('Please complete the security check.');
      return;
    }
    const trimmedEmail = values.email.trim();
    const gate = await precheckSignupAction(trimmedEmail);
    if (!gate.ok) {
      setSubmitError(gate.message ?? SERVICE_UNAVAILABLE_MESSAGE);
      return;
    }
    const result = await withTimeout(
      getSupabase().auth.signUp({
        email: trimmedEmail,
        password: values.password,
        options: {
          emailRedirectTo: emailRedirectTo(),
          // Identity is enforced + persisted by the handle_new_user DB trigger,
          // which also hard-blocks under-18 (aborts the auth insert).
          data: {
            full_name: values.fullName.trim(),
            date_of_birth: values.dateOfBirth,
            gender: values.gender,
          },
          ...(captchaToken ? { captchaToken } : {}),
        },
      }),
      DEFAULT_AUTH_TIMEOUT_MS,
    ).catch(() => null);
    if (!result) {
      setSubmitError(SERVICE_UNAVAILABLE_MESSAGE);
      setCaptchaToken(null);
      return;
    }
    const { data, error } = result;
    if (error) {
      setSubmitError(toSafeErrorMessage(error, 'authentication_error'));
      setCaptchaToken(null);
      return;
    }
    const identities = data?.user?.identities ?? [];
    if (data?.user && identities.length === 0) {
      setExistingEmail(trimmedEmail);
      setSubmitError(
        'An account with this email already exists. Sign in below or reset your password.',
      );
      setCaptchaToken(null);
      return;
    }
    setSuccessEmail(trimmedEmail);
  };

  const onInvalid = (fieldErrors: typeof errors) => {
    if (isDev) console.warn('[signup] validation failed', fieldErrors);
    setSubmitError('Please review the highlighted fields above and try again.');
  };

  const onSignupWithOtp = async () => {
    setOtpSignupError(null);
    setExistingEmail(null);
    const parsed = z
      .string()
      .email('Enter a valid email first')
      .safeParse(emailValue?.trim() ?? '');
    if (!parsed.success) {
      setOtpSignupError(parsed.error.issues[0]?.message ?? 'Enter a valid email first');
      return;
    }
    // The email-link path also creates an account, so it must carry the same
    // identity + 18+ gate — otherwise it would be a bypass around the age check.
    const fullName = fullNameValue?.trim() ?? '';
    const gender = genderValue;
    const dob = dobValue ?? '';
    if (!fullName || !gender || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setOtpSignupError('Please fill in your name, date of birth, and gender first.');
      return;
    }
    if (!isAdult(dob)) {
      setOtpSignupError('You must be 18 or older to use Smoke Ledger.');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setOtpSignupError('Please complete the security check.');
      return;
    }
    setOtpSignupLoading(true);
    try {
      const gate = await precheckSignupAction(parsed.data);
      if (!gate.ok) {
        setOtpSignupError(gate.message ?? SERVICE_UNAVAILABLE_MESSAGE);
        return;
      }
      const { error } = await withTimeout(
        getSupabase().auth.signInWithOtp({
          email: parsed.data,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: emailRedirectTo(),
            data: { full_name: fullName, date_of_birth: dob, gender },
            ...(captchaToken ? { captchaToken } : {}),
          },
        }),
        DEFAULT_AUTH_TIMEOUT_MS,
      );
      if (error) {
        setOtpSignupError(toSafeErrorMessage(error, 'authentication_error'));
        setCaptchaToken(null);
        return;
      }
      setSuccessEmail(parsed.data);
    } catch {
      setOtpSignupError(SERVICE_UNAVAILABLE_MESSAGE);
      setCaptchaToken(null);
    } finally {
      setOtpSignupLoading(false);
    }
  };

  if (successEmail) {
    return <SignupEmailSuccess email={successEmail} />;
  }

  return (
    <>
      <EditorialMasthead
        caption="Account · Begin"
        title={
          <>
            Open the <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>book</span>.
          </>
        }
        subtitle="A few details. Ninety seconds."
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="flex flex-col"
        style={{ gap: 0 }}
        noValidate
      >
        <EditorialFieldRow label="Name" error={errors.fullName?.message ?? null} strong>
          <input
            type="text"
            autoComplete="name"
            placeholder="Your name"
            style={INPUT_STYLE}
            className="focus-ring"
            {...register('fullName')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow label="Email" error={errors.email?.message ?? liveEmailError}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            style={INPUT_STYLE}
            className="focus-ring"
            {...register('email')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow
          label="Date of birth"
          error={errors.dateOfBirth?.message ?? null}
          hint="You must be 18 or older. This can't be changed later."
        >
          <input
            type="date"
            autoComplete="bday"
            style={DATE_INPUT_STYLE}
            className="focus-ring"
            {...register('dateOfBirth')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow
          label="Gender"
          error={errors.gender?.message ?? null}
          hint="This can't be changed later."
        >
          <ThemedSelect
            ariaLabel="Gender"
            value={genderValue}
            hasError={!!errors.gender}
            onChange={(v) =>
              setValue('gender', v as FormValues['gender'], {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={GENDER_VALUES.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          />
        </EditorialFieldRow>
        <EditorialFieldRow label="Password" error={errors.password?.message ?? null}>
          <PasswordField
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('password')}
          />
        </EditorialFieldRow>
        <EditorialFieldRow
          label="Confirm password"
          error={errors.confirmPassword?.message ?? null}
        >
          <PasswordField
            autoComplete="new-password"
            placeholder="Repeat password"
            {...register('confirmPassword')}
          />
        </EditorialFieldRow>

        <label
          htmlFor="signup-acknowledged"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 0',
            borderTop: '1px solid var(--rule)',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
          }}
        >
          <input
            id="signup-acknowledged"
            type="checkbox"
            className="ed-checkbox focus-ring"
            aria-describedby={errors.acknowledged ? 'signup-acknowledged-error' : undefined}
            style={{ marginTop: 2 }}
            {...register('acknowledged')}
          />
          <span>
            I am 18 or older and understand the next step will ask me to review and accept the{' '}
            <Link href={LEGAL_LINKS.terms} style={{ color: 'var(--accent)' }}>
              Terms
            </Link>
            ,{' '}
            <Link href={LEGAL_LINKS.privacy} style={{ color: 'var(--accent)' }}>
              Privacy Policy
            </Link>
            , and medical disclaimer.
          </span>
        </label>
        {errors.acknowledged ? (
          <p
            id="signup-acknowledged-error"
            role="alert"
            style={{ fontSize: 13, color: 'var(--warn-earth)', margin: '4px 0 0 0' }}
          >
            {errors.acknowledged.message}
          </p>
        ) : null}

        {captchaRequired ? (
          <EditorialFieldRow label="Security check" optional>
            <TurnstileWidget onToken={setCaptchaToken} />
          </EditorialFieldRow>
        ) : null}

        {submitError ? (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth)', margin: 0 }}>
              {submitError}
            </p>
            {existingEmail ? (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                <Link
                  href={`/login?prefill=${encodeURIComponent(existingEmail)}`}
                  style={{ color: 'var(--accent)' }}
                >
                  Sign in
                </Link>
                {' · '}
                <Link
                  href={`/reset?prefill=${encodeURIComponent(existingEmail)}`}
                  style={{ color: 'var(--accent)' }}
                >
                  Reset password
                </Link>
              </p>
            ) : null}
          </div>
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
          {isSubmitting ? 'Creating account…' : 'Begin the ledger →'}
        </button>
        <button
          type="button"
          onClick={onSignupWithOtp}
          disabled={otpSignupLoading || !captchaReady}
          className="focus-ring"
          style={{
            ...SECONDARY_CTA_STYLE,
            marginTop: 12,
            opacity: otpSignupLoading || !captchaReady ? 0.45 : 1,
            cursor: otpSignupLoading || !captchaReady ? 'not-allowed' : 'pointer',
          }}
        >
          {otpSignupLoading ? 'Sending link…' : 'Sign up with email link instead'}
        </button>

        {otpSignupError ? (
          <p
            role="alert"
            style={{ fontSize: 13, color: 'var(--warn-earth)', margin: '12px 0 0 0' }}
          >
            {otpSignupError}
          </p>
        ) : null}
      </form>

      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', paddingTop: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?
        </span>
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
          Sign in →
        </Link>
      </div>

      <EditorialClosingSignet align="left">
        Private by default. Your data is yours to export or delete from Settings — at any time.
      </EditorialClosingSignet>
    </>
  );
}
