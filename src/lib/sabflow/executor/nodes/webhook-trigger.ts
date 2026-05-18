/**
 * SabFlow.WebhookTrigger — HTTP webhook trigger node.
 *
 * Track B Phase 3 sub-task #2 of 10.
 *
 * Triggers are not "regular" nodes: their `execute()` is invoked by the
 * platform (not by upstream DAG traversal) when an HTTP request arrives on
 * the registered path. The platform/router (Phase 6 #1) is responsible for:
 *
 *   1. Resolving the inbound `(method, path)` → `(workflowId, nodeName)`.
 *   2. Authenticating the request via {@link verifyAuth}.
 *   3. Synthesising a webhook payload and seeding it as the first input
 *      item: `ctx.getInputData()[0].json = { headers, params, query, body,
 *      webhookUrl }`.
 *   4. Calling `execute(ctx)` and using its returned items as the trigger's
 *      output for the DAG run.
 *   5. Reading {@link WebhookTriggerMetadata.respondsViaWebhookResponseNode}
 *      to decide whether to defer the HTTP response until a downstream
 *      `Respond to Webhook` node fires.
 *
 * This file is intentionally pure data-shape + handlers; it does NOT bind
 * any HTTP routes itself.
 *
 * n8n parity (see `docs/adr/sabflow-executor-n8n-survey.md` §7):
 *   - Three response modes — `onReceived`, `lastNode`, `responseNode`.
 *   - Path map `(method, path) → (workflowId, nodeName)`.
 *   - Authentication options `none` / `basicAuth` / `headerAuth`.
 */

import type {
  NodeExecutionContext,
  NodeExecutionItem,
  NodeExecutionResult,
  NodeRegistration,
  NodeCredentialRequest,
} from '../contract';

// ---------------------------------------------------------------------------
// Public parameter / payload shapes (consumed by the platform + the editor).
// ---------------------------------------------------------------------------

/** HTTP methods the webhook trigger can listen for. `'*'` matches any. */
export type WebhookHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'PATCH'
  | '*';

/**
 * How the platform replies to the inbound HTTP request.
 *
 * n8n parity (survey §7.4):
 *   - `onReceived` — respond immediately with `responseCode` + `responseData`,
 *     before the DAG finishes.
 *   - `lastNode` — wait for the last node to finish, then respond with its
 *     items as JSON.
 *   - `responseNode` — defer; a downstream `Respond to Webhook` node will
 *     compose and send the response. The engine recognises this via
 *     {@link WebhookTriggerMetadata.respondsViaWebhookResponseNode}.
 */
export type WebhookResponseMode = 'onReceived' | 'lastNode' | 'responseNode';

/**
 * What to put in the body when `responseMode === 'onReceived'`.
 *   - `firstEntryJson` — the first item's `.json` (default).
 *   - `firstEntryBinary` — stream the first item's first binary slot.
 *   - `noData` — empty body, just the status code.
 */
export type WebhookResponseData =
  | 'firstEntryJson'
  | 'firstEntryBinary'
  | 'noData';

/** Authentication scheme applied to inbound requests before `execute` runs. */
export type WebhookAuthentication = 'none' | 'basicAuth' | 'headerAuth';

/** Optional per-trigger toggles surfaced under the "Options" collection. */
export interface WebhookTriggerOptions {
  /** CORS allow-list (comma-joined or `*`). Forwarded to the route handler. */
  allowedOrigins?: string;
  /** Drop requests whose UA looks like a crawler before invoking the DAG. */
  ignoreBots?: boolean;
  /** Preserve the raw request body (string / Buffer) alongside the parsed JSON. */
  rawBody?: boolean;
}

/**
 * Fully-typed parameter bag the editor builds for this node.
 *
 * Stored verbatim on the workflow JSON; read at run time by the platform via
 * `ctx.getNodeParameter()`. Names match {@link webhookTriggerNode.properties}.
 */
export interface WebhookTriggerParameters {
  httpMethod: WebhookHttpMethod;
  path: string;
  responseMode: WebhookResponseMode;
  responseCode: number;
  responseData: WebhookResponseData;
  authentication: WebhookAuthentication;
  options?: WebhookTriggerOptions;
}

/**
 * Shape the platform seeds into `ctx.getInputData()[0].json` before calling
 * `execute()`. Trigger nodes pass this through unchanged so downstream nodes
 * can read `$json.headers`, `$json.body`, etc., mirroring n8n.
 */
export interface WebhookTriggerPayload {
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  webhookUrl: string;
  /** Present when `options.rawBody === true`. */
  rawBody?: string;
}

/**
 * Trigger-only metadata read by the executor; does not appear on n8n's
 * `INodeTypeDescription` 1:1, but is documented here so the dispatcher can
 * make routing decisions without re-parsing the node's parameter bag.
 */
