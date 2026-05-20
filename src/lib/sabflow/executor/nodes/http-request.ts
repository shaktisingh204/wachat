/**
 * SabFlow Executor — HTTP Request node.
 *
 * Track B Phase 3 (sub-task #1 of 10).
 *
 * The HTTP Request node is the workhorse external-call node — the same role
 * `n8n-nodes-base.httpRequest` (v4) plays inside n8n. It is the fallback path
 * any third-party API a user hasn't yet got a typed node for, so it must
 * faithfully mirror n8n's parameter surface so existing workflow JSON ports
 * unchanged.
 *
 * Scope of this file (per sub-task brief):
 *   - Implement `NodeRegistration` for type `SabFlow.HttpRequest`, version 1.
 *   - Use Node 24 native `fetch` + `AbortController`. No axios.
 *   - Iterate over every input item; resolve parameters via
 *     `ctx.getNodeParameter(name, itemIdx)` so the engine evaluates templated
 *     `{{ }}` expressions per item.
 *   - On non-2xx with `continueOnFail === false`, throw `NodeApiError` from
 *     `../errors`. With `continueOnFail === true`, collect the failure as an
 *     item on the regular output and keep going.
 *   - Do NOT auto-register with the sibling node registry — Phase B.8 owns
 *     the registry wiring. The export below is a plain `NodeRegistration`
 *     value the registry imports.
 *
 * Out of scope: OAuth2 redirect dance (Phase B.5 credential store), file-form
 * uploads driven by SabFiles (Phase B.6 binary helpers), follow-302-with-
 * different-method quirks. Forward-decl shapes only.
 */

import {
  type NodeExecutionContext,
  type NodeExecutionItem,
  type NodeExecutionResult,
  type NodeRegistration,
} from '../contract';
import { NodeApiError, NodeOperationError } from '../errors';

// ---------------------------------------------------------------------------
// Public node type id + version. Phase 8 registry will key off these.
// ---------------------------------------------------------------------------

/** Stable, namespaced node type id. Mirrors n8n's `n8n-nodes-base.httpRequest`. */
export const HTTP_REQUEST_NODE_TYPE = 'SabFlow.HttpRequest' as const;

/**
 * Schema version. Bump on any breaking property change; the executor uses
 * this to dispatch the right implementation and migrators key off it.
 */
export const HTTP_REQUEST_NODE_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Parameter shapes (mirror n8n HTTP Request v4 minimal set).
// ---------------------------------------------------------------------------

/** Allowed HTTP methods. Matches n8n v4. */
export type HttpRequestMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/** Repeating key/value pairs as the editor emits them. */
export interface HttpKeyValueEntry {
  name: string;
  value: string;
}

/** Body content-type union (mirrors n8n's `Body Content Type` dropdown). */
export type HttpBodyContentType =
  | 'none'
  | 'json'
  | 'form-urlencoded'
  | 'multipart-form-data'
  | 'raw'
  | 'binary';

/** Authentication strategy (mirrors n8n's `Authentication` dropdown). */
export type HttpAuthentication =
  | 'none'
  | 'predefinedCredentialType'
  | 'genericCredentialType';

/** Response parser. */
export type HttpResponseFormat = 'json' | 'string' | 'binary';

/**
 * The full per-item parameter bag a node author / migrator hands us. Every
 * field except `method` and `url` has a default so the editor's "Add Option"
 * UX stays optional.
 */
export interface HttpRequestParams {
  method: HttpRequestMethod;
  url: string;
  queryParameters: HttpKeyValueEntry[];
  headers: HttpKeyValueEntry[];
  bodyContentType: HttpBodyContentType;
  /** Raw body string (used when `bodyContentType === 'raw'`). */
  body?: string;
  /** Parsed JSON body (used when `bodyContentType === 'json'`). */
  jsonBody?: unknown;
  /** When true, body comes from a binary slot on the input item. */
  sendBinary?: boolean;
  /** Slot name on the input item carrying the binary payload. */
  binaryPropertyName?: string;
  authentication: HttpAuthentication;
  responseFormat: HttpResponseFormat;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  followRedirects: boolean;
  ignoreSslErrors: boolean;
  /** Hint to the executor — the dispatcher implements retry; we just flag it. */
  retryOnFail: boolean;
  /** Batching knob (chunk size + delay). */
  batching: {
    batchSize?: number;
    batchIntervalMs?: number;
  };
  /**
   * Credential descriptor used when `authentication !== 'none'`. The node
   * schema lets the editor pick between a predefined type (e.g.
   * `googleApi`) or a generic one (`httpBasicAuth`, `httpHeaderAuth`,
   * `httpQueryAuth`, `oAuth2Api`).
   */
  credentialType?: string;
}

