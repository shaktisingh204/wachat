import type { Block, Edge, SabFlowDoc } from '@/lib/sabflow/types';
import type { OutgoingMessage } from './types';
import type { Condition } from './evaluateCondition';
import { evaluateCondition } from './evaluateCondition';
import { substituteVariables } from './substituteVariables';
import { resolveDeep } from './resolveTokens';
import { runWithRetry } from './runWithRetry';
import { resolveErrorEdge } from './errorRouting';
import { getForgeBlock } from '@/lib/sabflow/forge';
import { extractValue, isResourceLocatorValue } from '@/lib/sabflow/forge/extractValue';
import type { ForgeField } from '@/lib/sabflow/forge/types';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
// Side-effect import: wires up the real AgentRunner + TranscriptPersister on
// `agent-bridge.ts` so agent-* forge blocks can reach `@/lib/agents` and
// `@/lib/mongodb`. This file is server-only — executeBlock is itself
// server-only (via the credentials/db import above), so it never reaches
// any client bundle.
import '@/lib/sabflow/agent-bridge.server';
import { emitTrace } from './traceEmitter';

export type BlockExecutionResult = {
  messages: OutgoingMessage[];
  /**
   * Set to the ID of the group to navigate to next (edge traversal already
   * resolved by this function for condition blocks).
   */
  nextGroupId?: string;
  updatedVariables?: Record<string, string>;
  /** True when the block needs a user reply before execution can continue. */
  requiresInput?: boolean;
  /**
   * Raw outputs produced by a forge block's `run()` — the bag stashed into
   * `nodeOutputs` by `executeFlow` so the NEXT block can reference this
   * block's output as `{{ $node["<DisplayName>"].json.<key> }}`. Mirrors
   * n8n's per-node output stream.
   */
  forgeOutputs?: Record<string, unknown>;
  /**
   * When the block errored and `onError` is set to 'continueErrorOutput', this
   * carries the error edge's destination so `executeFlow` can jump to it.
   * When the block errored and `onError` is 'stop' (or undefined), this is
   * 'halt' and the caller terminates execution.
   */
  errorSignal?: { kind: 'goto'; groupId: string } | { kind: 'halt'; message: string };
};

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
 * Optional execution context. Plumbed from `executeFlow` so forge blocks can
 * resolve cross-resource access (sub-workflow invocation, env vars, SabFile
 * uploads) under the calling workspace's identity.
 *
 * `userId`       — workspace owner driving the current run.
 * `callerStack`  — flow ids currently on the execution stack (oldest first).
 *                  Used by `forge_execute_workflow` for cycle detection.
 * `executionId`  — opaque run id; when set, per-item trace events are emitted
 *                  to `sabflow_execution_traces` (guarded by
 *                  `SABFLOW_TRACE_ENABLED`).
 * `itemIndex`    — 0-based item position within the block's item list.
 *                  Defaults to 0 when not supplied.
 */
export type ExecuteBlockContext = {
  userId?: string;
  callerStack?: string[];
  executionId?: string;
  itemIndex?: number;
  /**
   * Upstream node outputs keyed by display name, populated by `executeFlow`
   * after each preceding block finishes. Forge blocks' string options are
   * resolved through `resolveDeep` with this map, so any field referencing
   * `{{ $node["<DisplayName>"].json.<key> }}` resolves to the actual value
   * produced by that upstream block (n8n parity).
   */
  nodeOutputs?: Record<string, unknown>;
  /** Display name of the currently-executing block (the n8n "$node.name"). */
  currentNodeName?: string;
  /** Flow doc passed through so the expression engine can expose `$workflow`. */
  flow?: SabFlowDoc;
};

/**
 * Executes a single block and returns messages, variable updates, and
 * navigation hints.  The `edges` array is required for blocks that perform
 * their own edge selection (condition, redirect, etc.).
 */