export interface WebhookTriggerMetadata {
  /** Marks the node as an HTTP-entry trigger (vs. cron / poll / manual). */
  trigger: true;
  /**
   * True when this node MAY hand its response off to a downstream
   * `Respond to Webhook` node. The engine reads this to know it must keep
   * the inbound HTTP request open past `onReceived` semantics.
   */
  respondsViaWebhookResponseNode: true;
}

/** Augmented registration with the trigger metadata field. */
export type WebhookTriggerRegistration = NodeRegistration & {
  metadata: WebhookTriggerMetadata;
};

// ---------------------------------------------------------------------------
// Helpers (also re-used by Phase 6 #1 route wiring).
// ---------------------------------------------------------------------------

/**
 * Compute the canonical webhook URL path for `(workflowId, customPath)`.
 *
 * - When `customPath` is empty, the path defaults to the workflow id (n8n
 *   parity for "Auto-generated" paths in the editor).
 * - Leading slashes in `customPath` are tolerated and normalised away.
 * - The returned path begins with `/webhook/` (no host). The route wirer
 *   prepends the absolute origin.
 *
 * Workflow uniqueness is enforced by the platform-level `webhook_entity`
 * collection, not here; this helper is purely string composition so it can
 * run in the editor (preview the URL) and on the worker.
 */
export function buildWebhookPath(workflowId: string, customPath?: string): string {
  const trimmed = (customPath ?? '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const segment = trimmed.length > 0 ? trimmed : workflowId;
  return `/webhook/${segment}`;
}

/**
 * Verify inbound auth before the platform calls `execute()`.
 *
 * Returns `{ ok: true }` on success, or `{ ok: false, status, message }` so
 * the route handler can short-circuit with the correct HTTP status without
 * leaking credential details.
 *
 * Implementation notes:
 *   - `basicAuth` reads the `Authorization: Basic <base64>` header and
 *     matches the decoded `username:password` against the credential.
 *   - `headerAuth` reads a configurable header name + value pair from the
 *     credential (`name`, `value`).
 *   - Credentials are resolved through the forward-declared
 *     {@link CredentialResolver}; in production this delegates to the
 *     executor's `CredentialsHelper` (n8n parity, survey §9). The
 *     resolver is parameterised so this helper stays pure.
 *
 * `params` is reserved for path-templated auth (none defined yet); kept in
 * the signature so the route wirer doesn't need to change when query/path
 * auth lands.
 */
export interface WebhookVerifyAuthResult {
  ok: boolean;
  /** HTTP status the route handler should reply with on failure. */
  status?: number;
  /** Human-readable failure reason (safe to log; do not echo to the client). */
  message?: string;
}

export type CredentialResolver = (
  type: 'httpBasicAuth' | 'httpHeaderAuth',
) => Promise<NodeCredentialRequest>;

export async function verifyAuth(
  headers: Record<string, string | undefined>,
  _params: Record<string, string>,
  auth: WebhookAuthentication,
  getCredentials: CredentialResolver = unboundCredentialResolver,
): Promise<WebhookVerifyAuthResult> {
  if (auth === 'none') return { ok: true };

  // Normalise header lookup to lowercase per RFC 7230 §3.2.
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') lower[k.toLowerCase()] = v;
  }

  if (auth === 'basicAuth') {
    const raw = lower['authorization'];
    if (!raw || !raw.toLowerCase().startsWith('basic ')) {
      return { ok: false, status: 401, message: 'Missing Basic credentials' };
    }
    let decoded: string;
    try {
      decoded = Buffer.from(raw.slice(6).trim(), 'base64').toString('utf8');
    } catch {
      return { ok: false, status: 401, message: 'Malformed Basic credentials' };
    }
    const idx = decoded.indexOf(':');
    if (idx < 0) {
      return { ok: false, status: 401, message: 'Malformed Basic credentials' };
    }
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    const cred = await getCredentials('httpBasicAuth');
    if (
      typeof cred.user === 'string' &&
      typeof cred.password === 'string' &&
      timingSafeEqualStr(user, cred.user) &&
      timingSafeEqualStr(pass, cred.password)
    ) {
      return { ok: true };
    }
    return { ok: false, status: 403, message: 'Basic credential mismatch' };
  }

  if (auth === 'headerAuth') {
    const cred = await getCredentials('httpHeaderAuth');
    const headerName = typeof cred.name === 'string' ? cred.name.toLowerCase() : '';
    const expected = typeof cred.value === 'string' ? cred.value : '';
    if (!headerName || !expected) {
      return { ok: false, status: 500, message: 'Header auth credential incomplete' };
    }
    const actual = lower[headerName];
    if (actual && timingSafeEqualStr(actual, expected)) {
      return { ok: true };
    }
    return { ok: false, status: 403, message: 'Header credential mismatch' };
  }

  return { ok: false, status: 500, message: `Unknown auth scheme: ${String(auth)}` };
}