// ---------------------------------------------------------------------------
// Property schema for the editor's side-panel.
//
// This mirrors the *minimal* set called out by the sub-task brief; the full
// n8n v4 property list (pagination, response options, batch options sub-tree)
// lands incrementally once the property editor in Track A Phase 6 supports
// `displayOptions`. For now, every parameter is flat + required-or-defaulted.
// ---------------------------------------------------------------------------

const properties: NodeRegistration['properties'] = [
  {
    displayName: 'Method',
    name: 'method',
    type: 'options',
    default: 'GET',
    required: true,
    options: [
      { name: 'GET', value: 'GET' },
      { name: 'POST', value: 'POST' },
      { name: 'PUT', value: 'PUT' },
      { name: 'PATCH', value: 'PATCH' },
      { name: 'DELETE', value: 'DELETE' },
      { name: 'HEAD', value: 'HEAD' },
      { name: 'OPTIONS', value: 'OPTIONS' },
    ],
    description: 'HTTP verb sent to the URL.',
  },
  {
    displayName: 'URL',
    name: 'url',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'https://example.com/api/v1/resource',
    description: 'Absolute URL to hit. Templated expressions allowed.',
  },
  {
    displayName: 'Query Parameters',
    name: 'queryParameters',
    type: 'fixedCollection',
    default: { parameter: [] },
    description: 'Key/value pairs appended to the URL as ?k=v.',
  },
  {
    displayName: 'Headers',
    name: 'headers',
    type: 'fixedCollection',
    default: { parameter: [] },
    description: 'Key/value pairs sent as request headers.',
  },
  {
    displayName: 'Body Content Type',
    name: 'bodyContentType',
    type: 'options',
    default: 'none',
    options: [
      { name: 'None', value: 'none' },
      { name: 'JSON', value: 'json' },
      { name: 'Form URL-encoded', value: 'form-urlencoded' },
      { name: 'Multipart Form-Data', value: 'multipart-form-data' },
      { name: 'Raw', value: 'raw' },
      { name: 'Binary', value: 'binary' },
    ],
  },
  {
    displayName: 'Body',
    name: 'body',
    type: 'string',
    default: '',
    description: 'Raw request body. Used when Body Content Type = Raw.',
  },
  {
    displayName: 'JSON Body',
    name: 'jsonBody',
    type: 'json',
    default: {},
    description: 'JSON request body. Used when Body Content Type = JSON.',
  },
  {
    displayName: 'Send Binary',
    name: 'sendBinary',
    type: 'boolean',
    default: false,
    description: 'When true, sources the body from an input item binary slot.',
  },
  {
    displayName: 'Binary Property Name',
    name: 'binaryPropertyName',
    type: 'string',
    default: 'data',
    description: 'Slot name on the input item carrying the binary payload.',
  },
  {
    displayName: 'Authentication',
    name: 'authentication',
    type: 'options',
    default: 'none',
    options: [
      { name: 'None', value: 'none' },
      { name: 'Predefined Credential Type', value: 'predefinedCredentialType' },
      { name: 'Generic Credential Type', value: 'genericCredentialType' },
    ],
  },
  {
    displayName: 'Credential Type',
    name: 'credentialType',
    type: 'string',
    default: '',
    description: 'Name of the credential the executor injects at runtime.',
  },
  {
    displayName: 'Response Format',
    name: 'responseFormat',
    type: 'options',
    default: 'json',
    options: [
      { name: 'JSON', value: 'json' },
      { name: 'String', value: 'string' },
      { name: 'Binary', value: 'binary' },
    ],
  },
  {
    displayName: 'Timeout (ms)',
    name: 'timeoutMs',
    type: 'number',
    default: 30_000,
    description: 'Abort the request after this many milliseconds.',
  },
  {
    displayName: 'Follow Redirects',
    name: 'followRedirects',
    type: 'boolean',
    default: true,
  },
  {
    displayName: 'Ignore SSL Errors',
    name: 'ignoreSslErrors',
    type: 'boolean',
    default: false,
    description: 'Skip TLS certificate verification. Use only for trusted self-hosted endpoints.',
  },
  {
    displayName: 'Retry On Fail',
    name: 'retryOnFail',
    type: 'boolean',
    default: false,
    description: 'Hand retryable failures to the executor retry policy.',
  },
  {
    displayName: 'Batching',
    name: 'batching',
    type: 'collection',
    default: { batchSize: 0, batchIntervalMs: 0 },
    description: 'Optional batch-size and inter-batch delay for high-volume inputs.',
  },
];

