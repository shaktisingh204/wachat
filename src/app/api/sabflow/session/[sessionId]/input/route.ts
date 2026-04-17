/**
 * SabFlow — Submit user input for an active session
 *
 * POST /api/sabflow/session/[sessionId]/input
 * Body: { input: string | string[] | number }
 *
 * Advances the flow from the current position, persists the updated session,
 * and — on completion — saves a submission record.
 *
 * Response:
 *   {
 *     messages: ChatMessage[],
 *     pendingInput: ExecutionStep | null,
 *     isComplete: boolean,
 *     variables: Record<string, unknown>
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  getSession,
  getSabFlowById,
  updateSession,
  saveSubmission,
} from '@/lib/sabflow/db';
import { processInput } from '@/lib/sabflow/execution/engine';
import type { ChatMessage, ExecutionStep } from '@/lib/sabflow/execution/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params;

  // ── Parse + validate request body ─────────────────────────────────────
  let body: { input?: string | string[] | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { input } = body;

  if (input === undefined || input === null) {
    return NextResponse.json({ error: '`input` is required' }, { status: 400 });
  }

  // Normalise to string for the engine (arrays become comma-separated)
  const inputStr = Array.isArray(input)
    ? input.join(', ')
    : String(input);

  // ── Fetch session ──────────────────────────────────────────────────────
  let session;
  try {
    session = await getSession(sessionId);
  } catch (err) {
    console.error('[SABFLOW INPUT] DB error fetching session:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  if (session.status !== 'active') {
    return NextResponse.json(
      { error: 'Session is already completed or abandoned' },
      { status: 409 },
    );
  }

  // ── Fetch the flow ─────────────────────────────────────────────────────
  let flow;
  try {
    flow = await getSabFlowById(session.flowId);
  } catch (err) {
    console.error('[SABFLOW INPUT] DB error fetching flow:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!flow) {
    return NextResponse.json({ error: 'Associated flow not found' }, { status: 404 });
  }

  // ── Advance the engine ─────────────────────────────────────────────────
  try {
    const { session: updatedSession, nextSteps } = await processInput(
      session,
      flow,
      inputStr,
    );

    const isComplete = updatedSession.status === 'completed';

    // Only new host messages (those not already in the pre-existing session)
    const previousMessageIds = new Set(session.messages.map((m) => m.id));
    const newMessages: ChatMessage[] = updatedSession.messages.filter(
      (m) => m.role === 'host' && !previousMessageIds.has(m.id),
    );

    const pendingInput: ExecutionStep | null =
      nextSteps.findLast((s) => s.type === 'input') ?? null;

    // ── Persist updated session ──────────────────────────────────────────
    await updateSession(sessionId, {
      variables: updatedSession.variables,
      currentGroupId: updatedSession.currentGroupId,
      currentBlockIndex: updatedSession.currentBlockIndex,
      status: updatedSession.status,
      updatedAt: updatedSession.updatedAt,
      messages: updatedSession.messages,
    });

    // ── Save submission on completion ────────────────────────────────────
    if (isComplete) {
      await saveSubmission({
        flowId: session.flowId,
        sessionId,
        variables: updatedSession.variables as Record<string, unknown>,
        completedAt: updatedSession.updatedAt,
      });
    }

    return NextResponse.json({
      messages: newMessages,
      pendingInput,
      isComplete,
      variables: updatedSession.variables as Record<string, unknown>,
    });
  } catch (err) {
    console.error('[SABFLOW INPUT] Engine/persist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
