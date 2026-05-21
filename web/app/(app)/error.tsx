'use client';

import * as React from 'react';
import { Button } from '@web/components/ui/Button';
import { Card } from '@web/components/ui/Card';
import { Text } from '@web/components/ui/Text';
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
    <div className="max-w-2xl mx-auto p-lg">
      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="h2">Could not load this page</Text>
          <Text variant="small" muted>
            {toSafeErrorMessage(error, 'internal_error')}
          </Text>
          <Button title="Try again" onPress={reset} />
        </div>
      </Card>
    </div>
  );
}
