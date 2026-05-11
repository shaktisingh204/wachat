/**
 * Client for the Telegram Flows visual-flow API on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/flows` by the
 * `telegram-flows` Rust crate. Telegram-scoped flows are stored as a
 * SabFlow-style graph (nodes + edges) with Telegram-specific triggers
 * and node types.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/flows';

// ── Trigger & graph types ────────────────────────────────────────────────────

export type TriggerKind =
  | 'incoming_message'
  | 'command'
  | 'callback_query'
  | 'schedule'
  | 'business_connection';

export type TelegramNodeType =
  | 'send_message'
  | 'send_media'
  | 'send_keyboard'
  | 'wait_for_reply'
  | 'branch_by_text'
  | 'branch_by_callback'
  | 'assign_agent'
  | 'tag_contact'
  | 'set_variable'
  | 'http_request'
  | 'run_subflow'
  | 'end'
  | 'trigger';

export interface TriggerFilter {
  type: 'regex' | 'exact' | 'contains' | 'hasMedia';
  value?: string;
}

export interface FlowTrigger {
  kind: TriggerKind | string;
  filter?: TriggerFilter;
  command?: string;
  dataPrefix?: string;
  cron?: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: TelegramNodeType | string;
  position: NodePosition;
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export type FlowStatus = 'draft' | 'published' | 'disabled';

export interface FlowRow {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  status: FlowStatus | string;
  version: number;
  latestPublishedVersion: number;
  trigger: FlowTrigger;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
  errorCount: number;
}

// ── Response envelopes ───────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface AckResult {
  success: boolean;
  error?: string;
  message?: string;
  flowId?: string;
  validationErrors?: ValidationError[];
}

export interface ListResp {
  flows: FlowRow[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export interface FlowResp {
  flow?: FlowRow;
  error?: string;
}

export interface VersionRow {
  version: number;
  status: string;
  publishedAt?: string;
  trigger: FlowTrigger;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface VersionsResp {
  versions: VersionRow[];
  error?: string;
}

export interface VersionResp {
  version?: VersionRow;
  error?: string;
}

export interface TestStep {
  nodeId: string;
  nodeType: string;
  status: string;
  message: string;
  output?: unknown;
}

export interface TestResp {
  success: boolean;
  steps: TestStep[];
  error?: string;
}

export interface SimulatedMessage {
  text?: string;
  callbackData?: string;
  command?: string;
}

export interface RunRow {
  _id: string;
  flowId: string;
  projectId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  steps: TestStep[];
}

export interface RunsResp {
  runs: RunRow[];
  nextCursor?: string;
  error?: string;
}

// ── Request bodies ───────────────────────────────────────────────────────────

export interface ListQuery {
  projectId: string;
  status?: FlowStatus | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateBody {
  projectId: string;
  name?: string;
  description?: string;
  trigger?: FlowTrigger;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
}

export interface UpdateBody {
  projectId: string;
  name?: string;
  description?: string;
  trigger?: FlowTrigger;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
}

export interface TestBody {
  projectId: string;
  botId?: string;
  simulatedMessage: SimulatedMessage;
}

// ── Legacy quick-reply types (deprecated, kept for source compatibility) ─────
// The `telegram-flows` crate previously hosted quick-reply CRUD. The flow-graph
// API has replaced that surface, but a handful of server-action wrappers still
// import these type names. Re-exporting them as aliases avoids unrelated build
// breakage; new callers should not reach for them.

/** @deprecated quick-reply rows are no longer served — kept for type-name continuity. */
export type ReplyRow = {
  _id: string;
  projectId: string;
  shortcut: string;
  text: string;
  parseMode?: string;
  createdAt: string;
  updatedAt: string;
};
/** @deprecated quick-reply upsert body — kept for type-name continuity. */
export interface UpsertBody {
  projectId: string;
  replyId?: string;
  shortcut: string;
  text: string;
  parseMode?: string;
}

// ── Public namespace ─────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const telegramFlowsApi = {
  /** `GET /v1/telegram/flows/?projectId=…&status=&search=&page=&limit=` */
  list: (q: ListQuery) =>
    rustFetch<ListResp>(
      `${BASE}/${qs({
        projectId: q.projectId,
        status: q.status,
        search: q.search,
        page: q.page,
        limit: q.limit,
      })}`,
    ),

  /** `POST /v1/telegram/flows/` — create draft. */
  create: (body: CreateBody) =>
    rustFetch<AckResult>(`${BASE}/`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** `GET /v1/telegram/flows/{flowId}?projectId=…` */
  get: (flowId: string, projectId: string) =>
    rustFetch<FlowResp>(
      `${BASE}/${encodeURIComponent(flowId)}${qs({ projectId })}`,
    ),

  /** `PUT /v1/telegram/flows/{flowId}` — update (drafts only). */
  update: (flowId: string, body: UpdateBody) =>
    rustFetch<AckResult>(`${BASE}/${encodeURIComponent(flowId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  /** `DELETE /v1/telegram/flows/{flowId}?projectId=…` */
  delete: (flowId: string, projectId: string) =>
    rustFetch<AckResult>(
      `${BASE}/${encodeURIComponent(flowId)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),

  /** `POST /v1/telegram/flows/{flowId}/publish` — validates + bumps version. */
  publish: (flowId: string, projectId: string) =>
    rustFetch<AckResult>(`${BASE}/${encodeURIComponent(flowId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),

  /** `POST /v1/telegram/flows/{flowId}/enable` */
  enable: (flowId: string, projectId: string) =>
    rustFetch<AckResult>(`${BASE}/${encodeURIComponent(flowId)}/enable`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),

  /** `POST /v1/telegram/flows/{flowId}/disable` */
  disable: (flowId: string, projectId: string) =>
    rustFetch<AckResult>(`${BASE}/${encodeURIComponent(flowId)}/disable`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),

  /** `POST /v1/telegram/flows/{flowId}/test` — simulated run, no side effects. */
  test: (flowId: string, body: TestBody) =>
    rustFetch<TestResp>(`${BASE}/${encodeURIComponent(flowId)}/test`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** `GET /v1/telegram/flows/{flowId}/versions?projectId=…` */
  listVersions: (flowId: string, projectId: string) =>
    rustFetch<VersionsResp>(
      `${BASE}/${encodeURIComponent(flowId)}/versions${qs({ projectId })}`,
    ),

  /** `GET /v1/telegram/flows/{flowId}/versions/{version}?projectId=…` */
  getVersion: (flowId: string, version: number, projectId: string) =>
    rustFetch<VersionResp>(
      `${BASE}/${encodeURIComponent(flowId)}/versions/${version}${qs({ projectId })}`,
    ),

  /** `POST /v1/telegram/flows/{flowId}/duplicate` */
  duplicate: (flowId: string, projectId: string) =>
    rustFetch<AckResult>(`${BASE}/${encodeURIComponent(flowId)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),

  /** `GET /v1/telegram/flows/{flowId}/runs?projectId=…&cursor=&limit=` */
  listRuns: (
    flowId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) =>
    rustFetch<RunsResp>(
      `${BASE}/${encodeURIComponent(flowId)}/runs${qs({
        projectId,
        cursor: opts.cursor,
        limit: opts.limit,
      })}`,
    ),

  /** @deprecated quick-reply upsert is no longer supported by this crate. */
  upsert: (_body: UpsertBody): Promise<AckResult> =>
    Promise.resolve({
      success: false,
      error: 'Quick-reply upsert was removed in favour of visual flows.',
    }),
};

export type TelegramFlowsApi = typeof telegramFlowsApi;
