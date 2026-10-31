'use client';

import * as React from 'react';
import { toSafeErrorMessage } from '@/lib/errors';
import { logClientError } from '@/lib/logger';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    void logClientError(error, { category: 'web.boundary.app', digest: error.digest });
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] px-lg pt-xl pb-xxxl md:pt-xxl md:px-xxl"
    >
      <div className="flex items-center gap-md">
        <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)]" />
        <h1 className="editorial-caption">This page did not load</h1>
        <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)]" />
      </div>
      <p className="mt-lg text-center text-small italic text-text-muted">
        {toSafeErrorMessage(error, 'internal_error')}
      </p>
      <div className="mt-lg flex justify-center">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 px-lg text-small text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
