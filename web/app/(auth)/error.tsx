'use client';

import * as React from 'react';
import Link from 'next/link';
import { logClientError } from '@/lib/logger';
import { toSafeErrorMessage } from '@/lib/errors';
import { Button } from '@web/components/ui/Button';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    void logClientError(error, { category: 'web.boundary.auth', digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-lg">
      <div className="w-full max-w-sm">
        <Card>
          <div className="flex flex-col gap-md text-center">
            <Text variant="h2">Sign-in unavailable</Text>
            <Text variant="small" muted>
              {toSafeErrorMessage(error, 'internal_error')}
            </Text>
            <Button title="Try again" variant="primary" fullWidth onPress={reset} />
            <Link href="/login" className="text-accent-ink text-small font-medium hover:opacity-80 mt-sm">
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
