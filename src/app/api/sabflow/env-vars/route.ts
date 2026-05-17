/**
 * SabFlow workspace env vars.
 *
 *   GET  /api/sabflow/env-vars              — list (secrets blanked)
 *   PUT  /api/sabflow/env-vars              body: { key, value, isSecret? } → upsert
 *   DELETE /api/sabflow/env-vars?key=NAME   — remove a var
 *
 * Secrets are blanked in GET but their value remains accessible to the
 * engine at run time.  Keys must be UPPER_SNAKE_CASE.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteEnvVar,
  listEnvVars,
  upsertEnvVar,
  validateKey,
} from '@/lib/sabflow/envVars/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function GET() {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const vars = await listEnvVars(userId);
    return NextResponse.json({ vars });
  } catch (err) {
    console.error('[SABFLOW ENV-VARS LIST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    key?: string;
    value?: string;
    isSecret?: boolean;
  };
  const key = (body.key ?? '').toString();
  const validationErr = validateKey(key);
  if (validationErr) {
    return NextResponse.json({ error: validationErr }, { status: 400 });
  }
  const value = body.value === undefined ? '' : String(body.value);
  const isSecret = Boolean(body.isSecret);

  try {
    const saved = await upsertEnvVar(userId, key, value, isSecret);
    return NextResponse.json({ var: saved });
  } catch (err) {
    console.error('[SABFLOW ENV-VARS UPSERT]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const key = new URL(req.url).searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing ?key parameter' }, { status: 400 });
  }
  try {
    const ok = await deleteEnvVar(userId, key);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (err) {
    console.error('[SABFLOW ENV-VARS DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