export async function executeBlock(
  block: Block,
  variables: Record<string, string>,
  edges: Edge[],
  userInput?: string,
  ctx?: ExecuteBlockContext,
): Promise<BlockExecutionResult> {
  const traceExecutionId = ctx?.executionId;
  const traceItemIndex = ctx?.itemIndex ?? 0;
  const traceWorkspaceId = ctx?.userId;

  if (traceExecutionId) {
    emitTrace({
      executionId: traceExecutionId,
      nodeId: block.id,
      itemIndex: traceItemIndex,
      phase: 'pre',
      ts: Date.now(),
      inputSample: userInput !== undefined ? userInput : variables,
      workspaceId: traceWorkspaceId,
    });
  }

  const traceStartTs = Date.now();

  const executeAndTrace = async (): Promise<BlockExecutionResult> => {
    // Forge blocks are dispatched via the schema-driven registry. Caught before
    // the switch so we don't have to enumerate every forge type below.
    if (block.type.startsWith('forge_')) {
      return executeForgeBlock(block, variables, edges, ctx);
    }

    return executeBlockInner(block, variables, edges, userInput, ctx);
  };

  let result: BlockExecutionResult;
  try {
    result = await executeAndTrace();
  } catch (err) {
    if (traceExecutionId) {
      emitTrace({
        executionId: traceExecutionId,
        nodeId: block.id,
        itemIndex: traceItemIndex,
        phase: 'error',
        ts: Date.now(),
        durationMs: Date.now() - traceStartTs,
        error: err instanceof Error ? err.message : String(err),
        workspaceId: traceWorkspaceId,
      });
    }
    throw err;
  }

  if (traceExecutionId) {
    emitTrace({
      executionId: traceExecutionId,
      nodeId: block.id,
      itemIndex: traceItemIndex,
      phase: result.errorSignal ? 'error' : 'post',
      ts: Date.now(),
      durationMs: Date.now() - traceStartTs,
      outputSample: result.messages.length
        ? result.messages.map((m) => m.content).join('\n')
        : result.updatedVariables,
      ...(result.errorSignal && {
        error:
          result.errorSignal.kind === 'halt'
            ? result.errorSignal.message
            : `goto:${result.errorSignal.groupId}`,
      }),
      workspaceId: traceWorkspaceId,
    });
  }

  return result;
}

/**
 * Inner switch-based dispatch for non-forge blocks. Extracted so the outer
 * `executeBlock` wrapper can wrap it with trace emission logic without
 * duplicating the switch.
 */