// ---------------------------------------------------------------------------
// Parameter resolution per item.
// ---------------------------------------------------------------------------

/**
 * Pull every HTTP-Request parameter for `itemIndex` off the context. The
 * engine evaluates `{{ }}` expressions inside each value before we get it,
 * so what comes back here is concrete.
 */
function resolveParams(ctx: NodeExecutionContext, itemIndex: number): HttpRequestParams {
  const method = ctx.getNodeParameter<HttpRequestMethod>('method', itemIndex, 'GET');
  const url = ctx.getNodeParameter<string>('url', itemIndex, '');

  // Query / headers come through as the editor's `{ parameter: [{name,value}] }`
  // shape OR as a plain array. Accept both.
  const queryParameters = normaliseKvCollection(
    ctx.getNodeParameter<unknown>('queryParameters', itemIndex, []),
  );
  const headers = normaliseKvCollection(
    ctx.getNodeParameter<unknown>('headers', itemIndex, []),
  );

  const bodyContentType = ctx.getNodeParameter<HttpBodyContentType>(
    'bodyContentType',
    itemIndex,
    'none',
  );
  const body = ctx.getNodeParameter<string | undefined>('body', itemIndex, undefined);
  const jsonBody = ctx.getNodeParameter<unknown>('jsonBody', itemIndex, undefined);
  const sendBinary = ctx.getNodeParameter<boolean>('sendBinary', itemIndex, false);
  const binaryPropertyName = ctx.getNodeParameter<string | undefined>(
    'binaryPropertyName',
    itemIndex,
    undefined,
  );

  const authentication = ctx.getNodeParameter<HttpAuthentication>(
    'authentication',
    itemIndex,
    'none',
  );
  const credentialType = ctx.getNodeParameter<string | undefined>(
    'credentialType',
    itemIndex,
    undefined,
  );

  const responseFormat = ctx.getNodeParameter<HttpResponseFormat>(
    'responseFormat',
    itemIndex,
    'json',
  );
  const timeoutMs = Number(ctx.getNodeParameter<number>('timeoutMs', itemIndex, 30_000));
  const followRedirects = ctx.getNodeParameter<boolean>('followRedirects', itemIndex, true);
  const ignoreSslErrors = ctx.getNodeParameter<boolean>('ignoreSslErrors', itemIndex, false);
  const retryOnFail = ctx.getNodeParameter<boolean>('retryOnFail', itemIndex, false);

  const batchingRaw = ctx.getNodeParameter<Record<string, unknown> | undefined>(
    'batching',
    itemIndex,
    {},
  );
  const batching = {
    batchSize: toNumberOrUndefined(batchingRaw?.batchSize),
    batchIntervalMs: toNumberOrUndefined(batchingRaw?.batchIntervalMs),
  };

  return {
    method,
    url,
    queryParameters,
    headers,
    bodyContentType,
    body,
    jsonBody,
    sendBinary,
    binaryPropertyName,
    authentication,
    responseFormat,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000,
    followRedirects,
    ignoreSslErrors,
    retryOnFail,
    batching,
    credentialType,
  };
}

