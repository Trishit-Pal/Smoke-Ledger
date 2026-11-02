import { getTrendsPageData } from '@web/lib/server/data';
import { TrendsClient } from './TrendsClient';

export default async function TrendsPage() {
  const { profile, logs, dailySummary, ledgerChatEnabled } = await getTrendsPageData();
  return (
    <TrendsClient
      profile={profile}
      logs={logs}
      dailySummary={dailySummary}
      ledgerChatEnabled={ledgerChatEnabled}
    />
  );
}