async function executeBlockInner(
  block: Block,
  variables: Record<string, string>,
  edges: Edge[],
  userInput?: string,
  ctx?: ExecuteBlockContext,
): Promise<BlockExecutionResult> {

  switch (block.type) {
    // ── Bubble blocks ────────────────────────────────────────────────────────
    case 'text': {
      const raw =
        (block.options?.content as string | undefined) ??
        (block.options?.text as string | undefined) ??
        '';
      const content = substituteVariables(raw, variables);
      return { messages: [{ type: 'text', content }] };
    }

    case 'image': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.imageUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'image', content: substituteVariables(url, variables) }] };
    }

    case 'video': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.videoUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'video', content: substituteVariables(url, variables) }] };
    }

    case 'audio': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.audioUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'audio', content: substituteVariables(url, variables) }] };
    }

    case 'embed': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.embedUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'embed', content: substituteVariables(url, variables) }] };
    }

    // ── Logic blocks ─────────────────────────────────────────────────────────
    case 'condition': {
      // items array holds condition branches, each with an outgoingEdgeId
      const items = (block.items ?? []) as Array<{
        id: string;
        content?: Condition;
        outgoingEdgeId?: string;
      }>;

      const passedItem = items.find(
        (item) =>
          item.content &&
          evaluateCondition(item.content, variables),
      );

      const winningEdgeId = passedItem?.outgoingEdgeId ?? block.outgoingEdgeId;
      const nextEdge = edges.find((e) => e.id === winningEdgeId);
      return { messages: [], nextGroupId: nextEdge?.to.groupId };
    }

    case 'set_variable': {
      const variableId = block.options?.variableId as string | undefined;
      const variableName = block.options?.variableName as string | undefined;
      const key = variableName ?? variableId;
      if (!key) return { messages: [] };

      const expression = (block.options?.expressionToEvaluate as string | undefined) ?? '';
      const value = substituteVariables(expression, variables);
      return {
        messages: [],
        updatedVariables: { ...variables, [key]: value },
      };
    }

    case 'redirect': {
      const url = substituteVariables(
        (block.options?.url as string | undefined) ?? '',
        variables,
      );
      // Emit a text message carrying the redirect URL so the client can act on it
      return {
        messages: [{ type: 'text', content: `REDIRECT:${url}` }],
      };
    }

    case 'script': {
      const code = substituteVariables(
        (block.options?.content as string | undefined) ?? '',
        variables,
      );
      const outcome = await runWithRetry(block, () => {
        // Lightweight sandbox: read-only variables, string return via `return`.
        const fn = new Function('variables', `"use strict"; ${code}`);
        const raw = fn({ ...variables });
        return raw === undefined || raw === null ? '' : String(raw);
      });

      const saveVariableId =
        (block.options?.variableId as string | undefined) ??
        (block.options?.variableName as string | undefined);

      if (outcome.kind === 'ok') {
        const result = outcome.value;
        const updatedVariables =
          saveVariableId && result
            ? { ...variables, [saveVariableId]: result }
            : undefined;
        return { messages: [], updatedVariables };
      }

      return buildErrorSignal(block, edges, outcome.error, outcome.strategy);
    }

    case 'wait': {
      // The engine records the wait but does not actually sleep.  Callers
      // that need a real delay should read `options.waitFor` (ms).
      return { messages: [] };
    }

    case 'jump': {
      // Jump carries a groupId in options; surface it as nextGroupId directly.
      const targetGroupId = block.options?.groupId as string | undefined;
      return { messages: [], nextGroupId: targetGroupId };
    }

    case 'typebot_link': {
      // Out-of-scope for the current engine; treat as a no-op.
      return { messages: [] };
    }

    case 'ab_test': {
      // Randomly pick one of the two paths (50/50).
      const edgeA = block.items?.[0]?.outgoingEdgeId as string | undefined;
      const edgeB = block.items?.[1]?.outgoingEdgeId as string | undefined;
      const chosenEdgeId = Math.random() < 0.5 ? edgeA : (edgeB ?? edgeA);
      const nextEdge = edges.find((e) => e.id === chosenEdgeId);
      return { messages: [], nextGroupId: nextEdge?.to.groupId };
    }

    // ── Integration blocks ────────────────────────────────────────────────────
    case 'webhook': {
      const url = substituteVariables(
        (block.options?.url as string | undefined) ?? '',
        variables,
      );
      const method =
        ((block.options?.method as string | undefined) ?? 'GET').toUpperCase();
      const headers = (block.options?.headers as Record<string, string> | undefined) ?? {};
      const bodyTemplate = block.options?.body as string | undefined;

      if (!url) return { messages: [] };

      const outcome = await runWithRetry(block, async () => {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(
              Object.entries(headers).map(([k, v]) => [
                k,
                substituteVariables(v, variables),
              ]),
            ),
          },
        };
        if (bodyTemplate && method !== 'GET') {
          fetchOptions.body = substituteVariables(bodyTemplate, variables);
        }
        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return res.text();
      });

      const responseVariableId =
        (block.options?.responseVariableId as string | undefined) ??
        (block.options?.saveResponseVariableId as string | undefined);

      if (outcome.kind === 'ok') {
        const updatedVariables = responseVariableId
          ? { ...variables, [responseVariableId]: outcome.value }
          : undefined;
        return { messages: [], updatedVariables };
      }

      return buildErrorSignal(block, edges, outcome.error, outcome.strategy);
    }

    case 'send_email':
    case 'google_sheets':
    case 'open_ai':
    case 'anthropic':
    case 'elevenlabs':
    case 'together_ai':
    case 'mistral':
    case 'cal_com':
    case 'nocodb': {
      const outcome = await runWithRetry(block, async () => {
        const credentialId = block.options?.credentialId as string | undefined;
        const credentialRecord = credentialId ? await getCredentialById(credentialId) : null;
        const credential = credentialRecord?.data;
        const opts = substituteInValue(block.options ?? {}, variables) as Record<string, unknown>;

        switch (block.type) {
          case 'send_email': {
            const { executeSendEmail } = await import('@/lib/sabflow/integrations/sendEmail');
            return executeSendEmail(opts, credential);
          }
          case 'google_sheets': {
            const { executeGoogleSheets } = await import('@/lib/sabflow/integrations/googleSheets');
            return executeGoogleSheets(opts, credential);
          }
          case 'open_ai': {
            const { executeOpenAi } = await import('@/lib/sabflow/integrations/openAi');
            return executeOpenAi(opts, credential);
          }
          case 'anthropic': {
            const { executeAnthropicAi } = await import('@/lib/sabflow/integrations/anthropicAi');
            return executeAnthropicAi(opts, credential);
          }
          case 'elevenlabs': {
            const { executeElevenLabs } = await import('@/lib/sabflow/integrations/elevenlabs');
            return executeElevenLabs(opts, credential);
          }
          case 'together_ai': {
            const { executeTogetherAi } = await import('@/lib/sabflow/integrations/togetherAi');
            return executeTogetherAi(opts, credential);
          }
          case 'mistral': {
            const { executeMistral } = await import('@/lib/sabflow/integrations/mistral');
            return executeMistral(opts, credential);
          }
          case 'cal_com': {
            const { executeCalCom } = await import('@/lib/sabflow/integrations/calCom');
            return executeCalCom(opts, credential);
          }
          case 'nocodb': {
            const { executeNocoDB } = await import('@/lib/sabflow/integrations/nocodb');
            return executeNocoDB(opts, credential);
          }
          default:
            return { outputs: {} };
        }
      });

      if (outcome.kind === 'ok') {
        const result = outcome.value as { outputs?: Record<string, unknown>; error?: string } | undefined;
        if (result?.error) {
          return buildErrorSignal(block, edges, new Error(result.error), 'stop');
        }
        const updates = result?.outputs;
        if (updates && Object.keys(updates).length > 0) {
          const merged: Record<string, string> = { ...variables };
          for (const [k, v] of Object.entries(updates)) {
            merged[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
          return { messages: [], updatedVariables: merged };
        }
        return { messages: [] };
      }
      return buildErrorSignal(block, edges, outcome.error, outcome.strategy);
    }

    // These third-party blocks are client-side/external-only — no-ops here.
    case 'google_analytics':
    case 'zapier':
    case 'make_com':
    case 'pabbly_connect':
    case 'chatwoot':
    case 'pixel':
    case 'segment': {
      return { messages: [] };
    }

    // ── Input blocks (and unknown types) ─────────────────────────────────────
    default: {
      if (INPUT_TYPES.has(block.type)) {
        // If we already have user input, store it in the target variable and
        // continue; otherwise signal that we need user input.
        if (userInput !== undefined) {
          const variableId = block.options?.variableId as string | undefined;
          const variableName = block.options?.variableName as string | undefined;
          const key = variableName ?? variableId;
          const updatedVariables = key
            ? { ...variables, [key]: userInput }
            : variables;
          return { messages: [], updatedVariables };
        }
        return { messages: [], requiresInput: true };
      }
      return { messages: [] };
    }
  }
}

