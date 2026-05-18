/**
 * SabFlow node-execution contract.
 *
 * Mirrors n8n's per-node execution surface so that workflows imported from
 * n8n behave identically inside SabFlow's executor. Sibling crate
 * `rust/crates/sabflow-executor/` owns the Rust mirror of these shapes; this
 * file is the canonical TypeScript definition and any drift must be resolved
 * here first.
 *
 * Track B Phase 1 (sub-task #2 of 10) — Foundation & contract.
 *
 * // n8n parity:
 * //   NodeExecutionInput            ~ n8n `INodeExecutionData` (single bag / batch entry)
 * //   NodeExecutionItem             ~ n8n `INodeExecutionData` (one item with json + binary)
 * //   NodeExecutionContext          ~ n8n `IExecuteFunctions`
 * //   NodeExecutionContext.helpers  ~ n8n `IExecuteFunctions.helpers` (subset)
 * //   NodeExecutionResult           ~ return type of n8n `INodeType.execute()` (`INodeExecutionData[][] | null`)
 * //   NodeExecutor                  ~ n8n `INodeType.execute`
 * //   NodeRegistration              ~ n8n `INodeType` + `INodeTypeDescription`
 * //   NodeError                     ~ n8n `NodeApiError` / `NodeOperationError`
 * //   NodePropertyDef               ~ n8n `INodeProperties`
 * //   NodeCredentialRequest         ~ n8n `ICredentialDataDecryptedObject`
 * //   NodeLogger                    ~ n8n `Logger` (Pino-compat)
 */

/**
 * Binary attachment payload carried alongside a JSON item.
 *
 * Mirrors n8n's `IBinaryData` minimally: a raw buffer plus metadata required
 * to route the byte stream to SabFiles or to a downstream HTTP node. The
 * executor stores buffers off-heap when above the inline threshold; nodes
 * should not assume `data` is always populated for large attachments.
 */
export interface NodeBinaryData {
  /** Raw bytes for the attachment. May be undefined when the executor has spilled it to disk / SabFiles. */
  data?: Buffer;
  /** MIME type (e.g. `application/pdf`, `image/png`). */
  mimeType: string;
  /** Original filename, when known. */
  fileName?: string;
  /** Lowercase file extension without leading dot (e.g. `pdf`). */
  fileExtension?: string;
  /** SabFiles reference id when the payload has been promoted to library storage. */
  sabFileId?: string;
  /** Size in bytes (authoritative; `data?.length` may be absent). */
  byteSize?: number;
}

/**
 * A single execution item flowing on a node port.
 *
 * Equivalent to a single n8n `INodeExecutionData`. The `json` field is the
 * primary payload; `binary` is a map of attachment slot → binary blob. A
 * `pinned` item originated from the editor's "pin data" feature and must be
 * preserved verbatim through retries.
 */
export interface NodeExecutionItem {
  /** Free-form JSON payload for this item. Nodes set their own schema. */
  json: Record<string, unknown>;
  /** Optional named binary attachments (slot name → blob). */
  binary?: Record<string, NodeBinaryData>;
  /** True when this item was injected by the editor's pin-data feature. */
  pinned?: boolean;
  /** Optional ancestry trail for "retry from failed node" + lineage views. */
  pairedItem?: { item: number; input?: number } | Array<{ item: number; input?: number }>;
}

/**
 * Raw input bag delivered to a node before it is normalised into items.
 *
 * Roughly mirrors what n8n hands to a node prior to `getInputData()`
 * unpacking. Most nodes should call `ctx.getInputData()` rather than
 * consuming this directly.
 */
export interface NodeExecutionInput {
  /** Untyped JSON payload (may be a single object, an array, or null). */
  json: unknown;
  /** Optional binary attachments keyed by slot. */
  binary?: Record<string, Buffer>;
  /** Whether this input was pinned by the editor (skip live re-fetch). */
  pinned?: boolean;
}

/**
 * Workflow + execution metadata exposed to nodes via the data proxy.
 *
 * Mirrors the read-only fields n8n exposes through `$workflow`, `$execution`
 * and `$node`. Returned by `ctx.getWorkflowDataProxy(itemIndex)` and is also
 * passed into the expression engine as the evaluation root.
 */
