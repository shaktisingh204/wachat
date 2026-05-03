import type { SabFlowDoc, Group, EdgeFrom, ScriptOptions } from '@/lib/sabflow/types';
import type { FlowSession, ChatMessage, ExecutionStep } from './types';
import { evaluateCondition } from '@/lib/sabflow/engine/evaluateCondition';
import { substituteVariables } from '@/lib/sabflow/engine/substituteVariables';
import type { Condition } from '@/lib/sabflow/engine/evaluateCondition';
import { runScript } from './sandbox';
import type { SandboxContext, SandboxLogEntry } from './sandbox';

// ── helpers ────────────────────────────────────────────────────────────────

function makeId(): string {
  return crypto.randomUUID();
}

/** Convert any sandbox return value to the string shape used by the engine's variable map. */
function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Stringify an arbitrary console argument for human-readable log lines. */
function formatArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Resolve the first group connected from the start event, or the first group. */
function findStartGroup(flow: SabFlowDoc): Group | undefined {
  // Prefer the group connected to the start event via an edge
  const startEvent = flow.events.find((e) => e.type === 'start');
  if (startEvent?.outgoingEdgeId) {
    const edge = flow.edges.find((e) => e.id === startEvent.outgoingEdgeId);
    if (edge?.to.groupId) {
      return flow.groups.find((g) => g.id === edge.to.groupId);
    }
  }
  // Fall back: if an edge has from.eventId === startEvent.id
  if (startEvent) {
    const edge = flow.edges.find(
      (e) => 'eventId' in e.from && e.from.eventId === startEvent.id,
    );
    if (edge?.to.groupId) {
      return flow.groups.find((g) => g.id === edge.to.groupId);
    }
  }
  // Last resort: first group
  return flow.groups[0];
}

// ── startSession ───────────────────────────────────────────────────────────

/** Optional trigger context recorded on session start so the engine + flow can
 *  branch on which trigger (schedule / webhook / form / manual) started the run. */
export type StartSessionOptions = {
  /** ID of the SabFlowEvent that fired the run (for schedule/webhook/etc.). */
  eventId?: string;
  /** Arbitrary trigger payload (e.g. webhook body, form data) seeded as $trigger. */
  triggerData?: unknown;
  /** Pre-seeded variables (override flow defaults). */
  initialVariables?: Record<string, string | undefined>;
};

/**
 * Creates a brand-new FlowSession positioned at the start of the flow.
 * Pure — no DB, no side effects.
 */
export function startSession(
  flow: SabFlowDoc,
  options?: StartSessionOptions,
): FlowSession {
  const startGroup = findStartGroup(flow);

  // Seed variables map from the flow's variable definitions (default values).
  // `defaultValue` takes precedence over the legacy `value` field.
  const variables: Record<string, string | undefined> = {};
  for (const v of flow.variables) {
    const seed = v.defaultValue !== undefined ? String(v.defaultValue) : v.value;
    variables[v.name] = seed;
  }
  // Caller-provided overrides win over flow defaults.
  if (options?.initialVariables) {
    for (const [k, v] of Object.entries(options.initialVariables)) {
      variables[k] = v;
    }
  }
  // Synthetic trigger variable so flows can reference {{$trigger.eventId}}.
  if (options?.eventId) {
    variables.$triggerEventId = options.eventId;
  }
  if (options?.triggerData !== undefined) {
    try {
      variables.$trigger = JSON.stringify(options.triggerData);
    } catch {
      /* ignore non-serialisable payloads */
    }
  }

  const now = new Date();
  return {
    id: makeId(),
    flowId: flow._id?.toString() ?? flow.name,
    variables,
    currentGroupId: startGroup?.id,
    currentBlockIndex: 0,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    messages: [],
  };
}

// ── processInput ───────────────────────────────────────────────────────────

const BUBBLE_TYPES = new Set(['text', 'image', 'video', 'audio', 'embed']);

const INPUT_TYPES = new Set([
  'text_input',
  'number_input',
  'email_input',
  'phone_input',
  'url_input',
  'date_input',
  'time_input',
  'rating_input',
  'file_input',
  'payment_input',
  'choice_input',
  'picture_choice_input',
]);

