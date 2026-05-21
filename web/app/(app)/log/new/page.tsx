import { getNewLogPageData } from '@web/lib/server/data';
import { LogNewClient } from './LogNewClient';

export default async function NewLogPage() {
  const { brands } = await getNewLogPageData();
  return <LogNewClient brands={brands} />;
}
