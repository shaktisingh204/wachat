/**
 * Forge → SabFlow webhook-trigger integration shim.
 *
 * This module is the documented bridge between the runtime-action
 * `forge_webhook` block (see `./webhook.ts`) and the production webhook
 * trigger system that already exists at:
 *
 *   • Receiver route ............. `src/app/api/sabflow/webhook/[webhookId]/route.ts`
 *   • Registration helpers ....... `src/lib/sabflow/db.ts`
 *                                  → `upsertFlowWebhooks` (mint on activate)
 *                                  → `deactivateFlowWebhooks` (revoke)
 *                                  → `getWebhookByWebhookId` (resolve incoming)
 *                                  → `listFlowWebhooks` (diagnostics)
 *   • Event shape ................ `src/lib/sabflow/types.ts`
 *                                  → `SabFlowEvent { type: 'webhook', appEvent? , options }`
 *                                  → `WebhookEventOptions { filters }`
 *   • Trigger filter evaluator ... `src/lib/sabflow/docs/triggerFilters.ts`
 *                                  → `evaluateFilter(filter, payload)`
 *   • Dispatcher ................. The receiver enqueues a BullMQ job onto
 *                                  `SABFLOW_QUEUE` (`src/lib/sabflow/worker/queues.ts`)
 *                                  with `triggerMode: 'webhook'` and the
 *                                  normalized payload as `triggerData`. The
 *                                  worker then drives the regular flow engine
 *                                  via `startSession(...)` (`execution/engine.ts`),
 *                                  which seeds `variables.$trigger` so block
 *                                  authors can read the body inline via
 *                                  `{{$trigger}}`.
 *
 * ── Why this is a SHIM, not a registration call ──────────────────────────────
 *
 * In SabFlow, trigger registration is **declarative on the flow document** —
 * the flow author adds a `SabFlowEvent` of type `'webhook'` (with an optional
 * `appEvent` slug), and the activation hook mints a webhook URL via
 * `upsertFlowWebhooks`. The Forge `forge_webhook` block is intentionally a
 * **runtime action**, not a trigger, because:
 *
 *   1. Forge blocks live INSIDE the executed flow graph and run AFTER the
 *      trigger has fired — they cannot retroactively register themselves as
 *      the entry point.
 *   2. The trigger registry (`upsertFlowWebhooks`) is driven by
 *      `flow.events[]`, not by the presence of any particular block. Adding a
 *      `forge_webhook` block does not, and should not, mint a URL.
 *   3. The `responseNode` mode of the existing webhook receiver listens on
 *      the `SABFLOW_WEBHOOK_RESPONSE(executionId)` Redis channel. A future
 *      "respond to webhook" semantic for `forge_webhook` can publish to that
 *      channel from inside `respond()` — this shim points at the exact
 *      contract so that wave can wire it without re-discovering the layout.
 *
 * ── What this shim provides ──────────────────────────────────────────────────
 *
 *   • `WEBHOOK_TRIGGER_CONTRACT` — the canonical mapping between
 *     `forge_webhook` block fields and the persisted `SabFlowEvent` /
 *     `SabFlowWebhook` record. Surface this to flow tooling and codegen so
 *     adding a `forge_webhook` block can suggest the user attach a matching
 *     `events: [{ type: 'webhook', appEvent: '...' }]` entry on save.
 *
 *   • `describeForgeWebhookTrigger(blockOptions)` — pure function returning
 *     the trigger-info payload the flow's activation hook can hand to
 *     `upsertFlowWebhooks`. Callers must STILL call `upsertFlowWebhooks` —
 *     this shim does not touch Mongo and has no side effects, by design, so
 *     it is safe to import from both server and the editor preview surfaces.
 *
 *   • `getResponseChannel(executionId)` — re-exports the Redis channel name
 *     so a future "respond to webhook" forge action can `Redis.publish` the
 *     `respond()` envelope to satisfy the receiver's `responseMode:
 *     'responseNode'` wait loop without copying the constant.
 *
 * This shim deliberately does NOT:
 *   • Register a new BullMQ queue or worker — the existing one handles all
 *     trigger modes.
 *   • Modify `forge_webhook` runtime semantics — the `respond` action stays
 *     a synthetic envelope shaper as documented in `./webhook.ts`.
 *   • Call `upsertFlowWebhooks` at module-eval time — registration is the
 *     activation hook's job, not the block registry's.
 */

import 'server-only';

import {
  SABFLOW_WEBHOOK_RESPONSE,
  SABFLOW_EXEC_CHANNEL,
} from '@/lib/sabflow/worker/queues';
import type { SabFlowWebhook } from '@/lib/sabflow/types';