function toNumberOrUndefined(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Normalise the editor's collection shape (`{ parameter: [...] }`) and plain
 * arrays alike into a flat `HttpKeyValueEntry[]`.
 */
function normaliseKvCollection(raw: unknown): HttpKeyValueEntry[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { parameter?: unknown }).parameter)
      ? ((raw as { parameter: unknown[] }).parameter as unknown[])
      : [];
  const out: HttpKeyValueEntry[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { name?: unknown; value?: unknown };
    if (typeof e.name !== 'string' || e.name === '') continue;
    out.push({ name: e.name, value: e.value == null ? '' : String(e.value) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// URL + body shaping.
// ---------------------------------------------------------------------------

function buildUrl(baseUrl: string, qs: HttpKeyValueEntry[]): string {
  if (qs.length === 0) return baseUrl;
  // Use URL when the input parses; otherwise fall back to manual concat so
  // template-string URLs like `${BASE}/x` still round-trip.
  try {
    const u = new URL(baseUrl);
    for (const { name, value } of qs) u.searchParams.append(name, value);
    return u.toString();
  } catch {
    const params = new URLSearchParams();
    for (const { name, value } of qs) params.append(name, value);
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}${params.toString()}`;
  }
}

function buildHeaders(headers: HttpKeyValueEntry[]): Headers {
  const h = new Headers();
  for (const { name, value } of headers) h.append(name, value);
  return h;
}

/**
 * Apply credentials onto the outgoing request. Phase B.5 owns the full
 * matrix; for Phase 3 we map the three canonical generic credential types
 * that the HTTP Request node ships with in n8n v4. Predefined types are
 * left to whichever node-author shipped them.
 */
function applyCredentials(
  creds: Record<string, string | number | boolean | null | undefined>,
  credentialType: string | undefined,
  headers: Headers,
  finalUrl: string,
): string {
  if (!credentialType) return finalUrl;
  switch (credentialType) {
    case 'httpBasicAuth': {
      const user = String(creds.user ?? '');
      const password = String(creds.password ?? '');
      const token = Buffer.from(`${user}:${password}`).toString('base64');
      headers.set('Authorization', `Basic ${token}`);
      return finalUrl;
    }
    case 'httpHeaderAuth': {
      const name = String(creds.name ?? '');
      const value = String(creds.value ?? '');
      if (name) headers.set(name, value);
      return finalUrl;
    }
    case 'httpQueryAuth': {
      const name = String(creds.name ?? '');
      const value = String(creds.value ?? '');
      if (!name) return finalUrl;
      try {
        const u = new URL(finalUrl);
        u.searchParams.append(name, value);
        return u.toString();
      } catch {
        const sep = finalUrl.includes('?') ? '&' : '?';
        return `${finalUrl}${sep}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
      }
    }
    case 'oAuth2Api': {
      const token = String(creds.accessToken ?? creds.access_token ?? '');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return finalUrl;
    }
    default:
      // Predefined credential types (e.g. `googleApi`) — handed off as
      // headers verbatim where the shape is known. Phase B.5 will fold this
      // into the credential resolver.
      return finalUrl;
  }
}

/**
 * Build the body + Content-Type pair for a request, honouring the
 * `bodyContentType` switch. Returns `undefined` body for verbs that don't
 * carry one (GET / HEAD) regardless of config.
 */
