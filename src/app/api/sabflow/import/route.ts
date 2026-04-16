/**
 * POST /api/sabflow/import
 *
 * Imports a SabFlow JSON export as a brand-new draft flow owned by
 * the currently authenticated user.
 *
 * Body: { flow: SabFlowDoc, workspaceId?: string }
 * Response: { flowId: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import type { SabFlowDoc, Group, Edge, SabFlowEvent, Variable } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';

/* ── Type for the raw import payload (IDs may or may not be present) ─────── */
type ImportPayload = {
  flow: Partial<SabFlowDoc> & {
    groups?: Group[];
    edges?: Edge[];
    events?: SabFlowEvent[];
    variables?: Variable[];
  };
  workspaceId?: string;
};

/* ── Remap all IDs inside the flow so nothing collides ───────────────────── */
function remapIds(flow: ImportPayload['flow']): Omit<SabFlowDoc, '_id' | 'userId' | 'createdAt' | 'updatedAt'> {
  // Build a mapping of old-id → new-id for every entity that has an `id` field.
  const idMap = new Map<string, string>();

  const newId = (old: string | undefined): string => {
    if (!old) return createId();
    if (!idMap.has(old)) idMap.set(old, createId());
    return idMap.get(old)!;
  };

  /* ── Events ─────────────────────────────────────────────────────────── */
  const events: SabFlowEvent[] = (flow.events ?? []).map((ev) => ({
    ...ev,
    id: newId(ev.id),
    outgoingEdgeId: ev.outgoingEdgeId ? newId(ev.outgoingEdgeId) : undefined,
  }));

  /* ── Groups + blocks + items ─────────────────────────────────────────── */
  const groups: Group[] = (flow.groups ?? []).map((g) => ({
    ...g,
    id: newId(g.id),
    blocks: (g.blocks ?? []).map((b) => ({
      ...b,
      id: newId(b.id),
      groupId: newId(b.groupId),
      outgoingEdgeId: b.outgoingEdgeId ? newId(b.outgoingEdgeId) : undefined,
      items: (b.items ?? []).map((item) => ({
        ...item,
        id: newId(item.id),
        blockId: item.blockId ? newId(item.blockId) : undefined,
        outgoingEdgeId: item.outgoingEdgeId ? newId(item.outgoingEdgeId) : undefined,
      })),
    })),
  }));

  /* ── Edges ───────────────────────────────────────────────────────────── */
  const edges: Edge[] = (flow.edges ?? []).map((e) => {
    const from = { ...e.from } as Edge['from'];

    if ('eventId' in from && from.eventId) {
      (from as { eventId: string }).eventId = newId(from.eventId);
    }
    if ('groupId' in from && from.groupId) {
      (from as { groupId: string }).groupId = newId(from.groupId);
    }
    if ('blockId' in from && (from as { blockId?: string }).blockId) {
      (from as { blockId: string }).blockId = newId((from as { blockId: string }).blockId);
    }
    if ('itemId' in from && (from as { itemId?: string }).itemId) {
      (from as { itemId: string }).itemId = newId((from as { itemId: string }).itemId);
    }

    return {
      ...e,
      id: newId(e.id),
      from,
      to: {
        groupId: newId(e.to.groupId),
        blockId: e.to.blockId ? newId(e.to.blockId) : undefined,
      },
    };
  });

  /* ── Variables (just new IDs, keep names/values) ─────────────────────── */
  const variables: Variable[] = (flow.variables ?? []).map((v) => ({
    ...v,
    id: newId(v.id),
  }));

  return {
    name: flow.name ?? 'Imported flow',
    events,
    groups,
    edges,
    variables,
    theme: flow.theme ?? {},
    settings: flow.settings ?? {},
    status: 'DRAFT',
    publicId: undefined,
  };
}

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  /* ── Parse body ──────────────────────────────────────────────────────── */
  let body: ImportPayload;
  try {
    body = (await request.json()) as ImportPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { flow: rawFlow } = body;

  /* ── Validate required top-level arrays ──────────────────────────────── */
  if (!rawFlow || typeof rawFlow !== 'object') {
    return NextResponse.json({ error: '`flow` object is required' }, { status: 422 });
  }
  if (!Array.isArray(rawFlow.groups)) {
    return NextResponse.json({ error: '`flow.groups` must be an array' }, { status: 422 });
  }
  if (!Array.isArray(rawFlow.edges)) {
    return NextResponse.json({ error: '`flow.edges` must be an array' }, { status: 422 });
  }
  if (!Array.isArray(rawFlow.events)) {
    return NextResponse.json({ error: '`flow.events` must be an array' }, { status: 422 });
  }

  try {
    /* ── Remap IDs and build the new document ────────────────────────────── */
    const remapped = remapIds(rawFlow);

    const now = new Date();
    const newDoc: Omit<SabFlowDoc, '_id'> = {
      ...remapped,
      userId: session.user._id.toString(),
      createdAt: now,
      updatedAt: now,
    };

    const col = await getSabFlowCollection();
    const result = await col.insertOne(newDoc as SabFlowDoc);

    return NextResponse.json({ flowId: result.insertedId.toString() }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW IMPORT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