/**
 * Canonical contract between the `forge_webhook` block and the persisted
 * webhook registry. Exposed as a runtime value so editor tooling can render
 * the table in the block's settings panel without duplicating the strings.
 */
export const WEBHOOK_TRIGGER_CONTRACT = {
  /** SabFlowEvent.type value that activates webhook minting. */
  eventType: 'webhook' as const,
  /** Default appEvent slug used when the block doesn't set one. */
  defaultAppEvent: 'webhook_received' as const,
  /** Methods the receiver accepts; 'ANY' is the wildcard. */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'] as const,
  /** Auth modes the receiver enforces (see `checkAuth` in the route file). */
  authModes: ['none', 'header', 'query', 'basic'] as const,
  /**
   * responseMode values supported end-to-end by the receiver. The receiver
   * resolves these on a per-webhook basis (`SabFlowWebhook.responseMode`),
   * NOT per execution.
   */
  responseModes: ['immediately', 'lastNode', 'responseNode'] as const,
  /**
   * Receiver path template. `webhookId` is the unique slug minted by
   * `upsertFlowWebhooks` — it is the public secret in the URL.
   */
  receiverPath: '/api/sabflow/webhook/:webhookId' as const,
  /**
   * Engine variable seeded with the normalized webhook payload
   * `{ body, query, headers, method }`. JSON-stringified.
   */
  triggerVariable: '$trigger' as const,
} as const;

/**
 * Shape of the trigger-info record an activation hook can feed to
 * `upsertFlowWebhooks` for a `forge_webhook` block. Pure derivation from the
 * block's saved options — no DB calls.
 */
export type ForgeWebhookTriggerInfo = {
  appEvent: string;
  method: SabFlowWebhook['method'];
  authentication: SabFlowWebhook['authentication'];
  responseMode: SabFlowWebhook['responseMode'];
};

const METHODS: ReadonlySet<SabFlowWebhook['method']> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'ANY',
]);
const AUTHS: ReadonlySet<SabFlowWebhook['authentication']> = new Set([
  'none',
  'header',
  'query',
  'basic',
]);
const RESPONSE_MODES: ReadonlySet<SabFlowWebhook['responseMode']> = new Set([
  'immediately',
  'lastNode',
  'responseNode',
]);

function asMethod(value: unknown): SabFlowWebhook['method'] {
  return typeof value === 'string' && METHODS.has(value as SabFlowWebhook['method'])
    ? (value as SabFlowWebhook['method'])
    : 'ANY';
}

function asAuth(value: unknown): SabFlowWebhook['authentication'] {
  return typeof value === 'string' && AUTHS.has(value as SabFlowWebhook['authentication'])
    ? (value as SabFlowWebhook['authentication'])
    : 'none';
}

function asResponseMode(value: unknown): SabFlowWebhook['responseMode'] {
  return typeof value === 'string' && RESPONSE_MODES.has(value as SabFlowWebhook['responseMode'])
    ? (value as SabFlowWebhook['responseMode'])
    : 'immediately';
}

/**
 * Project a `forge_webhook` block's saved options into the activation-hook
 * payload. Pure — no Mongo, no Redis, no fetch. The caller is responsible for
 * passing the result through `upsertFlowWebhooks(flowId, userId, [info])`.
 */
export function describeForgeWebhookTrigger(
  blockOptions: Record<string, unknown> | undefined,
): ForgeWebhookTriggerInfo {
  const opts = blockOptions ?? {};
  const appEvent =
    typeof opts.appEvent === 'string' && opts.appEvent.length > 0
      ? opts.appEvent
      : WEBHOOK_TRIGGER_CONTRACT.defaultAppEvent;
  return {
    appEvent,
    method: asMethod(opts.method),
    authentication: asAuth(opts.authentication),
    responseMode: asResponseMode(opts.responseMode),
  };
}

/**
 * Redis channel a future "respond to webhook" forge action should publish to
 * when the originating webhook used `responseMode: 'responseNode'`. The
 * receiver waits on this channel for up to 30 s before falling back to a 202.
 */
export function getResponseChannel(executionId: string): string {
  return SABFLOW_WEBHOOK_RESPONSE(executionId);
}

/**
 * Redis channel the receiver listens on for `responseMode: 'lastNode'` —
 * exposed for symmetry / diagnostics. Forge code should NOT publish here;
 * the engine's terminal step is responsible.
 */
export function getExecutionChannel(executionId: string): string {
  return SABFLOW_EXEC_CHANNEL(executionId);
}
