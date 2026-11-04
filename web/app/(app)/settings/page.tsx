import { getSettingsPageData } from '@web/lib/server/data';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';
import { SettingsClient } from './SettingsClient';

// Next.js 15: searchParams is a Promise and must be awaited.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string }>;
}) {
  const { action } = (await searchParams) ?? {};
  const { profile, brands, analyticsOptIn, ledgerChatOptIn } = await getSettingsPageData();
  return (
    <SettingsClient
      profile={profile}
      brands={brands}
      analyticsOptIn={analyticsOptIn}
      ledgerChatOptIn={ledgerChatOptIn}
      chatEnabled={isLedgerChatEnabled()}
      initialAction={action}
    />
  );
}