/**
 * Processes user input against the current session position and advances
 * the flow until the next input request, a redirect, or completion.
 *
 * Nearly pure — no DB writes. Script blocks execute user code inside the
 * sandbox module (which itself is side-effect-free unless fetch is enabled).
 */
export async function processInput(
  session: FlowSession,
  flow: SabFlowDoc,
  input: string,
): Promise<{ session: FlowSession; nextSteps: ExecutionStep[] }> {
  const nextSteps: ExecutionStep[] = [];
  const newMessages: ChatMessage[] = [...session.messages];

  // Append the guest message
  const guestMessage: ChatMessage = {
    id: makeId(),
    role: 'guest',
    content: input,
    timestamp: new Date(),
  };
  newMessages.push(guestMessage);

  // Coerce variables to string map for engine helpers
  let variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(session.variables)) {
    if (v !== undefined) variables[k] = v;
  }

  let currentGroupId = session.currentGroupId;
  let currentBlockIndex = session.currentBlockIndex ?? 0;
  let pendingInput = input; // consumed by the first input block encountered

  // Safety cap on group hops to prevent infinite loops
  const MAX_HOPS = 100;
  let hopCount = 0;

  outer: while (hopCount < MAX_HOPS) {
    const group = flow.groups.find((g) => g.id === currentGroupId);
    if (!group) break;

    for (let i = currentBlockIndex; i < group.blocks.length; i++) {
      const block = group.blocks[i];

      // ── bubble blocks ──────────────────────────────────────────────────
      if (BUBBLE_TYPES.has(block.type)) {
        const rawContent =
          (block.options?.content as string | undefined) ??
          (block.options?.text as string | undefined) ??
          (block.options?.url as string | undefined) ??
          (block.options?.imageUrl as string | undefined) ??
          (block.options?.videoUrl as string | undefined) ??
          (block.options?.audioUrl as string | undefined) ??
          (block.options?.embedUrl as string | undefined) ??
          '';
        const content = substituteVariables(rawContent, variables);

        const hostMsg: ChatMessage = {
          id: makeId(),
          role: 'host',
          content,
          timestamp: new Date(),
          blockId: block.id,
        };
        newMessages.push(hostMsg);

        if (block.type === 'text') {
          // Check for redirect message pattern emitted by redirect blocks
          if (content.startsWith('REDIRECT:')) {
            nextSteps.push({
              type: 'redirect',
              payload: { url: content.slice(9) },
            });
          } else {
            nextSteps.push({
              type: 'message',
              payload: { content, blockId: block.id, messageType: 'text' },
            });
          }
        } else {
          nextSteps.push({
            type: 'message',
            payload: { content, blockId: block.id, messageType: block.type },
          });
        }
        continue;
      }

      // ── input blocks ───────────────────────────────────────────────────
      if (INPUT_TYPES.has(block.type)) {
        if (pendingInput !== undefined) {
          // Consume the pending input into the target variable
          const variableId = block.options?.variableId as string | undefined;
          const variableName = block.options?.variableName as string | undefined;
          const key = variableName ?? variableId;
          if (key) {
            variables = { ...variables, [key]: pendingInput };
            nextSteps.push({
              type: 'variable_set',
              payload: { key, value: pendingInput },
            });
          }
          pendingInput = undefined as unknown as string; // mark consumed
          continue;
        }

        // No pending input — pause here and request input
        nextSteps.push({
          type: 'input',
          payload: {
            blockId: block.id,
            inputType: block.type,
            variableName:
              (block.options?.variableName as string | undefined) ??
              (block.options?.variableId as string | undefined),
            choices: block.items?.map((item) => ({
              id: item.id,
              label: item.content ?? '',
            })),
            validation: block.options?.validation as Record<string, unknown> | undefined,
          },
        });

        return {
          session: {
            ...session,
            variables: { ...variables },
            currentGroupId,
            currentBlockIndex: i,
            status: 'active',
            updatedAt: new Date(),
            messages: newMessages,
          },
          nextSteps,
        };
      }

      // ── logic blocks ───────────────────────────────────────────────────
      if (block.type === 'condition') {
        const items = (block.items ?? []) as Array<{
          id: string;
          content?: Condition;
          outgoingEdgeId?: string;
        }>;

        const passedItem = items.find(
          (item) => item.content && evaluateCondition(item.content, variables),
        );

        nextSteps.push({
          type: 'condition_evaluated',
          payload: {
            blockId: block.id,
            passed: !!passedItem,
            matchedItemId: passedItem?.id,
          },
        });

        const winningEdgeId = passedItem?.outgoingEdgeId ?? block.outgoingEdgeId;
        const nextEdge = flow.edges.find((e) => e.id === winningEdgeId);
        if (nextEdge?.to.groupId) {
          currentGroupId = nextEdge.to.groupId;
          currentBlockIndex = 0;
          hopCount++;
          continue outer;
        }
        continue;
      }

      if (block.type === 'set_variable') {
        const variableId = block.options?.variableId as string | undefined;
        const variableName = block.options?.variableName as string | undefined;
        const key = variableName ?? variableId;
        if (key) {
          const expression =
            (block.options?.expressionToEvaluate as string | undefined) ?? '';
          const value = substituteVariables(expression, variables);
          variables = { ...variables, [key]: value };
          nextSteps.push({
            type: 'variable_set',
            payload: { key, value },
          });
        }
        continue;
      }

      if (block.type === 'redirect') {
        const url = substituteVariables(
          (block.options?.url as string | undefined) ?? '',
          variables,
        );
        nextSteps.push({ type: 'redirect', payload: { url } });
        // Redirect terminates the flow
        return {
          session: {
            ...session,
            variables: { ...variables },
            currentGroupId,
            currentBlockIndex: i,
            status: 'completed',
            updatedAt: new Date(),
            messages: newMessages,
          },
          nextSteps,
        };
      }

      if (block.type === 'jump') {
        const targetGroupId = block.options?.groupId as string | undefined;
        if (targetGroupId) {
          currentGroupId = targetGroupId;
          currentBlockIndex = 0;
          hopCount++;
          continue outer;
        }
        continue;
      }

      if (block.type === 'ab_test') {
        const edgeA = block.items?.[0]?.outgoingEdgeId as string | undefined;
        const edgeB = block.items?.[1]?.outgoingEdgeId as string | undefined;
        const chosenEdgeId = Math.random() < 0.5 ? edgeA : (edgeB ?? edgeA);
        const nextEdge = flow.edges.find((e) => e.id === chosenEdgeId);
        if (nextEdge?.to.groupId) {
          currentGroupId = nextEdge.to.groupId;
          currentBlockIndex = 0;
          hopCount++;
          continue outer;
        }
        continue;
      }

      // ── script block ───────────────────────────────────────────────────
      if (block.type === 'script') {
        const scriptOpts = (block.options ?? {}) as ScriptOptions & {
          code?: string;
          outputVariable?: string;
          timeoutMs?: number;
          allowFetch?: boolean;
          allowedDomains?: string[];
          runOnClient?: boolean;
        };

        // Accept either the Typebot `content` field or SabFlow's `code`.
        const source = (scriptOpts.code ?? scriptOpts.content ?? '').trim();
        if (!source) continue;

        // If the script is marked as client-side but we're running on the
        // server (no window), we defer execution by emitting a placeholder
        // step and letting the chat widget pick it up. Otherwise we run it
        // right here inside the appropriate sandbox.
        const runOnClient =
          scriptOpts.isExecutedOnClient === true || scriptOpts.runOnClient === true;
        const hasWindow = typeof window !== 'undefined';
        if (runOnClient && !hasWindow) {
          nextSteps.push({
            type: 'script_executed',
            payload: {
              blockId: block.id,
              deferred: true,
              runOn: 'client',
              code: source,
              outputVariable: scriptOpts.outputVariable ?? null,
              timeoutMs: scriptOpts.timeoutMs ?? 5000,
            },
          });
          continue;
        }

        const collectedLogs: SandboxLogEntry[] = [];
        const sandboxCtx: SandboxContext = {
          variables: { ...variables },
          setVariable: (name, value) => {
            if (typeof name !== 'string' || !name) return;
            variables = { ...variables, [name]: toStringValue(value) };
          },
          console: {
            log: (...args) => {
              collectedLogs.push({ level: 'log', message: args.map(formatArg).join(' ') });
            },
            error: (...args) => {
              collectedLogs.push({ level: 'error', message: args.map(formatArg).join(' ') });
            },
          },
        };

        const result = await runScript(source, sandboxCtx, {
          timeoutMs: typeof scriptOpts.timeoutMs === 'number' ? scriptOpts.timeoutMs : 5000,
          allowFetch: scriptOpts.allowFetch === true,
          allowedDomains: scriptOpts.allowedDomains ?? [],
        });

        // Merge any captured logs (sandbox also fills these but may have its own).
        const allLogs = [...collectedLogs, ...result.logs];

        // If the block has an outputVariable, stash the return value there.
        if (result.success && scriptOpts.outputVariable) {
          variables = {
            ...variables,
            [scriptOpts.outputVariable]: toStringValue(result.returnValue),
          };
          nextSteps.push({
            type: 'variable_set',
            payload: { key: scriptOpts.outputVariable, value: variables[scriptOpts.outputVariable] },
          });
        }

        nextSteps.push({
          type: 'script_executed',
          payload: {
            blockId: block.id,
            success: result.success,
            returnValue: result.returnValue,
            variables: result.variables,
            logs: allLogs,
            error: result.error,
            executionTimeMs: result.executionTimeMs,
          },
        });
        continue;
      }

      // All other blocks (integration, wait, etc.) — skip gracefully
    }

    // All blocks in the group done. Follow the last block's outgoing edge.
    const lastBlock = group.blocks.at(-1);
    if (lastBlock?.outgoingEdgeId) {
      const edge = flow.edges.find((e) => e.id === lastBlock.outgoingEdgeId);
      if (edge?.to.groupId) {
        currentGroupId = edge.to.groupId;
        currentBlockIndex = 0;
        hopCount++;
        continue;
      }
    }

    // No outgoing edge — flow is done
    break;
  }

  return {
    session: {
      ...session,
      variables: { ...variables },
      currentGroupId,
      currentBlockIndex: 0,
      status: 'completed',
      updatedAt: new Date(),
      messages: newMessages,
    },
    nextSteps,
  };
}