/** Constant-time string compare; avoids early-exit timing side channels. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Default resolver used when callers don't inject one. Throws so misuse is
 * loud — the platform always injects a real resolver bound to the
 * executing workspace's `CredentialsHelper`.
 */
const unboundCredentialResolver: CredentialResolver = async (type) => {
  throw new Error(
    `verifyAuth: no credential resolver bound; cannot fetch '${type}' credentials. ` +
      `The webhook router (Phase 6 #1) must inject a resolver before calling verifyAuth.`,
  );
};

// ---------------------------------------------------------------------------
// `execute()` — invoked by the platform with the synthesized webhook payload.
// ---------------------------------------------------------------------------

/**
 * The trigger's execute is a pass-through: the platform has already
 * synthesised the inbound HTTP request into `ctx.getInputData()[0].json`
 * (shape: {@link WebhookTriggerPayload}). We return it verbatim as a single
 * item on the primary output so downstream nodes can read `$json.headers`,
 * `$json.body`, etc.
 *
 * If the platform forgets to seed input data, we synthesise an empty
 * payload so downstream expression evaluation doesn't blow up on `undefined`.
 */
const executeWebhookTrigger = async (
  ctx: NodeExecutionContext,
): Promise<NodeExecutionResult> => {
  const input = ctx.getInputData(0);
  if (input && input.length > 0) {
    return { output: [[input[0]]] };
  }
  const fallback: WebhookTriggerPayload = {
    headers: {},
    params: {},
    query: {},
    body: null,
    webhookUrl: '',
  };
  const item: NodeExecutionItem = {
    json: fallback as unknown as Record<string, unknown>,
  };
  return { output: [[item]] };
};

// ---------------------------------------------------------------------------
// Registration.
// ---------------------------------------------------------------------------

export const webhookTriggerNode: WebhookTriggerRegistration = {
  type: 'SabFlow.WebhookTrigger',
  typeVersion: 1,
  description: 'Starts a workflow when an HTTP request hits the registered path.',
  defaults: {
    name: 'Webhook',
    color: '#8b5cf6',
  },
  credentials: ['httpBasicAuth', 'httpHeaderAuth'],
  properties: [
    {
      displayName: 'HTTP Method',
      name: 'httpMethod',
      type: 'options',
      default: 'POST',
      required: true,
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'DELETE', value: 'DELETE' },
        { name: 'HEAD', value: 'HEAD' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'Any', value: '*' },
      ],
      description: 'HTTP method the webhook listens for. Use "Any" to match all methods.',
    },
    {
      displayName: 'Path',
      name: 'path',
      type: 'string',
      default: '',
      placeholder: 'my-webhook',
      description:
        'Path segment after /webhook/. Must be unique within the workflow. Auto-generated from the workflow id when blank.',
      noDataExpression: true,
    },
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'options',
      default: 'none',
      options: [
        { name: 'None', value: 'none' },
        { name: 'Basic Auth', value: 'basicAuth' },
        { name: 'Header Auth', value: 'headerAuth' },
      ],
    },
    {
      displayName: 'Response Mode',
      name: 'responseMode',
      type: 'options',
      default: 'onReceived',
      options: [
        { name: 'Immediately on Received', value: 'onReceived' },
        { name: 'When Last Node Finishes', value: 'lastNode' },
        { name: 'Using "Respond to Webhook" Node', value: 'responseNode' },
      ],
      description:
        'How the platform replies to the inbound HTTP request. "responseNode" defers the reply to a downstream node.',
    },
    {
      displayName: 'Response Code',
      name: 'responseCode',
      type: 'number',
      default: 200,
      description: 'Status code sent when Response Mode is "Immediately on Received".',
    },
    {
      displayName: 'Response Data',
      name: 'responseData',
      type: 'options',
      default: 'firstEntryJson',
      options: [
        { name: 'First Entry JSON', value: 'firstEntryJson' },
        { name: 'First Entry Binary', value: 'firstEntryBinary' },
        { name: 'No Response Body', value: 'noData' },
      ],
      description: 'Body shape when Response Mode is "Immediately on Received".',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      default: {},
      placeholder: 'Add Option',
      description:
        'Allowed Origins (CORS), Ignore Bots (drop crawler UAs), Raw Body (keep unparsed body alongside parsed).',
    },
  ],
  execute: executeWebhookTrigger,
  metadata: {
    trigger: true,
    respondsViaWebhookResponseNode: true,
  },
};

export default webhookTriggerNode;
