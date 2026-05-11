'use server';

/**
 * Server-action wrappers for the rule-based Telegram auto-reply engine
 * exposed by `/v1/telegram/auto-reply`. The dashboard page calls these
 * from a client component — the Rust client itself is server-only.
 *
 * When the Rust BFF is unreachable (404 because the route isn't deployed,
 * or 5xx/network), every action falls back to a direct-Mongo path that
 * reads/writes the `telegram_auto_reply_rules` collection. The webhook
 * runner in `src/lib/telegram/auto-reply.ts` reads Mongo directly, so
 * direct writes propagate immediately without needing the BFF.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    ConflictsResp,
    GetResp,
    ListQuery,
    ListResp,
    MatchBody,
    MatchResp,
    ReorderBody,
    RuleRow,
    RunsResp,
    TestBody,
    TestResp,
    UpsertBody,
} from '@/lib/rust-client/telegram-auto-reply';
import { getSession } from './user.actions';
import { getProjectById } from './project.actions';
import { withRustFallback } from '@/lib/telegram/rust-fallback';

function fail<T extends object>(empty: T, err: unknown): T & { error: string } {
    const msg = err instanceof RustApiError ? err.message : String(err);
    return { ...empty, error: msg };
}

function errMsg(err: unknown): string {
    if (err instanceof RustApiError) return err.message;
    if (err instanceof Error) return err.message;
    return String(err);
}

const PAGE = '/dashboard/telegram/auto-reply';
const COLL = 'telegram_auto_reply_rules';

/** Resolve session and verify project access for Mongo fallbacks. */
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

/** Normalise a Mongo doc to the {@link RuleRow} wire shape. */
function toRuleRow(doc: Record<string, unknown>): RuleRow {
    const toIso = (v: unknown): string =>
        v instanceof Date
            ? v.toISOString()
            : typeof v === 'string'
                ? v
                : new Date(0).toISOString();
    const botIdVal = doc.botId;
    return {
        _id: String(doc._id),
        projectId: String(doc.projectId),
        botId: botIdVal == null ? null : String(botIdVal),
        name: String(doc.name ?? ''),
        status: (doc.status === 'disabled' ? 'disabled' : 'enabled') as RuleRow['status'],
        priority: typeof doc.priority === 'number' ? doc.priority : 0,
        trigger: (doc.trigger ?? { kind: 'keyword' }) as RuleRow['trigger'],
        conditions: Array.isArray(doc.conditions) ? (doc.conditions as RuleRow['conditions']) : [],
        actions: Array.isArray(doc.actions) ? (doc.actions as RuleRow['actions']) : [],
        cooldown: (doc.cooldown ?? {}) as RuleRow['cooldown'],
        runCount: typeof doc.runCount === 'number' ? doc.runCount : 0,
        errorCount: typeof doc.errorCount === 'number' ? doc.errorCount : 0,
        lastRunAt: doc.lastRunAt instanceof Date ? doc.lastRunAt.toISOString() : (typeof doc.lastRunAt === 'string' ? doc.lastRunAt : undefined),
        fired7d: typeof doc.fired7d === 'number' ? doc.fired7d : 0,
        createdAt: toIso(doc.createdAt),
        updatedAt: toIso(doc.updatedAt),
    };
}

// ---------------------------------------------------------------------------
//  Read
// ---------------------------------------------------------------------------

export async function listAutoReplyRulesAction(q: ListQuery): Promise<ListResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramAutoReply.list(q),
            async () => {
                const auth = await authProject(q.projectId);
                const page = q.page ?? 1;
                const pageSize = q.pageSize ?? 50;
                if (!auth.ok) {
                    return { rules: [], total: 0, page, pageSize, error: auth.error };
                }
                const { db } = await connectToDatabase();
                const filter: Filter<Record<string, unknown>> = {
                    projectId: new ObjectId(q.projectId),
                };
                if (q.botId && ObjectId.isValid(q.botId)) {
                    filter.botId = new ObjectId(q.botId);
                }
                if (q.status) filter.status = q.status;
                if (q.search) {
                    const re = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                    (filter as Record<string, unknown> & { $or?: unknown[] }).$or = [
                        { name: re },
                    ];
                }
                const skip = Math.max(0, (page - 1) * pageSize);
                const [docs, total] = await Promise.all([
                    db
                        .collection(COLL)
                        .find(filter)
                        .sort({ priority: 1, createdAt: -1 })
                        .skip(skip)
                        .limit(pageSize)
                        .toArray(),
                    db.collection(COLL).countDocuments(filter),
                ]);
                return {
                    rules: docs.map((d) => toRuleRow(d as unknown as Record<string, unknown>)),
                    total,
                    page,
                    pageSize,
                };
            },
        );
    } catch (e) {
        return fail(
            {
                rules: [],
                total: 0,
                page: q.page ?? 1,
                pageSize: q.pageSize ?? 50,
            } as ListResp,
            e,
        );
    }
}

