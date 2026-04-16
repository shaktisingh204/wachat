/**
 * SabFlow — Session management API
 *
 * POST /api/sabflow/session  → create a new execution session for a flow
 * GET  /api/sabflow/session?sessionId=<id>  → fetch current session state
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { ObjectId } from 'mongodb';
import type { SessionState, Variable } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';

const COLLECTION = 'sabflow_sessions';

/* ── helpers ──────────────────────────────────────────── */

function buildInitialVariables(
  schemaVars: Variable[],
  overrides: Record<string, string> = {},
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of schemaVars) {
    map[v.id] = overrides[v.name] ?? overrides[v.id] ?? v.value ?? '';
  }
  return map;
}

/* ── POST — create session ────────────────────────────── */

export async function POST(request: NextRequest) {
  let body: { flowId?: string; variables?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { flowId, variables: initialVars = {} } = body;

  if (!flowId || typeof flowId !== 'string') {
    return NextResponse.json({ error: '`flowId` is required' }, { status: 400 });
  }

  if (!ObjectId.isValid(flowId)) {
    return NextResponse.json({ error: 'Invalid flowId' }, { status: 400 });
  }

  try {
    const flows = await getSabFlowCollection();
    const flow = await flows.findOne({ _id: new ObjectId(flowId) });

    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    if (flow.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Flow is not published' }, { status: 422 });
    }

    // Resolve the start group — the first group in the array is the entry point.
    const startGroup = flow.groups[0] ?? null;

    const now = new Date().toISOString();
    const sessionId = new ObjectId().toHexString();

    const session: SessionState = {
      sessionId,
      flowId,
      variables: buildInitialVariables(flow.variables, initialVars),
      currentGroupId: startGroup?.id ?? null,
      currentBlockIndex: 0,
      isCompleted: !startGroup,
      createdAt: now,
      updatedAt: now,
    };

    const { db } = await connectToDatabase();
    await db.collection(COLLECTION).insertOne({
      _id: new ObjectId(sessionId),
      ...session,
      // Store the full flow snapshot so execution is self-contained.
      _flowSnapshot: {
        groups: flow.groups,
        edges: flow.edges,
        variables: flow.variables,
      },
    });

    return NextResponse.json({ sessionId, session }, { status: 201 });
  } catch (err: any) {
    console.error('[SABFLOW SESSION] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── GET — fetch session ──────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: '`sessionId` query param is required' }, { status: 400 });
  }

  if (!ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne(
      { _id: new ObjectId(sessionId) },
      // Exclude the bulky flow snapshot from the public response.
      { projection: { _flowSnapshot: 0 } },
    );

    if (!doc) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Strip Mongo _id; sessionId is already inside the doc.
    const { _id, ...session } = doc as any;
    return NextResponse.json({ session });
  } catch (err: any) {
    console.error('[SABFLOW SESSION] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
