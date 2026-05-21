import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@web/lib/supabase/admin';

const bodySchema = z.object({
  email: z.string().email().max(320),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const LOOKUP_MAX_PAGES = 5;
const LOOKUP_PAGE_SIZE = 200;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

async function findUserByEmail(admin: NonNullable<ReturnType<typeof createAdminClient>>, email: string): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceKey) {
    const filter = `email.eq."${email.replace(/"/g, '')}"`;
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?${new URLSearchParams({ filter, per_page: '1' })}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        cache: 'no-store',
      },
    );
    if (res.ok) {
      const body = (await res.json()) as { users?: User[] };
      const match = body.users?.find((candidate) => candidate.email?.toLowerCase() === email);
      if (match) return match;
    }
  }

  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LOOKUP_PAGE_SIZE });
    if (error) throw error;
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < LOOKUP_PAGE_SIZE) return null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation_error' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await findUserByEmail(admin, email);

    if (!user) {
      return NextResponse.json({ status: 'not_found' });
    }

    if (user.email && !user.email_confirmed_at && !user.phone_confirmed_at) {
      return NextResponse.json({ status: 'unconfirmed' });
    }

    return NextResponse.json({ status: 'exists' });
  } catch (e) {
    console.error('[login-hint] lookup failed', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
