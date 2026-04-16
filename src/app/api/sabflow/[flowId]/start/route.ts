/**
 * SabFlow — Start a new chat session
 *
 * POST /api/sabflow/[flowId]/start
 *
 * Fetches the published flow, seeds a new FlowSession via the pure engine,
 * persists the session with a 24-hour TTL, and returns the opening messages
 * plus the first pending input (if any).
 *
 * Response:
 *   { sessionId, messages: ChatMessage[], pendingInput: ExecutionStep | null }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSabFlowById, createSession } from '@/lib/sabflow/db';
import { startSession, processInput } from '@/lib/sabflow/execution/engine';
import type { ChatMessage, ExecutionStep } from '@/lib/sabflow/execution/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ flowId: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { flowId } = await params;

  // ── Fetch + validate the flow ──────────────────────────────────────────
  let flow;
  try {
    flow = await getSabFlowById(flowId);
  } catch (err) {
    console.error('[SABFLOW START] DB error fetching flow:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  if (flow.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'Flow is not published' }, { status: 404 });
  }

  // ── Bootstrap a session using the pure engine ──────────────────────────
  try {
    const session = startSession(flow);

    // Run one step with an empty input so bubble blocks before the first
    // input prompt are collected and the first pendingInput is resolved.
    const { session: advancedSession, nextSteps } = processInput(session, flow, '');

    // Collect only host messages (guest echo of the empty seed input is skipped)
    const messages: ChatMessage[] = advancedSession.messages.filter(
      (m) => m.role === 'host',
    );

    // The last step of type 'input' is what the client must respond to
    const pendingInput: ExecutionStep | null =
      nextSteps.findLast((s) => s.type === 'input') ?? null;

    // Persist the session
    await createSession(advancedSession);

    return NextResponse.json(
      { sessionId: advancedSession.id, messages, pendingInput },
      { status: 201 },
    );
  } catch (err) {
    console.error('[SABFLOW START] Engine/persist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