export interface NodeExecutionDataProxy {
  /** Resolved `$json` for the requested item index. */
  $json: Record<string, unknown>;
  /** Map of upstream node name → its last-emitted item for the same index. */
  $node: Record<string, NodeExecutionItem | undefined>;
  /** Workflow-level metadata (id, name, active flag). */
  $workflow: {
    id: string;
    name: string;
    active: boolean;
  };
  /** Execution-level metadata (id, mode, retry count). */
  $execution: {
    id: string;
    mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'integrated';
    resumeUrl?: string;
    retryOf?: string;
  };
  /** Current wall-clock time captured at evaluation start. */
  $now: Date;
  /** Today (midnight, executor TZ) captured at evaluation start. */
  $today: Date;
  /** Item index inside the input batch. */
  $itemIndex: number;
}

/**
 * Decrypted credentials handed to a node at runtime.
 *
 * n8n parity: `ICredentialDataDecryptedObject`. The executor decrypts the
 * stored secret using the workspace KMS key and injects it just-in-time;
 * nodes must never persist or log this object.
 */
export type NodeCredentialRequest = Record<string, string | number | boolean | null | undefined>;

/**
 * HTTP request options accepted by `ctx.helpers.httpRequest`.
 *
 * Mirrors n8n's `IHttpRequestOptions` (Axios-shape). Kept intentionally
 * minimal — the executor implementation may extend at runtime, but anything
 * that crosses the contract boundary must be declared here.
 */
export interface NodeHttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  qs?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  json?: boolean;
  timeout?: number;
  /** Return raw bytes instead of parsing as JSON / text. */
  encoding?: 'arraybuffer' | 'utf8' | null;
  /** When set, the response is streamed into a SabFiles-bound binary slot. */
  returnFullResponse?: boolean;
  /** Disable TLS verification (rare; allowed for self-hosted webhooks). */
  rejectUnauthorized?: boolean;
}

/**
 * Pino-compatible logger surface exposed to nodes.
 *
 * n8n parity: `Logger`. Matches Pino's log-level signature so that downstream
 * sinks (OTEL exporter, Grafana Loki) can ingest without remapping.
 */
export interface NodeLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Helpers attached to the execution context.
 *
 * n8n parity: `IExecuteFunctions.helpers` (subset). Phase 1 deliberately
 * limits this to the HTTP helper; binary + SabFiles helpers land in
 * Phase 3 alongside the first nodes that need them.
 */
export interface NodeExecutionHelpers {
  /**
   * Perform an outbound HTTP request from a node, using the executor's
   * shared connection pool, retry policy, and OTEL instrumentation.
   *
   * Returns the parsed body when `options.json === true` (default), the raw
   * buffer when `encoding === 'arraybuffer'`, or the full response envelope
   * when `returnFullResponse === true`.
   */
  httpRequest(options: NodeHttpRequestOptions): Promise<unknown>;
}

/**
 * Per-invocation execution context handed to a node's `execute()` function.
 *
 * Mirrors n8n's `IExecuteFunctions`. Methods are intentionally synchronous
 * where n8n is synchronous so that ported nodes need no signature changes.
 *
 * Lifetime: scoped to a single node run inside a single execution. Holding
 * a reference past the returned promise is undefined behaviour.
 */
export interface NodeExecutionContext {
  /**
   * Return the input items for this node, normalised into the canonical
   * `NodeExecutionItem` shape. When `inputIndex` is omitted, returns the
   * primary input (port 0).
   */
  getInputData(inputIndex?: number): NodeExecutionItem[];

  /**
   * Resolve a parameter defined in the node's property schema, evaluating
   * any embedded `{{ }}` expressions against the item at `itemIndex`.
   *
   * `defaultValue` is returned when the parameter is absent AND no static
   * default was declared in `NodePropertyDef.default`.
   */
  getNodeParameter<T = unknown>(name: string, itemIndex: number, defaultValue?: T): T;

  /**
   * Fetch a decrypted credential of the given type for the current node.
   * Throws when the node does not declare `credentials` containing `type`
   * or when the workspace has not provisioned a matching credential.
   */
  getCredentials(type: string): Promise<NodeCredentialRequest>;

  /**
   * Build the data proxy bound to `itemIndex`. Used by the expression
   * engine and exposed to Function / Code nodes as the `$` root.
   */
  getWorkflowDataProxy(itemIndex: number): NodeExecutionDataProxy;

