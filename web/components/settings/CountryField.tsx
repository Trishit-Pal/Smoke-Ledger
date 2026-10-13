'use client';

import * as React from 'react';
import { ThemedSelect } from '@web/components/ui/ThemedSelect';
import { isRegionPickerEnabled, regionFor, regionOptions } from '@/lib/regions';

/**
 * Country control for the ledger. Renders nothing unless the deploy flag is on,
 * so existing India sessions keep the current onboarding and settings screens.
 */
export function CountryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (country: string) => void;
}) {
  if (!isRegionPickerEnabled()) return null;
  const region = regionFor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="text-small text-text-muted">Country</span>
      <ThemedSelect
        value={value}
        onChange={onChange}
        options={regionOptions()}
        ariaLabel="Country"
      />
      <p className="text-small text-text-muted">
        {region?.currency === 'EUR'
          ? 'Logs in this country are kept in euros. A later switch to rupees clears the ledger.'
          : 'Logs in India are kept in rupees. A later switch to euros clears the ledger.'}
      </p>
    </div>
  );
}
