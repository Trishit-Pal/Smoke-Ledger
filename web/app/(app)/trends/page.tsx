import { getTrendsPageData } from '@web/lib/server/data';
import { TrendsClient } from './TrendsClient';

export default async function TrendsPage() {
  const { profile, logs, dailySummary, goals } = await getTrendsPageData();
  return (
    <TrendsClient
      profile={profile}
      logs={logs}
      dailySummary={dailySummary}
      goals={goals}
    />
  );
}