/**
 * Run a forge block by looking up its action in the schema-driven registry
 * and invoking action.run with a thin context. Variable substitution is
 * applied to all string options recursively.
 */
async function executeForgeBlock(
  block: Block,
  variables: Record<string, string>,
  edges: Edge[],
  ctx?: ExecuteBlockContext,
): Promise<BlockExecutionResult> {
  const forge = getForgeBlock(block.type);
  if (!forge) {
    return {
      messages: [],
      errorSignal: { kind: 'halt', message: `Unknown forge block: ${block.type}` },
    };
  }

  const actionId =
    (block.options?.action as string | undefined) ??
    forge.actions?.[0]?.id;
  const action = forge.actions?.find((a) => a.id === actionId);
  if (!action || typeof action.run !== 'function') {
    return {
      messages: [],
      errorSignal: { kind: 'halt', message: `Forge ${block.type}: action "${actionId}" not found` },
    };
  }

  // Forge blocks support the full advanced expression engine (n8n-compatible):
  //   {{ $node["Webhook"].json.email }}      → upstream block output
  //   {{ $json.foo }}, {{ $now.toFormat() }} → current-item + Luxon helpers
  //   {{ $vars.bar }} / bare {{ bar }}       → flow variables (legacy)
  // Plain `{{ varName }}` references still resolve through the same engine
  // because `resolveDeep` short-circuits to `substituteVariables` when no
  // advanced tokens are present, preserving back-compat with every existing
  // forge block that uses bare-identifier templating.
  const resolvedOptions = resolveDeep(block.options ?? {}, {
    variables,
    nodeOutputs: ctx?.nodeOutputs,
    flow: ctx?.flow,
    currentNodeName: ctx?.currentNodeName,
  }) as Record<string, unknown>;

  // Normalise any `resourceLocator` values to plain id strings BEFORE the
  // action's `run()` sees them. Actions that pre-date Phase 2 read fields
  // as `ctx.options.channel as string`; this guarantees that contract still
  // holds even when the editor stored a `{ mode, value }` envelope. Plain
  // strings (legacy fields) pass through unchanged.
  const actionFields: ForgeField[] = action.fields ?? [];
  for (const def of actionFields) {
    if (def.type !== 'resourceLocator') continue;
    const raw = resolvedOptions[def.id];
    if (raw === undefined) continue;
    if (typeof raw === 'string' || isResourceLocatorValue(raw)) {
      resolvedOptions[def.id] = extractValue(raw as never, def.modes);
    }
  }

  // Resolve credential through SabFlow Connections when the block declares a
  // credentialType (new ports) — falling back to inline auth fields baked into
  // the options object for the legacy blocks that pre-date the picker.
  let credential: Record<string, string> | undefined;
  if (forge.auth?.credentialType) {
    const credentialId = (resolvedOptions.credentialId as string | undefined) ?? undefined;
    if (credentialId) {
      const record = await getCredentialById(credentialId);
      credential = record?.data;
    }
  }

  const outcome = await runWithRetry(block, async () => {
    return action.run({
      options: resolvedOptions,
      variables,
      credential,
      userId: ctx?.userId,
      callerStack: ctx?.callerStack,
    });
  });

  if (outcome.kind === 'ok') {
    const result = outcome.value;
    const updates = result?.outputs;
    // The raw outputs bag is also handed back to executeFlow so it can be
    // exposed to downstream blocks as `$node["<DisplayName>"].json.<key>`.
    const forgeOutputs = updates ?? {};
    if (updates && Object.keys(updates).length) {
      const merged: Record<string, string> = { ...variables };
      for (const [k, v] of Object.entries(updates)) {
        merged[k] =
          typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v);
      }
      return { messages: [], updatedVariables: merged, forgeOutputs };
    }
    return { messages: [], forgeOutputs };
  }

  return buildErrorSignal(block, edges, outcome.error, outcome.strategy);
}

