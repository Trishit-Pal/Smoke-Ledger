import { getDashboardData } from '@web/lib/server/data';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const { profile, logs, latestLogIso, goals, brands, summary, summarySinceYmd } = await getDashboardData();
  return (
    <DashboardClient
      profile={profile}
      logs={logs}
      latestLogIso={latestLogIso}
      goals={goals}
      brands={brands}
      summary={summary}
      summarySinceYmd={summarySinceYmd}
    />
  );
}
