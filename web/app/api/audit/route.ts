import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@web/lib/supabase/server';

const auditBodySchema = z.object({
  eventType: z.string().min(1).max(80),
  eventCategory: z
    .enum(['account', 'compliance', 'auth', 'privacy', 'preferences'])
    .default('account'),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

function isEdgeAuditSuccess(status: number, body: string): boolean {
  if (status === 204) return true;
  if (status !== 200) return false;
  const trimmed = body.trim();
  if (!trimmed) return true;
  try {
    const parsed = JSON.parse(trimmed) as { error?: string };
    return !parsed.error;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const parsed = auditBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation_error' }, { status: 400 });
    }

    const supabase = createClient();
    const [{ data: userData, error: userErr }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }

    const { eventType, eventCategory, props } = parsed.data;
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/audit-record`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        event_category: eventCategory,
        props: props ?? {},
      }),
    });

    const edgeBody = edgeRes.status === 204 ? '' : (await edgeRes.text()).slice(0, 200);

    if (isEdgeAuditSuccess(edgeRes.status, edgeBody)) {
      return new NextResponse(null, { status: 204 });
    }

    if (edgeRes.status !== 204) {
      console.error('[api/audit] edge failed', edgeRes.status, edgeBody);
    }

    if (edgeRes.status === 429) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    if (edgeRes.status === 401) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (edgeRes.status >= 400 && edgeRes.status < 500) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'dependency_failure' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
