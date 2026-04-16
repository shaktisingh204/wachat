/**
 * SabFlow — Execution engine API
 *
 * POST /api/sabflow/execute
 *   Body: { sessionId: string; input?: string }
 *   Returns: { messages: OutgoingMessage[]; nextInput?: InputRequest; isCompleted: boolean }
 *
 * The engine walks the flow graph from the current position, collecting
 * bubble blocks as outgoing messages, stopping when it hits an input
 * block (which becomes `nextInput`) or runs out of blocks/edges.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type {
  Block,
  Edge,
  Group,
  OutgoingMessage,
  InputRequest,
  SessionState,
  Variable,
} from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';

const COLLECTION = 'sabflow_sessions';

/* ── Variable interpolation ───────────────────────────── */

function interpolate(text: string, vars: Record<string, string>): string {
  // Replace {{variableName}} and {{variableId}} tokens.
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '');
}

/* ── Edge resolution ──────────────────────────────────── */

function findNextGroup(
  edges: Edge[],
  fromGroupId: string,
  fromBlockId?: string,
  fromItemId?: string,
): string | null {
  // Most specific match first: item → block → group
  const edge =
    edges.find(
      (e) =>
        e.from.groupId === fromGroupId &&
        e.from.blockId === fromBlockId &&
        fromItemId !== undefined &&
        e.from.itemId === fromItemId,
    ) ??
    edges.find(
      (e) =>
        e.from.groupId === fromGroupId &&
        e.from.blockId === fromBlockId &&
        !e.from.itemId,
    ) ??
    edges.find(
      (e) => e.from.groupId === fromGroupId && !e.from.blockId,
    );

  return edge?.to.groupId ?? null;
}

/* ── Condition evaluation ─────────────────────────────── */

function evaluateCondition(
  block: Block,
  vars: Record<string, string>,
  edges: Edge[],
): string | null {
  const comparisons: any[] = (block.options as any)?.comparisons ?? [];
  // Walk comparisons; return the first matching outgoing edge's target group.
  for (const cmp of comparisons) {
    const left = vars[cmp.variableId] ?? '';
    const right = interpolate(cmp.value ?? '', vars);
    let match = false;
    switch (cmp.comparisonOperator) {
      case 'Equal':        match = left === right; break;
      case 'NotEqual':     match = left !== right; break;
      case 'Contains':     match = left.includes(right); break;
      case 'NotContains':  match = !left.includes(right); break;
      case 'StartsWith':   match = left.startsWith(right); break;
      case 'EndsWith':     match = left.endsWith(right); break;
      case 'IsEmpty':      match = left === ''; break;
      case 'IsNotEmpty':   match = left !== ''; break;
      case 'GreaterThan':  match = parseFloat(left) > parseFloat(right); break;
      case 'LessThan':     match = parseFloat(left) < parseFloat(right); break;
      default:             match = false;
    }
    if (match) {
      // Each comparison item has its own outgoing edge keyed by itemId.
      const target = edges.find(
        (e) =>
          e.from.groupId === block.groupId &&
          e.from.blockId === block.id &&
          e.from.itemId === cmp.id,
      );
      if (target) return target.to.groupId;
    }
  }
  // Fallback: default (no-match) edge from block
  return findNextGroup(edges, block.groupId, block.id);
}

/* ── A/B test ─────────────────────────────────────────── */

function pickAbTestBranch(block: Block, edges: Edge[]): string | null {
  const aPercent: number = (block.options as any)?.aPercent ?? 50;
  const roll = Math.random() * 100;
  const branch = roll < aPercent ? 'a' : 'b';
  const item = block.items?.find((i) => i.id === branch);
  if (item) {
    const edge = edges.find(
      (e) =>
        e.from.groupId === block.groupId &&
        e.from.blockId === block.id &&
        e.from.itemId === item.id,
    );
    if (edge) return edge.to.groupId;
  }
  return null;
}

/* ── Core stepper ─────────────────────────────────────── */

interface StepResult {
  messages: OutgoingMessage[];
  nextInput: InputRequest | undefined;
  isCompleted: boolean;
  /** Updated session cursor */
  nextGroupId: string | null;
  nextBlockIndex: number;
  updatedVars: Record<string, string>;
}

