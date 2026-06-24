import { getGoalsPageData } from '@web/lib/server/data';
import { GoalsClient } from './GoalsClient';

export default async function GoalsPage() {
  const { profile, goals, logs, today } = await getGoalsPageData();
  return (
    <GoalsClient
      profile={profile}
      goals={goals}
      logs={logs}
      today={today}
    />
  );
}
