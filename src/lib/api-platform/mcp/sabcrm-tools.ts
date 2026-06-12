/**
 * SabNode MCP — SabCRM tool registry.
 *
 * Each entry exposes one SabCRM capability to an MCP host. The tools are
 * deliberately thin adapters over the **same** Rust SabCRM engine the
 * dashboard uses (`/v1/sabcrm/*`, crates `sabcrm-objects` /
 * `sabcrm-records` / `sabcrm-pipelines` / `sabcrm-activities` /
 * `sabcrm-approvals`): wire shapes are imported verbatim from the
 * session-cookie clients in `src/lib/rust-client/sabcrm-*.ts`, but calls
 * go through {@link rustFetchAsUser} because MCP requests carry an API key,
 * not a session cookie.
 *
 * Tenancy: `verifyApiKey` resolves the key to its owning user upstream;
 * every tool additionally takes a required `projectId` argument that is
 * validated against the key owner's project membership via
 * `GET /v1/projects/{id}` (the Rust handler enforces the owner-or-agent
 * check — the same membership rule the gated server actions apply via
 * `getCachedProjects`). A non-member `projectId` yields an in-band tool
 * error, never data.
 *
 * Scopes: read tools require `sabcrm:read`; mutations require
 * `sabcrm:write` (registered in `tools/api-codegen/generate-scopes.ts`).
 *
 * Stage governance: `move_record_stage` evaluates the SAME stage-gate
 * logic as the dashboard's `checkSabcrmStageMove` server action — both
 * call {@link evaluateSabcrmStageGate} from
 * `src/lib/sabcrm/stage-gates.server.ts`, here wired to the as-user
 * transport. A blocked gate returns the structured verdict in-band so the
 * calling model can react (fill fields / request approval).
 */

import 'server-only';

import { z, type ZodType } from 'zod';

import { rustFetchAsUser } from '../rust-as-user';
import type { OAuthScope } from '../types';
import { RustApiError } from '@/lib/rust-client';
import { toolJson, toolError, type McpToolResult } from './protocol';

import type { ObjectMetadata } from '@/lib/rust-client/sabcrm-objects';
import type {
  SabcrmRustRecord,
  SabcrmRecordListResponse,
  SabcrmSearchResponse,
} from '@/lib/rust-client/sabcrm-records';
import type { SabcrmRustPipeline } from '@/lib/rust-client/sabcrm-pipelines';
import type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
import type {
  SabcrmApprovalListParams,
  SabcrmApprovalListResponse,
} from '@/lib/rust-client/sabcrm-approvals';
import {
  evaluateSabcrmStageGate,
  findGoverningPipeline,
  type SabcrmStageGateDeps,
} from '@/lib/sabcrm/stage-gates.server';

/* ── Tool definition shape (mirrors ad-manager-tools) ─────────────────────── */

export interface McpTool<S extends ZodType = ZodType> {
  name: string;
  title: string;
  description: string;
  scope: OAuthScope;
  schema: S;
  run: (userId: string, args: z.infer<S>) => Promise<McpToolResult>;
}

/* Helper so `defineTool` keeps each tool's `args` strongly typed. */
function defineTool<S extends ZodType>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}

/* ── Wire helpers (as-user mirrors of the sabcrm-* rust clients) ──────────── */

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const recordsBase = (object: string) =>
  `/v1/sabcrm/records/${encodeURIComponent(object)}`;

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof RustApiError) return e.message || fallback;
  return e instanceof Error ? e.message : fallback;
}

/**
 * Validate that `projectId` is a project the API-key owner is a member of
 * (owner or agent — enforced by the Rust `GET /v1/projects/{id}` handler,
 * the same check the session-gated actions rely on). Returns an in-band
 * tool error to surface when access is denied, or `null` when OK.
 */