  /** Helpers (HTTP, future: binary, SabFiles). */
  helpers: NodeExecutionHelpers;

  /**
   * Whether the node is configured to swallow errors and emit them on the
   * error output instead of aborting the execution. n8n parity:
   * `IExecuteFunctions.continueOnFail()`.
   */
  continueOnFail(): boolean;

  /** Pino-compatible structured logger. */
  logger: NodeLogger;
}

/**
 * Failure envelope returned by a node when it errors deterministically.
 *
 * n8n parity: union of `NodeApiError` / `NodeOperationError` flattened to a
 * serialisable shape so it crosses the Node↔Rust IPC boundary cleanly.
 * Non-deterministic crashes (panic / unhandled rejection) are captured by
 * the executor itself and synthesised into this shape.
 */
export interface NodeError {
  /** Stable machine-readable code (e.g. `NODE_API_ERROR`, `RATE_LIMITED`). */
  code: string;
  /** Human-readable message safe to surface in the editor. */
  message: string;
  /** Captured stack trace (omitted in production responses). */
  stack?: string;
  /**
   * Whether the dispatcher should retry per the node's retry policy.
   * `false` short-circuits the retry loop (e.g. 4xx validation errors).
   */
  retryable?: boolean;
  /** HTTP status when the failure originated from an outbound request. */
  httpStatus?: number;
  /** Cause chain for nested errors (preserves n8n's `cause` field). */
  cause?: NodeError;
  /** Free-form structured context (request id, vendor error code, etc.). */
  context?: Record<string, unknown>;
}

/**
 * Result returned by a node executor.
 *
 * `output` is a 2-D array: outer index = output port, inner = items emitted
 * on that port. This matches n8n's `INodeExecutionData[][]`. A populated
 * `error` indicates the node failed; the dispatcher decides whether to
 * route items to the error port (when `continueOnFail()`) or abort.
 */
export interface NodeExecutionResult {
  output: NodeExecutionItem[][];
  error?: NodeError;
}

/**
 * Property schema entry declared on a node registration.
 *
 * n8n parity: `INodeProperties`. Kept narrow for Phase 1; the property
 * editor module (Track A Phase 6) will extend this with display
 * conditionals (`displayOptions`) and the full type union.
 */
export interface NodePropertyDef {
  displayName: string;
  name: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'options'
    | 'multiOptions'
    | 'collection'
    | 'fixedCollection'
    | 'json'
    | 'dateTime'
    | 'color';
  default?: unknown;
  description?: string;
  required?: boolean;
  options?: Array<{ name: string; value: string | number | boolean }>;
  placeholder?: string;
  noDataExpression?: boolean;
}

/**
 * Function signature implemented by every node.
 *
 * n8n parity: `INodeType.execute`. Async so HTTP / IO can be awaited; the
 * dispatcher wraps the call in a per-node timeout and OTEL span.
 */
export type NodeExecutor = (ctx: NodeExecutionContext) => Promise<NodeExecutionResult>;

/**
 * Default parameter / setting values applied when a node is dropped onto
 * the canvas. n8n parity: `INodeTypeDescription.defaults`.
 */
export interface NodeRegistrationDefaults {
  name: string;
  color?: string;
}

/**
 * Full node registration shipped to the executor + editor.
 *
 * n8n parity: `INodeType` (the implementation) merged with the static
 * fields of `INodeTypeDescription` (display + schema). Used by:
 *   - the executor to dispatch `execute()` per node,
 *   - the editor to render property panels,
 *   - the migration tool to map imported n8n nodes 1:1.
 */
export interface NodeRegistration {
  /** Stable type identifier (e.g. `sabflow.httpRequest`). */
  type: string;
  /** Schema / behaviour version; bumped on breaking property changes. */
  typeVersion: number;
  /** Short description surfaced in the node picker. */
  description: string;
  /** Editor defaults applied on insert. */
  defaults: NodeRegistrationDefaults;
  /** Ordered property definitions rendered in the side panel. */
  properties: NodePropertyDef[];
  /** Credential type names this node may request via `ctx.getCredentials`. */
  credentials?: string[];
  /** Runtime executor. */
  execute: NodeExecutor;
}