/** Recursively substitute {{var}} tokens in any string field of an object/array. */
function substituteInValue(input: unknown, variables: Record<string, string>): unknown {
  if (typeof input === 'string') return substituteVariables(input, variables);
  if (Array.isArray(input)) return input.map((v) => substituteInValue(v, variables));
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = substituteInValue(v, variables);
    }
    return out;
  }
  return input;
}

function buildErrorSignal(
  block: Block,
  edges: Edge[],
  error: Error,
  strategy: 'stop' | 'continueRegularOutput' | 'continueErrorOutput',
): BlockExecutionResult {
  const errorText = `Error in ${block.type}: ${error.message}`;

  if (strategy === 'continueRegularOutput') {
    return { messages: [{ type: 'text', content: errorText }] };
  }

  if (strategy === 'continueErrorOutput') {
    const edge = resolveErrorEdge(block, edges);
    if (edge?.to.groupId) {
      return {
        messages: [{ type: 'text', content: errorText }],
        errorSignal: { kind: 'goto', groupId: edge.to.groupId },
      };
    }
    return {
      messages: [{ type: 'text', content: errorText }],
      errorSignal: { kind: 'halt', message: errorText },
    };
  }

  return {
    messages: [],
    errorSignal: { kind: 'halt', message: errorText },
  };
}
