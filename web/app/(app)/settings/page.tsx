import { getSettingsPageData } from '@web/lib/server/data';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const { profile, brands, analyticsOptIn } = await getSettingsPageData();
  return (
    <SettingsClient profile={profile} brands={brands} analyticsOptIn={analyticsOptIn} />
  );
}
