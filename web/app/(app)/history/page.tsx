import { getHistoryPageData } from '@web/lib/server/data';
import { HistoryClient } from './HistoryClient';

export default async function HistoryPage() {
  const { profile, logs, nextCursor } = await getHistoryPageData();
  return <HistoryClient profile={profile} logs={logs} nextCursor={nextCursor} />;
}