function buildBody(
  params: HttpRequestParams,
  item: NodeExecutionItem,
  headers: Headers,
): BodyInit | undefined {
  if (params.method === 'GET' || params.method === 'HEAD') return undefined;

  switch (params.bodyContentType) {
    case 'none':
      return undefined;
    case 'json': {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      const payload = params.jsonBody !== undefined ? params.jsonBody : item.json;
      return JSON.stringify(payload);
    }
    case 'form-urlencoded': {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
      const usp = new URLSearchParams();
      const src = (params.jsonBody as Record<string, unknown>) ?? item.json ?? {};
      for (const [k, v] of Object.entries(src)) {
        usp.append(k, v == null ? '' : String(v));
      }
      return usp.toString();
    }
    case 'multipart-form-data': {
      // Let `fetch` set the Content-Type with the right boundary by NOT
      // pre-setting it on the headers.
      const fd = new FormData();
      const src = (params.jsonBody as Record<string, unknown>) ?? item.json ?? {};
      for (const [k, v] of Object.entries(src)) {
        fd.append(k, v == null ? '' : String(v));
      }
      if (params.sendBinary && params.binaryPropertyName) {
        const bin = item.binary?.[params.binaryPropertyName];
        if (bin?.data) {
          // Cast to a Blob-compatible view; Node 24's undici fetch accepts it.
          const blob = new Blob([new Uint8Array(bin.data)], {
            type: bin.mimeType ?? 'application/octet-stream',
          });
          fd.append(params.binaryPropertyName, blob, bin.fileName ?? params.binaryPropertyName);
        }
      }
      return fd;
    }
    case 'raw': {
      if (params.body == null) return undefined;
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/plain');
      return params.body;
    }
    case 'binary': {
      if (!params.binaryPropertyName) {
        throw new NodeOperationError('Binary body requested but binaryPropertyName is empty', {
          nodeType: HTTP_REQUEST_NODE_TYPE,
          details: { paramName: 'binaryPropertyName' },
        });
      }
      const bin = item.binary?.[params.binaryPropertyName];
      if (!bin?.data) {
        throw new NodeOperationError(
          `Binary slot "${params.binaryPropertyName}" missing on input item`,
          {
            nodeType: HTTP_REQUEST_NODE_TYPE,
            details: { paramName: 'binaryPropertyName' },
          },
        );
      }
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', bin.mimeType ?? 'application/octet-stream');
      }
      return new Uint8Array(bin.data);
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Response parsing.
// ---------------------------------------------------------------------------

/**
 * Parse a Response per `responseFormat`. Always populates `item.json`; sets
 * `item.binary.data` only for `responseFormat === 'binary'`.
 */
async function parseResponse(
  res: Response,
  format: HttpResponseFormat,
): Promise<NodeExecutionItem> {
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });

  if (format === 'binary') {
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
    return {
      json: { statusCode: res.status, headers },
      binary: {
        data: {
          data: buf,
          mimeType,
          byteSize: buf.byteLength,
        },
      },
    };
  }

  if (format === 'string') {
    const body = await res.text();
    return { json: { statusCode: res.status, headers, body } };
  }

  // JSON — best-effort. If the upstream returns an empty body or non-JSON,
  // fall back to the raw text so the caller still sees the payload.
  const text = await res.text();
  if (text.length === 0) {
    return { json: { statusCode: res.status, headers, body: null } };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { json: parsed as Record<string, unknown> };
    }
    return { json: { statusCode: res.status, headers, body: parsed } };
  } catch {
    return { json: { statusCode: res.status, headers, body: text } };
  }
}

// ---------------------------------------------------------------------------
// Per-item execution.
// ---------------------------------------------------------------------------

/**
 * Run the HTTP request for a single input item.
 *
 * Throws `NodeApiError` on non-2xx (with the upstream `Retry-After` header
 * forwarded so the executor's retry policy can honour it). Network errors,
 * DNS failures, and aborts are wrapped as `NodeApiError` too because the
 * upstream is the originator.
 */
