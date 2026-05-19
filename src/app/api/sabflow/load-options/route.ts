/**
 * SabFlow — Forge LoadOptions resolver
 *
 * POST /api/sabflow/load-options
 *
 * Body:
 *   {
 *     blockId: string,
 *     fieldId: string,
 *     actionId?: string,        // for multi-action blocks
 *     credentialId?: string,    // resolves to ctx.credential
 *     options: Record<string, unknown>,  // current field-values snapshot
 *   }
 *
 * Resolves the field's server-side `loadOptions` resolver against the
 * authenticated user's credential (when supplied) and returns the produced
 * dropdown options.
 *
 * Authentication is enforced via the `session` cookie. When a `credentialId`
 * is supplied, the credential's `workspaceId` MUST match the resolved user
 * id (multi-tenant isolation).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
// Side-effect import: registers every forge block in the in-memory registry.
import '@/lib/sabflow/forge';
import { getForgeBlock } from '@/lib/sabflow/forge/registry';
import { buildLoadOptionsContext } from './buildContext';
import type {
  ForgeField,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── Auth helper (lifted from credentials/route.ts) ─────────────────────── */

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const userId =
    (session.user as { _id?: string | { toString(): string }; id?: string })._id ??
    (session.user as { id?: string }).id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

/* ── Body parsing ───────────────────────────────────────────────────────── */

type LoadOptionsBody = {
  blockId: string;
  fieldId: string;
  actionId?: string;
  credentialId?: string;
  options: Record<string, unknown>;
};

function parseBody(raw: unknown): LoadOptionsBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.blockId !== 'string' || !r.blockId) return null;
  if (typeof r.fieldId !== 'string' || !r.fieldId) return null;
  const actionId = typeof r.actionId === 'string' && r.actionId ? r.actionId : undefined;
  const credentialId =
    typeof r.credentialId === 'string' && r.credentialId ? r.credentialId : undefined;
  const options =
    r.options && typeof r.options === 'object' && !Array.isArray(r.options)
      ? (r.options as Record<string, unknown>)
      : {};
  return { blockId: r.blockId, fieldId: r.fieldId, actionId, credentialId, options };
}

/** Find a field on the block, scoped to an action when one is provided. */
function findField(
  blockId: string,
  fieldId: string,
  actionId: string | undefined,
): ForgeField | undefined {
  const block = getForgeBlock(blockId);
  if (!block) return undefined;

  if (actionId) {
    const action = block.actions?.find((a) => a.id === actionId);
    return action?.fields.find((f) => f.id === fieldId);
  }
  return block.fields?.find((f) => f.id === fieldId);
}

/* ── POST ───────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: 'Body must include blockId, fieldId and an options object' },
      { status: 400 },
    );
  }

  const block = getForgeBlock(body.blockId);
  if (!block) {
    return NextResponse.json(
      { error: `Block not found: ${body.blockId}` },
      { status: 404 },
    );
  }

  const field = findField(body.blockId, body.fieldId, body.actionId);
  if (!field) {
    return NextResponse.json(
      { error: `Field not found: ${body.blockId}.${body.actionId ?? '*'}.${body.fieldId}` },
      { status: 404 },
    );
  }

  if (typeof field.loadOptions !== 'function') {
    return NextResponse.json(
      { error: 'Field does not declare loadOptions' },
      { status: 400 },
    );
  }

  // Resolve credential (when supplied + owned by this user).
  let credential: Record<string, string> | undefined;
  if (body.credentialId) {
    const cred = await getCredentialById(body.credentialId);
    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    if (cred.workspaceId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    credential = cred.data;
  }

  const ctx = buildLoadOptionsContext({
    block,
    actionId: body.actionId,
    options: body.options,
    credential,
  });

  try {
    const options: ForgeSelectOption[] = await field.loadOptions(ctx);
    return NextResponse.json({ options: Array.isArray(options) ? options : [] });
  } catch (err) {
    console.error('[SABFLOW LOAD-OPTIONS] resolver error:', err);
    const message = err instanceof Error ? err.message : 'Resolver failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
