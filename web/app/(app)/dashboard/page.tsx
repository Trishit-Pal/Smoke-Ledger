import { getDashboardData } from '@web/lib/server/data';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const { profile, logs, goals, brands } = await getDashboardData();
  return <DashboardClient profile={profile} logs={logs} goals={goals} brands={brands} />;
}
