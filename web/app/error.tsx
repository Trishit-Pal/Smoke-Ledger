'use client';

import * as React from 'react';
import { logClientError } from '@/lib/logger';
import Link from 'next/link';
import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props): React.ReactElement {
  React.useEffect(() => {
    void logClientError(error, {
      category: 'web.boundary.global',
      digest: error.digest,
    });
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[boundary] global', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-lg">
      <div className="w-full max-w-sm">
        <Card>
          <div className="flex flex-col gap-md text-center">
            <Text variant="h2">Something went wrong</Text>
            <Text variant="small" muted>
              We hit an unexpected error. The team has been notified. You can try again or return to
              the dashboard.
            </Text>
            {error.digest ? (
              <Text variant="caption" muted>
                Reference: {error.digest}
              </Text>
            ) : null}
            <Button title="Try again" variant="primary" fullWidth onPress={reset} />
            <Link href="/" className="text-accent text-small font-medium hover:opacity-80 mt-sm">
              Return home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
