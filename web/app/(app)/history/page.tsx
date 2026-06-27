import { getHistoryPageData, getServerBrandsWithVariants } from '@web/lib/server/data';
import { HistoryClient } from './HistoryClient';

export default async function HistoryPage() {
  const [{ profile, logs, nextCursor }, brands] = await Promise.all([
    getHistoryPageData(),
    getServerBrandsWithVariants(),
  ]);
  return <HistoryClient profile={profile} logs={logs} brands={brands} nextCursor={nextCursor} />;
}