async function denyUnlessMember(
  userId: string,
  projectId: string,
): Promise<McpToolResult | null> {
  try {
    const res = await rustFetchAsUser<{ project: unknown | null }>(
      userId,
      `/v1/projects/${encodeURIComponent(projectId)}`,
    );
    if (!res?.project) {
      return toolError(
        `Permission denied: project "${projectId}" was not found or this API key's owner is not a member of it.`,
      );
    }
    return null;
  } catch {
    return toolError(
      `Permission denied: project "${projectId}" was not found or this API key's owner is not a member of it.`,
    );
  }
}

/** Stage-gate deps wired to the as-user transport for `userId`. */
function gateDepsAsUser(userId: string): SabcrmStageGateDeps {
  return {
    async listPipelines(projectId): Promise<SabcrmRustPipeline[]> {
      const res = await rustFetchAsUser<{ pipelines: SabcrmRustPipeline[] }>(
        userId,
        `/v1/sabcrm/pipelines${qs({ projectId })}`,
      );
      return res.pipelines;
    },
    async getRecord(object, id, projectId): Promise<SabcrmRustRecord> {
      const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
        userId,
        `${recordsBase(object)}/${encodeURIComponent(id)}${qs({ projectId })}`,
      );
      return res.record;
    },
    listApprovals(
      projectId,
      params: SabcrmApprovalListParams,
    ): Promise<SabcrmApprovalListResponse> {
      return rustFetchAsUser<SabcrmApprovalListResponse>(
        userId,
        `/v1/sabcrm/approvals${qs({
          projectId,
          status: params.status,
          objectSlug: params.objectSlug,
          recordId: params.recordId,
          pipelineId: params.pipelineId,
          toStageId: params.toStageId,
          page: params.page,
          limit: params.limit,
        })}`,
      );
    },
  };
}

/* ── Shared schema fragments ──────────────────────────────────────────────── */

const projectId = z
  .string()
  .min(1)
  .describe(
    'Required. The SabCRM project (workspace) id the call is scoped to. ' +
      'The API key owner must be a member of this project.',
  );

const objectSlug = z
  .string()
  .min(1)
  .describe(
    'Object slug (e.g. "people", "companies", "leads"). Discover slugs with list_objects.',
  );

const FILTERS_DOC =
  'Structured field filters over the record `data.*` bag. Two wire shapes are accepted: ' +
  '(1) a flat map `{ "<fieldKey>": <condition> }` ANDed together, where a condition is a bare scalar (equality) ' +
  'or `{ "op": <operator>, "value": <v> }`; ' +
  '(2) a nested AND/OR group `{ "op": "and"|"or", "conditions": [ { "field", "operator", "value" } | <nested group> ] }`. ' +
  'Operators: eq, ne, neq, contains, notContains, gt, lt, gte, lte, in, notIn, isEmpty, isNotEmpty ' +
  '(`contains`/`notContains` operands are regex-escaped server-side; isEmpty/isNotEmpty need no value).';

const filters = z.record(z.string(), z.any()).optional().describe(FILTERS_DOC);

/* ── The registry ─────────────────────────────────────────────────────────── */