export async function getAutoReplyRuleAction(
    ruleId: string,
    projectId: string,
): Promise<GetResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramAutoReply.get(ruleId, projectId),
            async () => {
                const auth = await authProject(projectId);
                if (!auth.ok) return { error: auth.error };
                if (!ObjectId.isValid(ruleId)) return { error: 'Invalid rule id.' };
                const { db } = await connectToDatabase();
                const doc = await db.collection(COLL).findOne({
                    _id: new ObjectId(ruleId),
                    projectId: new ObjectId(projectId),
                });
                if (!doc) return { error: 'Rule not found.' };
                return { rule: toRuleRow(doc as unknown as Record<string, unknown>) };
            },
        );
    } catch (e) {
        return fail({} as GetResp, e);
    }
}

export async function listAutoReplyRunsAction(
    ruleId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number } = {},
): Promise<RunsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramAutoReply.runs(ruleId, projectId, opts),
            async () => {
                const auth = await authProject(projectId);
                if (!auth.ok) return { runs: [], error: auth.error };
                if (!ObjectId.isValid(ruleId)) return { runs: [] };
                const limit = Math.min(opts.limit ?? 50, 200);
                const { db } = await connectToDatabase();
                const filter: Filter<Record<string, unknown>> = {
                    ruleId: new ObjectId(ruleId),
                    projectId: new ObjectId(projectId),
                };
                if (opts.cursor && ObjectId.isValid(opts.cursor)) {
                    filter._id = { $lt: new ObjectId(opts.cursor) };
                }
                const docs = await db
                    .collection('telegram_auto_reply_runs')
                    .find(filter)
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .toArray();
                const hasMore = docs.length > limit;
                const page = hasMore ? docs.slice(0, limit) : docs;
                return {
                    runs: page.map((d) => ({
                        _id: String(d._id),
                        ruleId: String((d as { ruleId?: unknown }).ruleId ?? ruleId),
                        projectId: String((d as { projectId?: unknown }).projectId ?? projectId),
                        botId: (d as { botId?: unknown }).botId != null ? String((d as { botId?: unknown }).botId) : undefined,
                        chatId: typeof (d as { chatId?: unknown }).chatId === 'string' ? (d as { chatId?: string }).chatId : undefined,
                        triggerSummary: String((d as { triggerSummary?: unknown }).triggerSummary ?? ''),
                        actionsCount: typeof (d as { actionsCount?: unknown }).actionsCount === 'number' ? (d as unknown as { actionsCount: number }).actionsCount : 0,
                        status: String((d as { status?: unknown }).status ?? 'ok'),
                        firedAt: (d as { firedAt?: unknown }).firedAt instanceof Date
                            ? ((d as unknown as { firedAt: Date }).firedAt).toISOString()
                            : (typeof (d as { firedAt?: unknown }).firedAt === 'string' ? (d as unknown as { firedAt: string }).firedAt : new Date(0).toISOString()),
                    })),
                    nextCursor: hasMore ? String(page[page.length - 1]._id) : undefined,
                };
            },
        );
    } catch (e) {
        return fail({ runs: [] } as RunsResp, e);
    }
}

export async function getAutoReplyConflictsAction(
    projectId: string,
): Promise<ConflictsResp> {
    try {
        return await withRustFallback(
            () => rustClient.telegramAutoReply.conflicts(projectId),
            // Without the analyser there's nothing to surface — return empty.
            async () => ({ pairs: [] }),
        );
    } catch (e) {
        return fail({ pairs: [] } as ConflictsResp, e);
    }
}

// ---------------------------------------------------------------------------
//  Write
// ---------------------------------------------------------------------------

