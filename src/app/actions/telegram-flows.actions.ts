'use server';

/**
 * Server-action surface for the Telegram Flows visual editor.
 *
 * Each action calls the Rust BFF (`/v1/telegram/flows`) and falls back to
 * direct Mongo when the Rust handler is unavailable (404 / 5xx / network).
 * The flow runner in `src/lib/telegram/flow-runner.ts` reads Mongo
 * directly, so direct writes propagate immediately.
 *
 * Collections used by the fallback:
 *   - `telegram_flows`           — flow rows
 *   - `telegram_flow_versions`   — published-version snapshots
 *   - `telegram_flow_runs`       — execution traces
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { RustApiError } from '@/lib/rust-client';
import { telegramFlowsApi } from '@/lib/rust-client/telegram-flows';
import type {
  AckResult,
  CreateBody,
  FlowResp,
  FlowRow,
  FlowStatus,
  ListResp,
  RunRow,
  RunsResp,
  TestBody,
  TestResp,
  UpdateBody,
  VersionResp,
  VersionRow,
  VersionsResp,
} from '@/lib/rust-client/telegram-flows';
import { getSession } from './user.actions';
import { getProjectById } from './project.actions';
import { withRustFallback } from '@/lib/telegram/rust-fallback';

const PAGE_LIST = '/dashboard/telegram/flows';
const FLOW_COLL = 'telegram_flows';
const VERSION_COLL = 'telegram_flow_versions';
const RUNS_COLL = 'telegram_flow_runs';

function toAck(e: unknown): AckResult {
  if (e instanceof RustApiError) return { success: false, error: e.message };
  return { success: false, error: String(e) };
}

function errMsg(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

async function authProject(
  projectId: string,
): Promise<{ ok: true; userId: ObjectId } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  if (!ObjectId.isValid(projectId)) return { ok: false, error: 'Invalid project id.' };
  const project = await getProjectById(projectId);
  if (!project) return { ok: false, error: 'Access denied.' };
  return { ok: true, userId: new ObjectId(session.user._id) };
}

function toIso(v: unknown): string {
  return v instanceof Date
    ? v.toISOString()
    : typeof v === 'string'
      ? v
      : new Date(0).toISOString();
}

function toFlowRow(doc: Record<string, unknown>): FlowRow {
  return {
    _id: String(doc._id),
    projectId: String(doc.projectId),
    name: String(doc.name ?? ''),
    description: String(doc.description ?? ''),
    status: (doc.status as FlowStatus | string) ?? 'draft',
    version: typeof doc.version === 'number' ? doc.version : 1,
    latestPublishedVersion:
      typeof doc.latestPublishedVersion === 'number' ? doc.latestPublishedVersion : 0,
    trigger: (doc.trigger ?? { kind: 'incoming_message' }) as FlowRow['trigger'],
    nodes: Array.isArray(doc.nodes) ? (doc.nodes as FlowRow['nodes']) : [],
    edges: Array.isArray(doc.edges) ? (doc.edges as FlowRow['edges']) : [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    lastRunAt: doc.lastRunAt instanceof Date
      ? doc.lastRunAt.toISOString()
      : typeof doc.lastRunAt === 'string'
        ? doc.lastRunAt
        : undefined,
    runCount: typeof doc.runCount === 'number' ? doc.runCount : 0,
    errorCount: typeof doc.errorCount === 'number' ? doc.errorCount : 0,
  };
}

function toVersionRow(doc: Record<string, unknown>): VersionRow {
  return {
    version: typeof doc.version === 'number' ? doc.version : 0,
    status: String(doc.status ?? 'published'),
    publishedAt: doc.publishedAt instanceof Date
      ? doc.publishedAt.toISOString()
      : typeof doc.publishedAt === 'string'
        ? doc.publishedAt
        : undefined,
    trigger: (doc.trigger ?? { kind: 'incoming_message' }) as VersionRow['trigger'],
    nodes: Array.isArray(doc.nodes) ? (doc.nodes as VersionRow['nodes']) : [],
    edges: Array.isArray(doc.edges) ? (doc.edges as VersionRow['edges']) : [],
  };
}

function toRunRow(doc: Record<string, unknown>): RunRow {
  const trace = Array.isArray(doc.trace) ? (doc.trace as Array<Record<string, unknown>>) : [];
  return {
    _id: String(doc._id),
    flowId: String(doc.flowId ?? ''),
    projectId: String(doc.projectId ?? ''),
    status: doc.success === false ? 'error' : String(doc.status ?? 'ok'),
    startedAt: toIso(doc.startedAt ?? doc.createdAt),
    finishedAt: doc.finishedAt instanceof Date
      ? doc.finishedAt.toISOString()
      : typeof doc.finishedAt === 'string'
        ? doc.finishedAt
        : undefined,
    durationMs: typeof doc.durationMs === 'number' ? doc.durationMs : undefined,
    error: typeof doc.error === 'string' ? doc.error : undefined,
    steps: trace.map((t) => ({
      nodeId: String(t.nodeId ?? ''),
      nodeType: String(t.nodeType ?? ''),
      status: t.ok === false ? 'error' : 'ok',
      message: typeof t.error === 'string' ? t.error : '',
    })),
  };
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listTelegramFlows(params: {
  projectId: string;
  status?: FlowStatus | '';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ListResp> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  try {
    return await withRustFallback(
      () =>
        telegramFlowsApi.list({
          projectId: params.projectId,
          status: params.status || undefined,
          search: params.search || undefined,
          page: params.page,
          limit: params.limit,
        }),
      async () => {
        const auth = await authProject(params.projectId);
        if (!auth.ok) {
          return { flows: [], total: 0, page, limit, error: auth.error };
        }
        const { db } = await connectToDatabase();
        const filter: Filter<Record<string, unknown>> = {
          projectId: new ObjectId(params.projectId),
        };
        if (params.status) filter.status = params.status;
        if (params.search) {
          const re = new RegExp(
            params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i',
          );
          (filter as Record<string, unknown> & { $or?: unknown[] }).$or = [
            { name: re },
            { description: re },
          ];
        }
        const skip = Math.max(0, (page - 1) * limit);
        const [docs, total] = await Promise.all([
          db
            .collection(FLOW_COLL)
            .find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection(FLOW_COLL).countDocuments(filter),
        ]);
        return {
          flows: docs.map((d) => toFlowRow(d as unknown as Record<string, unknown>)),
          total,
          page,
          limit,
        };
      },
    );
  } catch (e) {
    return { flows: [], total: 0, page, limit, error: errMsg(e) };
  }
}

export async function createTelegramFlow(body: CreateBody): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.create(body);
        if (res.success) revalidatePath(PAGE_LIST);
        return res;
      },
      async () => {
        const auth = await authProject(body.projectId);
        if (!auth.ok) return { success: false, error: auth.error };
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
          projectId: new ObjectId(body.projectId),
          name: body.name ?? 'Untitled flow',
          description: body.description ?? '',
          status: 'draft' as const,
          version: 1,
          latestPublishedVersion: 0,
          trigger: body.trigger ?? { kind: 'incoming_message' },
          nodes: body.nodes ?? [],
          edges: body.edges ?? [],
          runCount: 0,
          errorCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        const result = await db.collection(FLOW_COLL).insertOne(doc as never);
        revalidatePath(PAGE_LIST);
        return {
          success: true,
          flowId: String(result.insertedId),
          message: 'Draft created.',
        };
      },
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function getTelegramFlow(flowId: string, projectId: string): Promise<FlowResp> {
  try {
    return await withRustFallback(
      () => telegramFlowsApi.get(flowId, projectId),
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { error: auth.error };
        if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const doc = await db.collection(FLOW_COLL).findOne({
          _id: new ObjectId(flowId),
          projectId: new ObjectId(projectId),
        });
        if (!doc) return { error: 'Flow not found.' };
        return { flow: toFlowRow(doc as unknown as Record<string, unknown>) };
      },
    );
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function updateTelegramFlow(flowId: string, body: UpdateBody): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.update(flowId, body);
        if (res.success) {
          revalidatePath(PAGE_LIST);
          revalidatePath(`${PAGE_LIST}/${flowId}`);
        }
        return res;
      },
      async () => {
        const auth = await authProject(body.projectId);
        if (!auth.ok) return { success: false, error: auth.error };
        if (!ObjectId.isValid(flowId)) return { success: false, error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const $set: Record<string, unknown> = { updatedAt: new Date() };
        if (body.name !== undefined) $set.name = body.name;
        if (body.description !== undefined) $set.description = body.description;
        if (body.trigger !== undefined) $set.trigger = body.trigger;
        if (body.nodes !== undefined) $set.nodes = body.nodes;
        if (body.edges !== undefined) $set.edges = body.edges;
        const result = await db.collection(FLOW_COLL).updateOne(
          {
            _id: new ObjectId(flowId),
            projectId: new ObjectId(body.projectId),
          },
          { $set },
        );
        if (result.matchedCount === 0) {
          return { success: false, error: 'Flow not found.' };
        }
        revalidatePath(PAGE_LIST);
        revalidatePath(`${PAGE_LIST}/${flowId}`);
        return { success: true, flowId, message: 'Flow saved.' };
      },
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function deleteTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.delete(flowId, projectId);
        if (res.success) revalidatePath(PAGE_LIST);
        return res;
      },
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { success: false, error: auth.error };
        if (!ObjectId.isValid(flowId)) return { success: false, error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const flowOid = new ObjectId(flowId);
        const projectOid = new ObjectId(projectId);
        const result = await db.collection(FLOW_COLL).deleteOne({
          _id: flowOid,
          projectId: projectOid,
        });
        if (result.deletedCount === 0) {
          return { success: false, error: 'Flow not found.' };
        }
        // Cascade — published-version snapshots become orphans otherwise.
        await db.collection(VERSION_COLL).deleteMany({ flowId: flowOid });
        revalidatePath(PAGE_LIST);
        return { success: true, message: 'Flow deleted.' };
      },
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function publishTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.publish(flowId, projectId);
        if (res.success) {
          revalidatePath(PAGE_LIST);
          revalidatePath(`${PAGE_LIST}/${flowId}`);
        }
        return res;
      },
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { success: false, error: auth.error };
        if (!ObjectId.isValid(flowId)) return { success: false, error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const flowOid = new ObjectId(flowId);
        const projectOid = new ObjectId(projectId);
        const flow = await db.collection(FLOW_COLL).findOne({
          _id: flowOid,
          projectId: projectOid,
        });
        if (!flow) return { success: false, error: 'Flow not found.' };
        const now = new Date();
        const nextVersion =
          typeof (flow as { latestPublishedVersion?: unknown }).latestPublishedVersion === 'number'
            ? ((flow as unknown as { latestPublishedVersion: number }).latestPublishedVersion + 1)
            : 1;
        await db.collection(VERSION_COLL).insertOne({
          flowId: flowOid,
          projectId: projectOid,
          version: nextVersion,
          status: 'published',
          publishedAt: now,
          trigger: (flow as { trigger?: unknown }).trigger ?? { kind: 'incoming_message' },
          nodes: (flow as { nodes?: unknown }).nodes ?? [],
          edges: (flow as { edges?: unknown }).edges ?? [],
        } as never);
        await db.collection(FLOW_COLL).updateOne(
          { _id: flowOid, projectId: projectOid },
          {
            $set: {
              status: 'published',
              latestPublishedVersion: nextVersion,
              version: nextVersion,
              updatedAt: now,
            },
          },
        );
        revalidatePath(PAGE_LIST);
        revalidatePath(`${PAGE_LIST}/${flowId}`);
        return { success: true, flowId, message: 'Flow published.' };
      },
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function enableTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.enable(flowId, projectId);
        if (res.success) revalidatePath(PAGE_LIST);
        return res;
      },
      async () => setFlowStatus(flowId, projectId, 'published', 'Flow enabled.'),
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function disableTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.disable(flowId, projectId);
        if (res.success) revalidatePath(PAGE_LIST);
        return res;
      },
      async () => setFlowStatus(flowId, projectId, 'disabled', 'Flow disabled.'),
    );
  } catch (e) {
    return toAck(e);
  }
}

async function setFlowStatus(
  flowId: string,
  projectId: string,
  status: FlowStatus,
  message: string,
): Promise<AckResult> {
  const auth = await authProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!ObjectId.isValid(flowId)) return { success: false, error: 'Invalid flow id.' };
  const { db } = await connectToDatabase();
  const result = await db.collection(FLOW_COLL).updateOne(
    {
      _id: new ObjectId(flowId),
      projectId: new ObjectId(projectId),
    },
    { $set: { status, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    return { success: false, error: 'Flow not found.' };
  }
  revalidatePath(PAGE_LIST);
  revalidatePath(`${PAGE_LIST}/${flowId}`);
  return { success: true, flowId, message };
}

export async function testTelegramFlow(flowId: string, body: TestBody): Promise<TestResp> {
  try {
    return await telegramFlowsApi.test(flowId, body);
  } catch (e) {
    return {
      success: false,
      steps: [],
      error: errMsg(e),
    };
  }
}

export async function listTelegramFlowVersions(
  flowId: string,
  projectId: string,
): Promise<VersionsResp> {
  try {
    return await withRustFallback(
      () => telegramFlowsApi.listVersions(flowId, projectId),
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { versions: [], error: auth.error };
        if (!ObjectId.isValid(flowId)) return { versions: [] };
        const { db } = await connectToDatabase();
        const docs = await db
          .collection(VERSION_COLL)
          .find({
            flowId: new ObjectId(flowId),
            projectId: new ObjectId(projectId),
          })
          .sort({ version: -1 })
          .limit(50)
          .toArray();
        return {
          versions: docs.map((d) => toVersionRow(d as unknown as Record<string, unknown>)),
        };
      },
    );
  } catch (e) {
    return { versions: [], error: errMsg(e) };
  }
}

export async function getTelegramFlowVersion(
  flowId: string,
  version: number,
  projectId: string,
): Promise<VersionResp> {
  try {
    return await withRustFallback(
      () => telegramFlowsApi.getVersion(flowId, version, projectId),
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { error: auth.error };
        if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const doc = await db.collection(VERSION_COLL).findOne({
          flowId: new ObjectId(flowId),
          projectId: new ObjectId(projectId),
          version,
        });
        if (!doc) return { error: 'Version not found.' };
        return { version: toVersionRow(doc as unknown as Record<string, unknown>) };
      },
    );
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function duplicateTelegramFlow(
  flowId: string,
  projectId: string,
): Promise<AckResult> {
  try {
    return await withRustFallback(
      async () => {
        const res = await telegramFlowsApi.duplicate(flowId, projectId);
        if (res.success) revalidatePath(PAGE_LIST);
        return res;
      },
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { success: false, error: auth.error };
        if (!ObjectId.isValid(flowId)) return { success: false, error: 'Invalid flow id.' };
        const { db } = await connectToDatabase();
        const src = await db.collection(FLOW_COLL).findOne({
          _id: new ObjectId(flowId),
          projectId: new ObjectId(projectId),
        });
        if (!src) return { success: false, error: 'Flow not found.' };
        const now = new Date();
        const baseName = String((src as { name?: unknown }).name ?? 'Untitled flow');
        const doc = {
          projectId: new ObjectId(projectId),
          name: `${baseName} (copy)`,
          description: String((src as { description?: unknown }).description ?? ''),
          status: 'draft' as const,
          version: 1,
          latestPublishedVersion: 0,
          trigger: (src as { trigger?: unknown }).trigger ?? { kind: 'incoming_message' },
          nodes: (src as { nodes?: unknown }).nodes ?? [],
          edges: (src as { edges?: unknown }).edges ?? [],
          runCount: 0,
          errorCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        const result = await db.collection(FLOW_COLL).insertOne(doc as never);
        revalidatePath(PAGE_LIST);
        return {
          success: true,
          flowId: String(result.insertedId),
          message: 'Flow duplicated.',
        };
      },
    );
  } catch (e) {
    return toAck(e);
  }
}

export async function listTelegramFlowRuns(
  flowId: string,
  projectId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<RunsResp> {
  try {
    return await withRustFallback(
      () => telegramFlowsApi.listRuns(flowId, projectId, opts),
      async () => {
        const auth = await authProject(projectId);
        if (!auth.ok) return { runs: [], error: auth.error };
        if (!ObjectId.isValid(flowId)) return { runs: [] };
        const limit = Math.min(opts.limit ?? 50, 200);
        const filter: Filter<Record<string, unknown>> = {
          flowId: new ObjectId(flowId),
          projectId: new ObjectId(projectId),
        };
        if (opts.cursor && ObjectId.isValid(opts.cursor)) {
          filter._id = { $lt: new ObjectId(opts.cursor) };
        }
        const { db } = await connectToDatabase();
        const docs = await db
          .collection(RUNS_COLL)
          .find(filter)
          .sort({ _id: -1 })
          .limit(limit + 1)
          .toArray();
        const hasMore = docs.length > limit;
        const page = hasMore ? docs.slice(0, limit) : docs;
        return {
          runs: page.map((d) => toRunRow(d as unknown as Record<string, unknown>)),
          nextCursor: hasMore ? String(page[page.length - 1]._id) : undefined,
        };
      },
    );
  } catch (e) {
    return { runs: [], error: errMsg(e) };
  }
}
