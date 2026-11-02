import * as React from 'react';
import { getGoalsPageData } from '@web/lib/server/data';
import { GoalsClient } from './GoalsClient';

export default async function GoalsPage() {
  const { profile, goals, logs, today } = await getGoalsPageData();
  return (
    // GoalsClient reads ?type= via useSearchParams, which needs a Suspense boundary.
    <React.Suspense fallback={null}>
      <GoalsClient
        profile={profile}
        goals={goals}
        logs={logs}
        today={today}
      />
    </React.Suspense>
  );
}
