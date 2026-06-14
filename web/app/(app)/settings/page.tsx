import { getSettingsPageData } from '@web/lib/server/data';
import { SettingsClient } from './SettingsClient';

// Next.js 14: searchParams is a synchronous plain object.
// Next.js 15 migration: change type to Promise<{action?:string}> and await it.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { action?: string };
}) {
  const { profile, brands, analyticsOptIn } = await getSettingsPageData();
  return (
    <SettingsClient
      profile={profile}
      brands={brands}
      analyticsOptIn={analyticsOptIn}
      initialAction={searchParams?.action}
    />
  );
}
