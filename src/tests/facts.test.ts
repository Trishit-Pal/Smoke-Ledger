import { getSupabase } from '@/lib/supabase';
import { SMOKING_FACTS, pickRandomFacts } from '@/constants/facts';
import { bundledFacts, fetchRandomFacts } from '@/db/repositories/facts';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const mockGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

describe('bundledFacts', () => {
  it('returns a non-empty array where every item has required fields', () => {
    const facts = bundledFacts();
    expect(Array.isArray(facts)).toBe(true);
    expect(facts.length).toBeGreaterThan(0);
    for (const f of facts) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.headline).toBe('string');
      expect(typeof f.body).toBe('string');
      expect(typeof f.source).toBe('string');
      expect(typeof f.category).toBe('string');
    }
  });
});

describe('pickRandomFacts', () => {
  it('returns exactly 3 items, all with required fields', () => {
    const result = pickRandomFacts(3);
    expect(result).toHaveLength(3);
    for (const f of result) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.headline).toBe('string');
      expect(typeof f.body).toBe('string');
      expect(typeof f.source).toBe('string');
      expect(typeof f.category).toBe('string');
    }
  });

  it('clamps to dataset length when n exceeds it', () => {
    const result = pickRandomFacts(100);
    expect(result.length).toBeLessThanOrEqual(SMOKING_FACTS.length);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns 3 items even when seenIds set is provided', () => {
    const result = pickRandomFacts(3, new Set(['fact_who_8m', 'fact_gats_india']));
    expect(result).toHaveLength(3);
  });

  it('returns at least 1 when n=1', () => {
    expect(pickRandomFacts(1)).toHaveLength(1);
  });
});

describe('fetchRandomFacts — offline fallback', () => {
  beforeEach(() => { jest.resetAllMocks(); });

  it('falls back when getSupabase throws', async () => {
    mockGetSupabase.mockImplementation(() => { throw new Error('net'); });
    const result = await fetchRandomFacts(3);
    expect(result).toHaveLength(3);
    for (const f of result) expect(typeof f.id).toBe('string');
  });

  it('falls back when the RPC rejects', async () => {
    mockGetSupabase.mockReturnValue({ rpc: () => Promise.reject(new Error('net')) } as any);
    const result = await fetchRandomFacts(3);
    expect(result).toHaveLength(3);
  });

  it('falls back when RPC returns an error object', async () => {
    mockGetSupabase.mockReturnValue({
      rpc: () => Promise.resolve({ data: null, error: { message: 'rpc error' } }),
    } as any);
    const result = await fetchRandomFacts(3);
    expect(result).toHaveLength(3);
  });

  it('falls back when RPC returns an empty array', async () => {
    mockGetSupabase.mockReturnValue({
      rpc: () => Promise.resolve({ data: [], error: null }),
    } as any);
    const result = await fetchRandomFacts(3);
    expect(result).toHaveLength(3);
  });
});
