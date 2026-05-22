import type { Brand, BrandVariant } from '@/types';
import { AppError } from '@/lib/errors';
import { makeId } from '@/lib/id';
import { getSupabase } from '@/lib/supabase';
import { mapDbError, requireUserId } from '@/db/repositories/_supabase';
import {
  BrandSchema,
  BrandVariantSchema,
  IdSchema,
  parseOrThrow,
} from '@/lib/validation';

type BrandRow = {
  id: string;
  user_id: string;
  name: string;
  category: Brand['category'];
  is_seed: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

type VarRow = {
  id: string;
  user_id: string;
  brand_id: string;
  name: string;
  default_pack_size: number;
  avg_price_inr: number | null;
  last_price_inr: number | null;
  last_priced_at: string | null;
  price_sum_inr?: number | string | null;
  price_count?: number | null;
};

function rowToBrand(r: BrandRow): Brand {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    isSeed: r.is_seed,
    isFavorite: r.is_favorite,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToVariant(r: VarRow): BrandVariant {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: r.name,
    defaultPackSize: r.default_pack_size,
    avgPriceInr: r.avg_price_inr != null ? Number(r.avg_price_inr) : null,
    lastPriceInr: r.last_price_inr != null ? Number(r.last_price_inr) : null,
    lastPricedAt: r.last_priced_at,
  };
}

export async function syncDefaultBrandCatalog(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('sync_default_brand_catalog');
  if (error) throw mapDbError(error);
  const { error: refreshErr } = await supabase.rpc('refresh_seed_prices_from_catalog');
  if (refreshErr && !refreshErr.message.includes('does not exist')) {
    throw mapDbError(refreshErr);
  }
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw mapDbError(error);
  return (data as BrandRow[]).map(rowToBrand);
}

export async function getBrand(id: string): Promise<Brand | null> {
  parseOrThrow(IdSchema, id, 'brand_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? rowToBrand(data as BrandRow) : null;
}

export async function createBrand(
  name: string,
  category: Brand['category'] = 'regular',
): Promise<Brand> {
  const input = parseOrThrow(BrandSchema, { name, category }, 'brand');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const id = makeId('brd');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('brands')
    .insert({
      id,
      user_id: userId,
      name: input.name,
      category: input.category,
      is_seed: false,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw mapDbError(error);
  return rowToBrand(data as BrandRow);
}

export async function toggleFavorite(id: string): Promise<void> {
  parseOrThrow(IdSchema, id, 'brand_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data: row, error: fetchErr } = await supabase
    .from('brands')
    .select('is_favorite')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (fetchErr) throw mapDbError(fetchErr);
  const next = !(row as { is_favorite: boolean }).is_favorite;
  const { error } = await supabase
    .from('brands')
    .update({ is_favorite: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw mapDbError(error);
}

export async function listVariants(brandId: string): Promise<BrandVariant[]> {
  parseOrThrow(IdSchema, brandId, 'brand_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('brand_variants')
    .select('*')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .order('name', { ascending: true });
  if (error) throw mapDbError(error);
  return (data as VarRow[]).map(rowToVariant);
}

/**
 * Inserts or updates a variant. When a price is provided the running mean is
 * updated atomically using `price_sum_inr` / `price_count` columns so the
 * average is a true mean of observations (not the previous midpoint hack).
 */
export async function upsertVariant(
  brandId: string,
  name: string,
  defaultPackSize: number,
  priceInr: number | null,
): Promise<BrandVariant> {
  parseOrThrow(IdSchema, brandId, 'brand_id');
  const validated = parseOrThrow(
    BrandVariantSchema,
    { name, defaultPackSize, avgPriceInr: priceInr },
    'brand_variant',
  );
  const supabase = getSupabase();
  const userId = await requireUserId();

  const { data: existing, error: fetchErr } = await supabase
    .from('brand_variants')
    .select('*')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('name', validated.name)
    .maybeSingle();
  if (fetchErr) throw mapDbError(fetchErr);

  const now = new Date().toISOString();
  if (existing) {
    const ex = existing as VarRow;
    const prevSum = Number(ex.price_sum_inr ?? 0);
    const prevCount = Number(ex.price_count ?? 0);
    const nextSum = priceInr != null ? prevSum + priceInr : prevSum;
    const nextCount = priceInr != null ? prevCount + 1 : prevCount;
    const nextAvg = nextCount > 0 ? nextSum / nextCount : ex.avg_price_inr;
    const { data, error } = await supabase
      .from('brand_variants')
      .update({
        default_pack_size: validated.defaultPackSize,
        last_price_inr: priceInr ?? ex.last_price_inr,
        last_priced_at: priceInr != null ? now : ex.last_priced_at,
        avg_price_inr: nextAvg,
        price_sum_inr: nextSum,
        price_count: nextCount,
      })
      .eq('id', ex.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw mapDbError(error);
    return rowToVariant(data as VarRow);
  }

  const id = makeId('var');
  const { data, error } = await supabase
    .from('brand_variants')
    .insert({
      id,
      user_id: userId,
      brand_id: brandId,
      name: validated.name,
      default_pack_size: validated.defaultPackSize,
      avg_price_inr: priceInr,
      last_price_inr: priceInr,
      last_priced_at: priceInr != null ? now : null,
      price_sum_inr: priceInr ?? 0,
      price_count: priceInr != null ? 1 : 0,
    })
    .select('*')
    .single();
  if (error) throw mapDbError(error);
  return rowToVariant(data as VarRow);
}

export async function deleteBrand(id: string): Promise<void> {
  parseOrThrow(IdSchema, id, 'brand_id');
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase.from('brands').delete().eq('user_id', userId).eq('id', id);
  if (error) {
    // M7 audit: brand_variants.brand_id is ON DELETE RESTRICT, so a brand
    // with active variants raises Postgres 23503 (foreign_key_violation).
    // The generic mapDbError would label that `validation_error`, which is
    // misleading for a delete-on-parent case. Surface a `conflict` instead so
    // the UI can prompt the user to delete the variants first.
    if ((error as { code?: string }).code === '23503') {
      throw new AppError(
        'conflict',
        'brand_has_variants: delete the brand variants first, or merge the brand into another.',
        error,
      );
    }
    throw mapDbError(error);
  }
}

/**
 * Single round-trip fetch of brands + variants. Avoids the previous per-brand
 * N+1 loop and instead joins client-side once both tables are pulled.
 */
export async function listBrandsWithVariants(): Promise<(Brand & { variants: BrandVariant[] })[]> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const [brandsRes, variantsRes] = await Promise.all([
    supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('brand_variants')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
  ]);
  if (brandsRes.error) throw mapDbError(brandsRes.error);
  if (variantsRes.error) throw mapDbError(variantsRes.error);

  const byBrand = new Map<string, BrandVariant[]>();
  for (const v of (variantsRes.data as VarRow[]) ?? []) {
    const list = byBrand.get(v.brand_id) ?? [];
    list.push(rowToVariant(v));
    byBrand.set(v.brand_id, list);
  }
  return ((brandsRes.data as BrandRow[]) ?? []).map((b) => ({
    ...rowToBrand(b),
    variants: byBrand.get(b.id) ?? [],
  }));
}