function stepFlow(
  groups: Group[],
  edges: Edge[],
  vars: Record<string, string>,
  startGroupId: string,
  startBlockIndex: number,
  userInput?: string,
  /** Variable schema for name→id lookup */
  variableSchema: Variable[] = [],
): StepResult {
  const messages: OutgoingMessage[] = [];
  let vars_ = { ...vars };
  let gId: string | null = startGroupId;
  let bIdx = startBlockIndex;

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const nameToId = new Map(variableSchema.map((v) => [v.name, v.id]));

  // Safety: cap iterations to avoid infinite loops on malformed graphs.
  const MAX_STEPS = 200;
  let steps = 0;

  while (gId && steps < MAX_STEPS) {
    steps++;
    const group = groupMap.get(gId);
    if (!group || bIdx >= group.blocks.length) {
      // Move to next group via group-level edge.
      const next = findNextGroup(edges, gId);
      gId = next;
      bIdx = 0;
      continue;
    }

    const block = group.blocks[bIdx];

    // ── Bubble blocks → collect as outgoing messages ──────
    if (['text', 'image', 'video', 'audio', 'embed'].includes(block.type)) {
      const opts = block.options as any ?? {};
      switch (block.type) {
        case 'text':
          messages.push({ type: 'text', content: interpolate(opts.content ?? '', vars_) });
          break;
        case 'image':
          messages.push({ type: 'image', url: interpolate(opts.url ?? '', vars_), alt: opts.alt });
          break;
        case 'video':
          messages.push({ type: 'video', url: interpolate(opts.url ?? '', vars_) });
          break;
        case 'audio':
          messages.push({ type: 'audio', url: interpolate(opts.url ?? '', vars_) });
          break;
        case 'embed':
          messages.push({ type: 'embed', url: interpolate(opts.url ?? '', vars_) });
          break;
      }
      bIdx++;
      continue;
    }

    // ── Input blocks → pause and request user input ───────
    if (
      [
        'text_input', 'number_input', 'email_input', 'phone_input', 'url_input',
        'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input',
        'choice_input', 'picture_choice_input',
      ].includes(block.type)
    ) {
      const opts = block.options as any ?? {};

      // If we already have user input and this is the block we paused on, store it.
      if (userInput !== undefined && startBlockIndex === bIdx) {
        const varId =
          opts.variableId ??
          (opts.variableName ? nameToId.get(opts.variableName) : undefined);
        if (varId) vars_[varId] = userInput;

        // For choice inputs, also store the selected item label.
        if (block.type === 'choice_input' || block.type === 'picture_choice_input') {
          const chosen = block.items?.find(
            (it) => it.id === userInput || it.content === userInput,
          );
          if (chosen && varId) vars_[varId] = chosen.content ?? userInput;

          // Route via item-specific edge if present.
          if (chosen) {
            const edge = edges.find(
              (e) =>
                e.from.groupId === block.groupId &&
                e.from.blockId === block.id &&
                e.from.itemId === chosen.id,
            );
            if (edge) {
              gId = edge.to.groupId;
              bIdx = 0;
              continue;
            }
          }
        }

        bIdx++;
        continue;
      }

      // No input yet — emit the request and pause.
      const choices =
        block.type === 'choice_input' || block.type === 'picture_choice_input'
          ? block.items?.map((it) => ({
              id: it.id,
              label: it.content ?? it.id,
              imageUrl: (it as any).imageUrl,
            }))
          : undefined;

      const varSchema = variableSchema.find((v) => v.id === opts.variableId);

      return {
        messages,
        nextInput: {
          blockId: block.id,
          inputType: block.type as any,
          variableName: varSchema?.name ?? opts.variableName,
          choices,
          validation: opts.validation,
        },
        isCompleted: false,
        nextGroupId: gId,
        nextBlockIndex: bIdx,
        updatedVars: vars_,
      };
    }

    // ── Logic blocks ──────────────────────────────────────
    switch (block.type) {
      case 'set_variable': {
        const opts = block.options as any ?? {};
        const varId =
          opts.variableId ??
          (opts.variableName ? nameToId.get(opts.variableName) : undefined);
        if (varId) vars_[varId] = interpolate(opts.expressionToEvaluate ?? opts.value ?? '', vars_);
        bIdx++;
        continue;
      }

      case 'condition': {
        const nextGId = evaluateCondition(block, vars_, edges);
        gId = nextGId;
        bIdx = 0;
        continue;
      }

      case 'ab_test': {
        const nextGId = pickAbTestBranch(block, edges);
        gId = nextGId;
        bIdx = 0;
        continue;
      }

      case 'jump': {
        const opts = block.options as any ?? {};
        gId = opts.groupId ?? findNextGroup(edges, block.groupId, block.id);
        bIdx = 0;
        continue;
      }

      case 'redirect': {
        const opts = block.options as any ?? {};
        const url = interpolate(opts.url ?? '', vars_);
        messages.push({ type: 'text', content: `__redirect__:${url}` });
        return { messages, nextInput: undefined, isCompleted: true, nextGroupId: null, nextBlockIndex: 0, updatedVars: vars_ };
      }

      case 'wait': {
        // Emit a synthetic pause message; client handles display.
        const opts = block.options as any ?? {};
        messages.push({ type: 'text', content: `__wait__:${opts.secondsToWaitFor ?? 0}` });
        bIdx++;
        continue;
      }

      // typebot_link, script, and unsupported logic blocks — skip and advance.
      default:
        bIdx++;
        continue;
    }
  }

  // Reached the end of the graph or hit the safety cap.
  return {
    messages,
    nextInput: undefined,
    isCompleted: true,
    nextGroupId: null,
    nextBlockIndex: 0,
    updatedVars: vars_,
  };
}

/* ── POST handler ─────────────────────────────────────── */

export async function POST(request: NextRequest) {
  let body: { sessionId?: string; input?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, input } = body;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: '`sessionId` is required' }, { status: 400 });
  }

  if (!ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(sessionId) }) as any;

    if (!doc) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (doc.isCompleted) {
      return NextResponse.json({
        messages: [],
        nextInput: undefined,
        isCompleted: true,
      });
    }

    if (!doc.currentGroupId) {
      return NextResponse.json({ error: 'Session has no valid start position' }, { status: 422 });
    }

    const snapshot = doc._flowSnapshot as {
      groups: Group[];
      edges: Edge[];
      variables: Variable[];
    };

    if (!snapshot) {
      return NextResponse.json({ error: 'Flow snapshot missing from session' }, { status: 422 });
    }

    const result = stepFlow(
      snapshot.groups,
      snapshot.edges,
      doc.variables as Record<string, string>,
      doc.currentGroupId,
      doc.currentBlockIndex ?? 0,
      input,
      snapshot.variables,
    );

    const now = new Date().toISOString();

    await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          variables: result.updatedVars,
          currentGroupId: result.nextGroupId,
          currentBlockIndex: result.nextBlockIndex,
          isCompleted: result.isCompleted,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({
      messages: result.messages,
      ...(result.nextInput ? { nextInput: result.nextInput } : {}),
      isCompleted: result.isCompleted,
    });
  } catch (err: any) {
    console.error('[SABFLOW EXECUTE] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
