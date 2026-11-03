import { maskBrandAt, maskCount } from '@/lib/discreet';

export interface BrandMixEntry {
  brand: string;
  spendInr: number;
  share: number;
}

export interface BrandRow {
  /** React key: the index under discreet so no real brand name reaches the DOM. */
  key: string;
  name: string;
  shareText: string;
}

/** Brand list rows; same order as the donut slices so "Brand A" matches in both. */
export function brandRows(mix: readonly BrandMixEntry[], discreet: boolean): BrandRow[] {
  return mix.map((b, i) => ({
    key: discreet ? String(i) : b.brand,
    name: maskBrandAt(b.brand, i, discreet),
    shareText: discreet ? maskCount(0, true) : `${Math.round(b.share * 100)}%`,
  }));
}