// ── evaluateCondition ──────────────────────────────────────────────────────

/**
 * Re-exports the engine's evaluateCondition with a simpler signature
 * (string-only variables map, no undefined values).
 */
export { evaluateCondition };

// ── followEdge ─────────────────────────────────────────────────────────────

/**
 * Given an EdgeFrom descriptor, finds the first matching edge in the flow and
 * returns the destination Group (or undefined if no edge matches).
 * Pure — no DB, no side effects.
 */
export function followEdge(
  flow: SabFlowDoc,
  from: EdgeFrom,
): Group | undefined {
  let matchingEdge = flow.edges.find((e) => {
    const f = e.from;

    if ('eventId' in from && from.eventId !== undefined) {
      return 'eventId' in f && f.eventId === from.eventId;
    }

    if (from.groupId !== undefined) {
      if (!('groupId' in f) || f.groupId !== from.groupId) return false;

      // itemId match (most specific)
      if (from.itemId !== undefined) {
        return (
          'itemId' in f &&
          f.itemId === from.itemId &&
          'blockId' in f &&
          f.blockId === from.blockId
        );
      }

      // blockId match
      if (from.blockId !== undefined) {
        return 'blockId' in f && f.blockId === from.blockId && !('itemId' in f && f.itemId);
      }

      // group-level match
      return !('blockId' in f && f.blockId);
    }

    return false;
  });

  if (!matchingEdge) return undefined;
  return flow.groups.find((g) => g.id === matchingEdge!.to.groupId);
}
