import { getHistoryPageData } from '@web/lib/server/data';
import { listBrandsWithVariants } from '@/db/repositories/brands';
import { HistoryClient } from './HistoryClient';

export default async function HistoryPage() {
  const { profile, logs, nextCursor } = await getHistoryPageData();
  const brands = await listBrandsWithVariants();
  return <HistoryClient profile={profile} logs={logs} brands={brands} nextCursor={nextCursor} />;
}
