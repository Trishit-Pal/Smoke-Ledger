import { getLogPageData } from '@web/lib/server/data';
import { LogClient } from './LogClient';

export default async function LogPage() {
  const { profile, logs } = await getLogPageData();
  return <LogClient profile={profile} logs={logs} />;
}