export const SABCRM_TOOLS: McpTool[] = [
  /* ---- Object metadata --------------------------------------------------- */
  defineTool({
    name: 'list_objects',
    title: 'List CRM objects',
    description:
      'List the SabCRM object metadata for a project: built-in standard objects merged with the project\'s ' +
      'custom objects. Each object carries its slug, labels and full field definitions (key, label, type, ' +
      'options, relation targets) — use this first to learn which objects and data.* fields exist.',
    scope: 'sabcrm:read',
    schema: z.object({ projectId }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ objects: ObjectMetadata[] }>(
          userId,
          `/v1/sabcrm/objects${qs({ projectId: a.projectId })}`,
        );
        return toolJson(res.objects ?? []);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to list objects.'));
      }
    },
  }),

  /* ---- Records ------------------------------------------------------------ */
  defineTool({
    name: 'list_records',
    title: 'List records',
    description:
      'List records of one object, paginated, with optional free-text `q`, structured `filters`, and sorting. ' +
      'Returns `{ records, total }` — each record is `{ id, object, data: {…}, createdAt, updatedAt }`.',
    scope: 'sabcrm:read',
    schema: z.object({
      projectId,
      object: objectSlug,
      q: z
        .string()
        .optional()
        .describe('Free-text query (case-insensitive match over common data.* text fields).'),
      filters,
      sortBy: z
        .string()
        .optional()
        .describe('data.* field key to sort by; omitted → top-level updatedAt.'),
      sortDir: z.enum(['asc', 'desc']).optional(),
      page: z.number().int().positive().optional().describe('1-based page number.'),
      limit: z.number().int().positive().max(200).optional().describe('Page size (default 50, max 200).'),
      enrich: z
        .boolean()
        .optional()
        .describe('When true, resolve relation/actor ids to { id, label } hints (__relations / __actors).'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const hasFilters = a.filters !== undefined && Object.keys(a.filters).length > 0;
        const res = await rustFetchAsUser<SabcrmRecordListResponse>(
          userId,
          `${recordsBase(a.object)}${qs({
            projectId: a.projectId,
            q: a.q,
            sortBy: a.sortBy,
            sortDir: a.sortDir,
            page: a.page,
            limit: a.limit,
            filters: hasFilters ? JSON.stringify(a.filters) : undefined,
            enrich: a.enrich ? 'relations' : undefined,
          })}`,
        );
        return toolJson({ records: res.records ?? [], total: res.total ?? 0 });
      } catch (e) {
        return toolError(errMsg(e, 'Failed to list records.'));
      }
    },
  }),
  defineTool({
    name: 'get_record',
    title: 'Get record',
    description:
      'Fetch one record by object slug + id, relation-enriched: MANY_TO_ONE relation fields and the createdBy ' +
      'actor are resolved to { id, label } hints in parallel __relations / __actors maps.',
    scope: 'sabcrm:read',
    schema: z.object({
      projectId,
      object: objectSlug,
      id: z.string().min(1).describe('Hex id of the record.'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
          userId,
          `${recordsBase(a.object)}/${encodeURIComponent(a.id)}${qs({
            projectId: a.projectId,
            enrich: 'relations',
          })}`,
        );
        return toolJson(res.record);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to fetch record.'));
      }
    },
  }),
  defineTool({
    name: 'create_record',
    title: 'Create record',
    description:
      'Create a record of one object. `data` keys must match the object\'s field keys (see list_objects). ' +
      'The API key\'s owning user is recorded as the creator.',
    scope: 'sabcrm:write',
    schema: z.object({
      projectId,
      object: objectSlug,
      data: z
        .record(z.string(), z.any())
        .describe('Field values keyed by the object\'s field keys (free-form per object metadata).'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
          userId,
          recordsBase(a.object),
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: a.projectId,
              data: a.data,
              createdBy: userId,
            }),
          },
        );
        return toolJson(res.record);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to create record.'));
      }
    },
  }),
  defineTool({
    name: 'update_record',
    title: 'Update record',
    description:
      'Merge-update one record\'s `data` (only the keys you pass are changed). Returns the updated record.',
    scope: 'sabcrm:write',
    schema: z.object({
      projectId,
      object: objectSlug,
      id: z.string().min(1).describe('Hex id of the record.'),
      data: z
        .record(z.string(), z.any())
        .describe('Field values to set, keyed by the object\'s field keys.'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
          userId,
          `${recordsBase(a.object)}/${encodeURIComponent(a.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ projectId: a.projectId, data: a.data }),
          },
        );
        return toolJson(res.record);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to update record.'));
      }
    },
  }),
  defineTool({
    name: 'delete_record',
    title: 'Delete record (trash)',
    description:
      'Soft-delete one record by moving it to the trash (sets deletedAt). The record is hidden from normal ' +
      'views but recoverable from the dashboard\'s trash — nothing is permanently destroyed.',
    scope: 'sabcrm:write',
    schema: z.object({
      projectId,
      object: objectSlug,
      id: z.string().min(1).describe('Hex id of the record.'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
          userId,
          `${recordsBase(a.object)}/${encodeURIComponent(a.id)}/trash`,
          { method: 'POST', body: JSON.stringify({ projectId: a.projectId }) },
        );
        return toolJson({ trashed: true, record: res.record });
      } catch (e) {
        return toolError(errMsg(e, 'Failed to trash record.'));
      }
    },
  }),

  /* ---- Global search ------------------------------------------------------ */
  defineTool({
    name: 'search',
    title: 'Search CRM',
    description:
      'Cross-object global search: matches `q` against the common text fields of EVERY object in the project ' +
      '(trashed records excluded) and returns ranked hits `{ object, id, label, snippet? }` (max 50). ' +
      'Follow up with get_record for full data.',
    scope: 'sabcrm:read',
    schema: z.object({
      projectId,
      q: z.string().min(1).describe('Free-text search query.'),
      limit: z.number().int().positive().max(50).optional(),
      mode: z
        .enum(['regex', 'relevance'])
        .optional()
        .describe('Match strategy: "regex" (default, case-insensitive scan) or "relevance" ($text score).'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<SabcrmSearchResponse>(
          userId,
          `/v1/sabcrm/records/search${qs({
            projectId: a.projectId,
            q: a.q,
            limit: a.limit,
            mode: a.mode,
          })}`,
        );
        return toolJson(res.hits ?? []);
      } catch (e) {
        return toolError(errMsg(e, 'Search failed.'));
      }
    },
  }),

  /* ---- Pipelines + stage moves -------------------------------------------- */
  defineTool({
    name: 'list_pipelines',
    title: 'List pipelines',
    description:
      'List the project\'s pipelines. Each pipeline targets one object slug and declares ordered stages ' +
      '`{ id, label, color, requiredFields?, requiresApproval?, kind? }` — stage ids are what ' +
      'move_record_stage expects, and requiredFields/requiresApproval are the stage entry gates.',
    scope: 'sabcrm:read',
    schema: z.object({ projectId }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ pipelines: SabcrmRustPipeline[] }>(
          userId,
          `/v1/sabcrm/pipelines${qs({ projectId: a.projectId })}`,
        );
        return toolJson(res.pipelines ?? []);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to list pipelines.'));
      }
    },
  }),
  defineTool({
    name: 'move_record_stage',
    title: 'Move record to stage',
    description:
      'Move one record into a pipeline stage. The stage\'s entry gates are evaluated FIRST (same logic as the ' +
      'dashboard): missing required fields or an unsatisfied approval gate block the move and return ' +
      '`{ moved: false, gate }` describing what is needed (fill the listed fields via update_record, or have ' +
      'the approval decided in the dashboard). On success returns `{ moved: true, record }`.',
    scope: 'sabcrm:write',
    schema: z.object({
      projectId,
      object: objectSlug,
      recordId: z.string().min(1).describe('Hex id of the record to move.'),
      toStageId: z.string().min(1).describe('Target stage id (see list_pipelines).'),
      pipelineId: z
        .string()
        .optional()
        .describe(
          'Pipeline the stage belongs to. Omitted → resolved automatically (the default pipeline of the ' +
            'object that declares the stage).',
        ),
      stageField: z
        .string()
        .optional()
        .describe('data.* field carrying the stage id. Defaults to "stage" server-side.'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const deps = gateDepsAsUser(userId);

        // 1. Stage gates — the SAME evaluation checkSabcrmStageMove runs.
        const gate = await evaluateSabcrmStageGate(deps, {
          projectId: a.projectId,
          objectSlug: a.object,
          recordId: a.recordId,
          toStageId: a.toStageId,
        });
        if (!gate.ok) {
          const payload = { moved: false, gate };
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            isError: true,
            structuredContent: { data: payload },
          };
        }

        // 2. Resolve the governing pipeline when the caller didn't name one.
        let pipelineId = a.pipelineId;
        if (!pipelineId) {
          const pipelines = await deps.listPipelines(a.projectId);
          const pipeline = findGoverningPipeline(pipelines, a.object, a.toStageId);
          if (!pipeline) {
            return toolError(
              `No pipeline targeting object "${a.object}" declares stage "${a.toStageId}". ` +
                'Pass pipelineId explicitly or check list_pipelines.',
            );
          }
          pipelineId = pipeline.id;
        }

        // 3. Perform the move (the engine re-validates stage membership).
        const res = await rustFetchAsUser<{ record: SabcrmRustRecord }>(
          userId,
          `/v1/sabcrm/pipelines/${encodeURIComponent(pipelineId)}/move-record`,
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: a.projectId,
              recordId: a.recordId,
              stageId: a.toStageId,
              stageField: a.stageField,
            }),
          },
        );
        return toolJson({ moved: true, record: res.record });
      } catch (e) {
        return toolError(errMsg(e, 'Failed to move record.'));
      }
    },
  }),

  /* ---- Activities (record timeline) ---------------------------------------- */
  defineTool({
    name: 'list_activities',
    title: 'List activities',
    description:
      'Read the activity timeline (NOTE / TASK / CALL / MEETING / EMAIL / COMMENT / WHATSAPP entries), newest ' +
      'first. Narrow to one record via object + recordId, or list project-wide by omitting them.',
    scope: 'sabcrm:read',
    schema: z.object({
      projectId,
      object: z.string().optional().describe('Object slug of the record whose timeline to read.'),
      recordId: z.string().optional().describe('Hex id of the record whose timeline to read.'),
      type: z
        .string()
        .optional()
        .describe('Filter by entry kind: NOTE | TASK | CALL | MEETING | EMAIL | COMMENT | WHATSAPP.'),
      limit: z.number().int().positive().max(200).optional().describe('Page size (default 50, max 200).'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ activities: SabcrmRustActivity[] }>(
          userId,
          `/v1/sabcrm/activities${qs({
            projectId: a.projectId,
            targetObject: a.object,
            targetRecordId: a.recordId,
            type: a.type,
            limit: a.limit,
          })}`,
        );
        return toolJson(res.activities ?? []);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to list activities.'));
      }
    },
  }),
  defineTool({
    name: 'log_activity',
    title: 'Log activity',
    description:
      'Append an entry to a record\'s activity timeline (note, task, call, meeting, email or comment). ' +
      'The API key\'s owning user is recorded as the author. TASK entries may carry status / assigneeId / dueAt.',
    scope: 'sabcrm:write',
    schema: z.object({
      projectId,
      object: objectSlug.describe('Object slug of the record this activity attaches to.'),
      recordId: z.string().min(1).describe('Hex id of the record this activity attaches to.'),
      type: z
        .enum(['NOTE', 'TASK', 'CALL', 'MEETING', 'EMAIL', 'COMMENT'])
        .describe('Entry kind.'),
      title: z.string().min(1).describe('Short headline of the entry.'),
      body: z.string().optional().describe('Free-form body text.'),
      status: z
        .enum(['TODO', 'IN_PROGRESS', 'DONE'])
        .optional()
        .describe('TASK-only workflow status.'),
      assigneeId: z.string().optional().describe('TASK-only assignee user id.'),
      dueAt: z.string().optional().describe('TASK-only due date (RFC3339).'),
    }),
    async run(userId, a) {
      const denied = await denyUnlessMember(userId, a.projectId);
      if (denied) return denied;
      try {
        const res = await rustFetchAsUser<{ activity: SabcrmRustActivity }>(
          userId,
          '/v1/sabcrm/activities',
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: a.projectId,
              type: a.type,
              title: a.title,
              body: a.body,
              targetObject: a.object,
              targetRecordId: a.recordId,
              authorId: userId,
              status: a.status,
              assigneeId: a.assigneeId,
              dueAt: a.dueAt,
            }),
          },
        );
        return toolJson(res.activity);
      } catch (e) {
        return toolError(errMsg(e, 'Failed to log activity.'));
      }
    },
  }),
];

/** Fast name → tool lookup. */
export const SABCRM_TOOL_MAP: ReadonlyMap<string, McpTool> = new Map(
  SABCRM_TOOLS.map((t) => [t.name, t]),
);