export async function createAutoReplyRuleAction(body: UpsertBody): Promise<AckResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.create(body);
                if (res.success) revalidatePath(PAGE);
                return res;
            },
            async () => {
                const auth = await authProject(body.projectId);
                if (!auth.ok) return { success: false, error: auth.error };
                if (body.botId && !ObjectId.isValid(body.botId)) {
                    return { success: false, error: 'Invalid bot id.' };
                }
                const { db } = await connectToDatabase();
                const now = new Date();
                const doc = {
                    projectId: new ObjectId(body.projectId),
                    botId: body.botId ? new ObjectId(body.botId) : null,
                    name: body.name,
                    status: body.status ?? 'enabled',
                    priority: typeof body.priority === 'number' ? body.priority : 0,
                    trigger: body.trigger,
                    conditions: body.conditions ?? [],
                    actions: body.actions ?? [],
                    cooldown: body.cooldown ?? {},
                    runCount: 0,
                    errorCount: 0,
                    fired7d: 0,
                    createdAt: now,
                    updatedAt: now,
                };
                const result = await db.collection(COLL).insertOne(doc as never);
                revalidatePath(PAGE);
                return {
                    success: true,
                    ruleId: String(result.insertedId),
                    message: 'Rule created.',
                };
            },
        );
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function updateAutoReplyRuleAction(
    ruleId: string,
    body: UpsertBody,
): Promise<AckResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.update(ruleId, body);
                if (res.success) revalidatePath(PAGE);
                return res;
            },
            async () => {
                const auth = await authProject(body.projectId);
                if (!auth.ok) return { success: false, error: auth.error };
                if (!ObjectId.isValid(ruleId)) return { success: false, error: 'Invalid rule id.' };
                if (body.botId && !ObjectId.isValid(body.botId)) {
                    return { success: false, error: 'Invalid bot id.' };
                }
                const { db } = await connectToDatabase();
                const $set: Record<string, unknown> = {
                    name: body.name,
                    trigger: body.trigger,
                    conditions: body.conditions ?? [],
                    actions: body.actions ?? [],
                    cooldown: body.cooldown ?? {},
                    updatedAt: new Date(),
                };
                if (body.status) $set.status = body.status;
                if (typeof body.priority === 'number') $set.priority = body.priority;
                if (body.botId !== undefined) {
                    $set.botId = body.botId ? new ObjectId(body.botId) : null;
                }
                const result = await db
                    .collection(COLL)
                    .updateOne(
                        {
                            _id: new ObjectId(ruleId),
                            projectId: new ObjectId(body.projectId),
                        },
                        { $set },
                    );
                if (result.matchedCount === 0) {
                    return { success: false, error: 'Rule not found.' };
                }
                revalidatePath(PAGE);
                return { success: true, ruleId, message: 'Rule updated.' };
            },
        );
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function deleteAutoReplyRuleAction(
    ruleId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.delete(ruleId, projectId);
                if (res.success) revalidatePath(PAGE);
                return res;
            },
            async () => {
                const auth = await authProject(projectId);
                if (!auth.ok) return { success: false, error: auth.error };
                if (!ObjectId.isValid(ruleId)) return { success: false, error: 'Invalid rule id.' };
                const { db } = await connectToDatabase();
                const result = await db.collection(COLL).deleteOne({
                    _id: new ObjectId(ruleId),
                    projectId: new ObjectId(projectId),
                });
                if (result.deletedCount === 0) {
                    return { success: false, error: 'Rule not found.' };
                }
                revalidatePath(PAGE);
                return { success: true, message: 'Rule deleted.' };
            },
        );
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function setAutoReplyRuleStatusAction(
    ruleId: string,
    projectId: string,
    enabled: boolean,
): Promise<AckResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = enabled
                    ? await rustClient.telegramAutoReply.enable(ruleId, projectId)
                    : await rustClient.telegramAutoReply.disable(ruleId, projectId);
                if (res.success) revalidatePath(PAGE);
                return res;
            },
            async () => {
                const auth = await authProject(projectId);
                if (!auth.ok) return { success: false, error: auth.error };
                if (!ObjectId.isValid(ruleId)) return { success: false, error: 'Invalid rule id.' };
                const { db } = await connectToDatabase();
                const result = await db.collection(COLL).updateOne(
                    {
                        _id: new ObjectId(ruleId),
                        projectId: new ObjectId(projectId),
                    },
                    {
                        $set: {
                            status: enabled ? 'enabled' : 'disabled',
                            updatedAt: new Date(),
                        },
                    },
                );
                if (result.matchedCount === 0) {
                    return { success: false, error: 'Rule not found.' };
                }
                revalidatePath(PAGE);
                return {
                    success: true,
                    message: enabled ? 'Rule enabled.' : 'Rule disabled.',
                };
            },
        );
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function reorderAutoReplyRulesAction(
    body: ReorderBody,
): Promise<AckResult> {
    try {
        return await withRustFallback(
            async () => {
                const res = await rustClient.telegramAutoReply.reorder(body);
                if (res.success) revalidatePath(PAGE);
                return res;
            },
            async () => {
                const auth = await authProject(body.projectId);
                if (!auth.ok) return { success: false, error: auth.error };
                const ids = (body.orderedIds ?? []).filter((id) => ObjectId.isValid(id));
                if (ids.length === 0) return { success: true, message: 'Nothing to reorder.' };
                const { db } = await connectToDatabase();
                const now = new Date();
                const projectOid = new ObjectId(body.projectId);
                await Promise.all(
                    ids.map((id, idx) =>
                        db.collection(COLL).updateOne(
                            { _id: new ObjectId(id), projectId: projectOid },
                            { $set: { priority: idx + 1, updatedAt: now } },
                        ),
                    ),
                );
                revalidatePath(PAGE);
                return { success: true, message: 'Rules reordered.' };
            },
        );
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function testAutoReplyRuleAction(
    ruleId: string,
    body: TestBody,
): Promise<TestResp> {
    try {
        return await rustClient.telegramAutoReply.test(ruleId, body);
    } catch (e) {
        return fail(
            { matched: false, actionsThatWouldFire: [], steps: [] } as TestResp,
            e,
        );
    }
}

export async function matchAutoReplyRulesAction(body: MatchBody): Promise<MatchResp> {
    try {
        return await rustClient.telegramAutoReply.match(body);
    } catch (e) {
        return fail({ matched: [] } as MatchResp, e);
    }
}

// Silence unused-import lint when no other callers rely on `errMsg`.
void errMsg;