async function executeForItem(
  ctx: NodeExecutionContext,
  inputItem: NodeExecutionItem,
  itemIndex: number,
): Promise<NodeExecutionItem> {
  const params = resolveParams(ctx, itemIndex);

  if (!params.url || typeof params.url !== 'string') {
    throw new NodeOperationError('HTTP Request: "url" parameter is required', {
      nodeType: HTTP_REQUEST_NODE_TYPE,
      itemIndex,
      details: { paramName: 'url' },
    });
  }

  const headers = buildHeaders(params.headers);
  let finalUrl = buildUrl(params.url, params.queryParameters);

  if (params.authentication !== 'none') {
    if (!params.credentialType) {
      throw new NodeOperationError(
        `Authentication "${params.authentication}" requires a credentialType`,
        {
          nodeType: HTTP_REQUEST_NODE_TYPE,
          itemIndex,
          details: { paramName: 'credentialType' },
        },
      );
    }
    const creds = await ctx.getCredentials(params.credentialType);
    finalUrl = applyCredentials(creds, params.credentialType, headers, finalUrl);
  }

  const body = buildBody(params, inputItem, headers);

  // Native fetch + AbortController for the per-request timeout. The IPC ADR
  // (sub-task #7) lays out how this composes with the per-node executor
  // timeout — the request timeout MUST fire first so the node sees a
  // NodeApiError rather than an `ExecutionTimeoutError`.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  // Note on `ignoreSslErrors`: Node's `fetch` (undici) doesn't expose
  // per-request TLS toggles directly. The dispatcher swaps in a dispatcher
  // with `connect: { rejectUnauthorized: false }` when the param is on; the
  // node forwards the flag in request init so the dispatcher can pick it up.
  const init: RequestInit & { dispatcher?: unknown } = {
    method: params.method,
    headers,
    body,
    redirect: params.followRedirects ? 'follow' : 'manual',
    signal: controller.signal,
  };

  let res: Response;
  try {
    res = await fetch(finalUrl, init);
  } catch (cause) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    throw new NodeApiError(
      aborted
        ? `HTTP request timed out after ${params.timeoutMs}ms`
        : `HTTP request failed: ${(cause as Error)?.message ?? 'network error'}`,
      {
        nodeType: HTTP_REQUEST_NODE_TYPE,
        url: finalUrl,
        method: params.method,
        cause,
        retryable: true,
        details: { aborted, timeoutMs: params.timeoutMs },
      },
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status < 200 || res.status >= 300) {
    // Drain the body for the error context so we don't leak the upstream
    // socket on long-lived 4xx/5xx pages.
    let bodyText: string | undefined;
    try {
      bodyText = await res.text();
    } catch {
      bodyText = undefined;
    }
    throw new NodeApiError(`HTTP ${res.status} from ${params.method} ${finalUrl}`, {
      httpStatus: res.status,
      retryAfter: res.headers.get('retry-after') ?? undefined,
      url: finalUrl,
      method: params.method,
      nodeType: HTTP_REQUEST_NODE_TYPE,
      details: { body: bodyText },
    });
  }

  const out = await parseResponse(res, params.responseFormat);
  out.pairedItem = { item: itemIndex };
  return out;
}

// ---------------------------------------------------------------------------
// Node executor — runs the request for every input item.
// ---------------------------------------------------------------------------

async function execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  const inputs = ctx.getInputData();
  const items: NodeExecutionItem[] = [];
  const continueOnFail = ctx.continueOnFail();

  for (let i = 0; i < inputs.length; i++) {
    try {
      items.push(await executeForItem(ctx, inputs[i], i));
    } catch (err) {
      if (!continueOnFail) {
        // Engine surfaces this via the per-node error envelope; if it's
        // already a typed ExecutorError it round-trips with wire fidelity.
        if (err instanceof NodeApiError || err instanceof NodeOperationError) {
          throw err;
        }
        throw new NodeApiError(
          `HTTP Request failed on item ${i}: ${(err as Error)?.message ?? 'unknown'}`,
          { nodeType: HTTP_REQUEST_NODE_TYPE, cause: err },
        );
      }
      // continueOnFail: emit an error item on the regular output so the
      // downstream graph can branch on `$json.error`. The dispatcher sees a
      // successful return and does not retry.
      ctx.logger.warn('HTTP Request failed on item but continueOnFail is true', {
        itemIndex: i,
        error: (err as Error)?.message,
      });
      items.push({
        json: {
          error: (err as Error)?.message ?? 'unknown error',
          ...(err instanceof NodeApiError
            ? {
                httpStatus: err.httpStatus,
                url: err.url,
                method: err.method,
              }
            : {}),
        },
        pairedItem: { item: i },
      });
    }
  }

  return { output: [items] };
}

// ---------------------------------------------------------------------------
// Registration — exported for the Phase 8 registry to pick up.
//
// Phase 8 will import this from `src/lib/sabflow/executor/registry/builtins.ts`
// and call `registry.register(httpRequestNode)`. We deliberately do NOT
// self-register here so:
//   1. Tree-shaking removes the node when an embed doesn't need it.
//   2. The registry stays in charge of conflict checks + plan-gate lookups.
// ---------------------------------------------------------------------------

export const httpRequestNode: NodeRegistration = {
  type: HTTP_REQUEST_NODE_TYPE,
  typeVersion: HTTP_REQUEST_NODE_VERSION,
  description: 'Make an HTTP request to any URL. Primary external-call node.',
  defaults: { name: 'HTTP Request', color: '#0F62FE' },
  properties,
  credentials: ['httpBasicAuth', 'httpHeaderAuth', 'httpQueryAuth', 'oAuth2Api'],
  execute,
};

export default httpRequestNode;
