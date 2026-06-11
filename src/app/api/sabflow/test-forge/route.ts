/**
 * SabFlow — single-node test runner for forge/preset blocks.
 *
 * POST /api/sabflow/test-forge
 *
 * Body:
 *   {
 *     block: { id, type, options },   // a `forge_*` block as stored in the flow
 *     variables?: Record<string, string>,
 *     inputData?: unknown,            // exposed as $json via a synthetic upstream output
 *   }
 *
 * The editor's "Test this node" panel runs most blocks in-browser via
 * `testNode()`, but forge blocks' `run()` implementations are server-only
 * (credential decryption, helpers, app-preset dispatch). This route executes
 * exactly the engine's forge path (`runForgeBlockOnce` → `executeForgeBlock`)
 * under the caller's session, so test behaviour matches production runs.
 *
 * Authentication via the `session` cookie; the block's `credentialId` is
 * resolved inside the engine, which enforces workspace scoping itself.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
// Side-effect import: registers every forge block in the in-memory registry.
import '@/lib/sabflow/forge';
import { runForgeBlockOnce } from '@/lib/sabflow/engine/executeBlock';
import type { Block } from '@/lib/sabflow/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const userId =
    (session.user as { _id?: string | { toString(): string }; id?: string })._id ??
    (session.user as { id?: string }).id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    block?: { id?: string; type?: string; options?: Record<string, unknown> };
    variables?: Record<string, string>;
    inputData?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const block = body.block;
  if (!block?.type || !String(block.type).startsWith('forge_')) {
    return NextResponse.json(
      { error: '`block.type` must be a forge_* block type' },
      { status: 400 },
    );
  }

  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.variables ?? {})) {
    variables[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  // Surface `inputData` the way the engine does for an upstream node: a
  // synthetic node output keyed by a reserved name, so `$json` /
  // `{{$prev}}`-style expressions resolve against it.
  const nodeOutputs: Record<string, unknown> = {};
  if (body.inputData !== undefined) {
    nodeOutputs.__testInput = body.inputData;
  }

  const startedAt = Date.now();
  try {
    const result = await runForgeBlockOnce(
      {
        id: block.id ?? 'test-node',
        type: block.type,
        options: block.options ?? {},
      } as Block,
      variables,
      { nodeOutputs, userId },
    );

    const durationMs = Date.now() - startedAt;
    if (result.errorSignal) {
      return NextResponse.json({
        ok: false,
        durationMs,
        error:
          result.errorSignal.kind === 'halt'
            ? result.errorSignal.message
            : `error routed to group ${result.errorSignal.groupId}`,
        messages: result.messages,
      });
    }

    return NextResponse.json({
      ok: true,
      durationMs,
      output: result.forgeOutputs ?? null,
      items: result.forgeItems ?? null,
      updatedVariables: result.updatedVariables ?? {},
      messages: result.messages,
    });
  } catch (err) {
    console.error('[SABFLOW TEST-FORGE]', block.type, err);
    return NextResponse.json({
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
