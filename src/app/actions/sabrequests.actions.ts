'use server';

/**
 * SabRequests (Request & Approval Orchestration) — server actions.
 *
 * Companion to the Rust crates `sabrequests-blueprints`,
 * `sabrequests-instances`, `sabrequests-stage-actions`, `sabrequests-orgcharts`.
 *
 * Dual-implementation pattern: when `USE_RUST_SABREQUESTS === 'true'` the
 * server actions route through the Rust BFF (`/v1/sabrequests/*`).
 * Otherwise they fall back to direct Mongo access via
 * `connectToDatabase()`. Both paths use the same `userId` scoping for
 * multi-tenant isolation.
 *
 * Collections (Rust + TS share them):
 *   - `requests_blueprints`
 *   - `requests_instances`
 *   - `requests_stage_actions`
 *   - `requests_orgcharts`
 *
 * TODO (deferred — see report):
 *   - Register RBAC permission keys (`request_blueprint`, `request_instance`).
 *   - Add Vercel Cron sweep for SLA breach detection (sets `breachedAt`).
 *   - Server-side conditional-expression evaluator (today: TS resolves
 *     routing rules + the current stage before POSTing to Rust).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    sabrequestsBlueprintsApi,
    type BlueprintRoutingRule,
    type BlueprintStage,
    type RequestBlueprintCreateInput,
    type RequestBlueprintDoc,
    type RequestBlueprintListParams,
    type RequestBlueprintUpdateInput,
} from '@/lib/rust-client/sabrequests-blueprints';
import {
    sabrequestsInstancesApi,
    type CurrentStageView,
    type RequestInstanceCreateInput,
    type RequestInstanceDoc,
    type RequestInstanceListParams,
    type RequestInstanceUpdateInput,
    type RequestStatus,
    type StageActionKind,
    type StageDecisionInput,
} from '@/lib/rust-client/sabrequests-instances';
import {
    sabrequestsStageActionsApi,
    type StageActionDoc,
} from '@/lib/rust-client/sabrequests-stage-actions';
import {
    sabrequestsOrgchartsApi,
    type OrgChartDoc,
    type OrgChartUpsertInput,
    type OrgChartUpdateInput,
} from '@/lib/rust-client/sabrequests-orgcharts';

function useRust(): boolean {
    return process.env.USE_RUST_SABREQUESTS === 'true';
}

type RustOp = 'list' | 'get' | 'create' | 'update' | 'delete' | 'other';

function reportRustFallback(entity: string, op: RustOp, e: unknown): void {
    console.error(`[sabrequests:${entity}.${op}] rust path failed; falling back:`, e);
    recordRustFallback({
        entity,
        op,
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
    });
}

const BLUEPRINTS_COLL = 'requests_blueprints';
const INSTANCES_COLL = 'requests_instances';
const ACTIONS_COLL = 'requests_stage_actions';
const ORGCHARTS_COLL = 'requests_orgcharts';

const LIST_PATH = '/dashboard/sabrequests';
const BLUEPRINTS_PATH = '/dashboard/sabrequests/blueprints';

/* ─── shared types re-exported for the UI ────────────────────────────── */

export type {
    BlueprintStage,
    BlueprintRoutingRule,
    RequestBlueprintDoc,
    RequestBlueprintCreateInput,
    RequestBlueprintUpdateInput,
    RequestBlueprintListParams,
    RequestInstanceDoc,
    RequestInstanceCreateInput,
    RequestInstanceUpdateInput,
    RequestInstanceListParams,
    RequestStatus,
    StageActionKind,
    StageDecisionInput,
    CurrentStageView,
    StageActionDoc,
    OrgChartDoc,
    OrgChartUpsertInput,
    OrgChartUpdateInput,
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

async function requireUserId(): Promise<ObjectId> {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new Error('Not authenticated');
    }
    return new ObjectId(String(session.user._id));
}

function toObjectIdOrUndef(s?: string): ObjectId | undefined {
    if (!s) return undefined;
    try {
        return new ObjectId(s);
    } catch {
        return undefined;
    }
}

function nowIso(): string {
    return new Date().toISOString();
}

function computeSlaDeadline(stage?: BlueprintStage | null): string | undefined {
    if (!stage?.slaMins || stage.slaMins <= 0) return undefined;
    return new Date(Date.now() + stage.slaMins * 60_000).toISOString();
}

/* =====================================================================
 * BLUEPRINTS
 * ===================================================================*/

export async function listBlueprints(
    params?: RequestBlueprintListParams,
): Promise<{ ok: boolean; data?: RequestBlueprintDoc[]; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsBlueprintsApi.list(params);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('blueprint', 'list', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId,
            archived: { $ne: true },
        };
        if (params?.q) {
            const rx = new RegExp(params.q, 'i');
            filter.$or = [{ name: rx }, { category: rx }];
        }
        if (params?.category) filter.category = params.category;
        if (params?.ownerTeamId) {
            const oid = toObjectIdOrUndef(params.ownerTeamId);
            if (oid) filter.ownerTeamId = oid;
        }
        if (params?.published != null) filter.published = params.published;

        const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
        const page = Math.max(params?.page ?? 1, 1);
        const docs = await db
            .collection(BLUEPRINTS_COLL)
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        return { ok: true, data: docs as unknown as RequestBlueprintDoc[] };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getBlueprintById(
    id: string,
): Promise<{ ok: boolean; data?: RequestBlueprintDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsBlueprintsApi.getById(id);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('blueprint', 'get', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid blueprint id.' };
        const { db } = await connectToDatabase();
        const doc = await db.collection(BLUEPRINTS_COLL).findOne({
            _id: oid,
            userId,
            archived: { $ne: true },
        });
        if (!doc) return { ok: false, error: 'Blueprint not found.' };
        return { ok: true, data: doc as unknown as RequestBlueprintDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function createBlueprint(
    input: RequestBlueprintCreateInput,
): Promise<{ ok: boolean; data?: RequestBlueprintDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsBlueprintsApi.create(input);
                revalidatePath(BLUEPRINTS_PATH);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('blueprint', 'create', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const now = new Date();
        const _id = new ObjectId();
        const doc = {
            _id,
            userId,
            projectId: toObjectIdOrUndef(input.projectId) ?? new ObjectId(),
            name: input.name.trim(),
            description: input.description,
            category: input.category,
            icon: input.icon,
            formSchema: input.formSchema ?? {},
            stages: input.stages ?? [],
            routingRules: input.routingRules ?? [],
            ownerTeamId: toObjectIdOrUndef(input.ownerTeamId),
            slaMins: input.slaMins,
            published: input.published ?? false,
            archived: false,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
        };
        await db.collection(BLUEPRINTS_COLL).insertOne(doc);
        revalidatePath(BLUEPRINTS_PATH);
        return { ok: true, data: doc as unknown as RequestBlueprintDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateBlueprint(
    id: string,
    patch: RequestBlueprintUpdateInput,
): Promise<{ ok: boolean; data?: RequestBlueprintDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsBlueprintsApi.update(id, patch);
                revalidatePath(BLUEPRINTS_PATH);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('blueprint', 'update', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid id.' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = {
            updatedAt: new Date(),
            updatedBy: userId,
            ...patch,
        };
        if (patch.ownerTeamId) {
            set.ownerTeamId = toObjectIdOrUndef(patch.ownerTeamId);
        }
        const res = await db
            .collection(BLUEPRINTS_COLL)
            .findOneAndUpdate(
                { _id: oid, userId, archived: { $ne: true } },
                { $set: set },
                { returnDocument: 'after' },
            );
        revalidatePath(BLUEPRINTS_PATH);
        if (!res) return { ok: false, error: 'Blueprint not found.' };
        return { ok: true, data: res as unknown as RequestBlueprintDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteBlueprint(
    id: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        if (useRust()) {
            try {
                await sabrequestsBlueprintsApi.delete(id);
                revalidatePath(BLUEPRINTS_PATH);
                return { ok: true };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('blueprint', 'delete', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid id.' };
        const { db } = await connectToDatabase();
        await db.collection(BLUEPRINTS_COLL).updateOne(
            { _id: oid, userId },
            {
                $set: {
                    archived: true,
                    deletedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );
        revalidatePath(BLUEPRINTS_PATH);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* =====================================================================
 * INSTANCES (requests)
 * ===================================================================*/

export async function listRequests(
    params?: RequestInstanceListParams,
): Promise<{ ok: boolean; data?: RequestInstanceDoc[]; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsInstancesApi.list(params);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('request_instance', 'list', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId,
            archived: { $ne: true },
        };
        if (params?.q) {
            const rx = new RegExp(params.q, 'i');
            filter.$or = [{ title: rx }, { blueprintName: rx }];
        }
        if (params?.blueprintId) {
            const oid = toObjectIdOrUndef(params.blueprintId);
            if (oid) filter.blueprintId = oid;
        }
        if (params?.status) filter.status = params.status;
        if (params?.mine) filter.requesterId = userId;
        if (params?.awaitingMe) {
            filter.status = 'pending';
            filter['currentStage.approverId'] = userId;
        }
        if (params?.breached) filter.breachedAt = { $ne: null };

        const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
        const page = Math.max(params?.page ?? 1, 1);
        const docs = await db
            .collection(INSTANCES_COLL)
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        return { ok: true, data: docs as unknown as RequestInstanceDoc[] };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getRequestById(
    id: string,
): Promise<{ ok: boolean; data?: RequestInstanceDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsInstancesApi.getById(id);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('request_instance', 'get', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid id.' };
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(INSTANCES_COLL)
            .findOne({ _id: oid, userId, archived: { $ne: true } });
        if (!doc) return { ok: false, error: 'Request not found.' };
        return { ok: true, data: doc as unknown as RequestInstanceDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/**
 * Submit a new request. The caller supplies the blueprintId; this
 * action loads the blueprint, picks the starting stage (honouring
 * `routingRules` — first matching rule wins; today rules are
 * label-only without an expression evaluator), and computes the
 * initial SLA deadline before persisting.
 *
 * `manager_of_requester` approvers are resolved by looking up the
 * org chart; if no entry exists the stage is left without
 * `approverId` so the UI can flag it as "needs assignment".
 */
export async function createRequest(input: {
    blueprintId: string;
    formData?: unknown;
    title?: string;
    priority?: string;
    attachments?: unknown[];
}): Promise<{ ok: boolean; data?: RequestInstanceDoc; error?: string }> {
    try {
        if (!input.blueprintId) {
            return { ok: false, error: 'blueprintId is required.' };
        }
        // Resolve the blueprint (TS path always — we need it to compute
        // the initial stage view regardless of Rust mode).
        const bpRes = await getBlueprintById(input.blueprintId);
        if (!bpRes.ok || !bpRes.data) {
            return { ok: false, error: bpRes.error ?? 'Blueprint not found.' };
        }
        const bp = bpRes.data;
        const stages = bp.stages ?? [];

        // Pick starting stage (idx 0 unless a routing rule overrides;
        // expression evaluator is deferred — we honour the first rule
        // unconditionally as a placeholder).
        let startIdx = 0;
        const rules = bp.routingRules ?? [];
        if (rules.length > 0) {
            // TODO: evaluate rules[i].expr against input.formData.
            // For now, use the first rule's startStageIdx only if it's
            // explicitly flagged with a "default:" expression prefix.
            const fallback = rules.find((r: BlueprintRoutingRule) =>
                r.expr.trim().toLowerCase().startsWith('default:'),
            );
            if (fallback && fallback.startStageIdx < stages.length) {
                startIdx = fallback.startStageIdx;
            }
        }

        const startStage: BlueprintStage | undefined = stages[startIdx];
        if (!startStage) {
            return {
                ok: false,
                error: 'Blueprint has no stages — cannot start a request.',
            };
        }

        // Resolve approverId for `manager_of_requester` via the org chart.
        let approverId = startStage.approverId;
        if (startStage.approverKind === 'manager_of_requester') {
            try {
                const userId = await requireUserId();
                if (useRust()) {
                    const r = await sabrequestsOrgchartsApi
                        .resolve(String(userId))
                        .catch(() => null);
                    if (r?.managerUserId) approverId = r.managerUserId;
                } else {
                    const { db } = await connectToDatabase();
                    const chart = await db.collection(ORGCHARTS_COLL).findOne({
                        userId,
                    });
                    const mgr = (chart?.managerOf as Record<string, string> | undefined)?.[
                        String(userId)
                    ];
                    if (mgr) approverId = mgr;
                }
            } catch {
                // best-effort — leave approverId unset
            }
        }

        const currentStage: CurrentStageView = {
            idx: startIdx,
            name: startStage.name,
            approverId,
            approverKind: startStage.approverKind,
            slaMins: startStage.slaMins,
        };

        const payload: RequestInstanceCreateInput = {
            blueprintId: bp._id,
            blueprintName: bp.name,
            blueprintCategory: bp.category,
            formData: input.formData ?? {},
            currentStage,
            currentStageIdx: startIdx,
            slaDeadlineAt: computeSlaDeadline(startStage),
            title: input.title ?? `${bp.name}`,
            priority: input.priority ?? 'normal',
            attachments: input.attachments ?? [],
        };

        if (useRust()) {
            try {
                const data = await sabrequestsInstancesApi.create(payload);
                revalidatePath(LIST_PATH);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('request_instance', 'create', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const now = new Date();
        const _id = new ObjectId();
        const doc = {
            _id,
            userId,
            projectId: new ObjectId(),
            blueprintId: toObjectIdOrUndef(bp._id) ?? new ObjectId(),
            blueprintName: bp.name,
            blueprintCategory: bp.category,
            requesterId: userId,
            formData: payload.formData,
            currentStageIdx: startIdx,
            currentStage,
            status: 'pending' as RequestStatus,
            slaDeadlineAt: payload.slaDeadlineAt
                ? new Date(payload.slaDeadlineAt)
                : undefined,
            attachments: payload.attachments,
            title: payload.title,
            priority: payload.priority,
            archived: false,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
        };
        await db.collection(INSTANCES_COLL).insertOne(doc);
        revalidatePath(LIST_PATH);
        return { ok: true, data: doc as unknown as RequestInstanceDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateRequest(
    id: string,
    patch: RequestInstanceUpdateInput,
): Promise<{ ok: boolean; data?: RequestInstanceDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsInstancesApi.update(id, patch);
                revalidatePath(LIST_PATH);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('request_instance', 'update', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid id.' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = {
            updatedAt: new Date(),
            updatedBy: userId,
        };
        if (patch.title != null) set.title = patch.title;
        if (patch.priority != null) set.priority = patch.priority;
        if (patch.formData != null) set.formData = patch.formData;
        if (patch.attachments != null) set.attachments = patch.attachments;
        if (patch.cancel) {
            set.status = 'cancelled';
            set.decidedAt = new Date();
        }
        const res = await db
            .collection(INSTANCES_COLL)
            .findOneAndUpdate(
                { _id: oid, userId, archived: { $ne: true } },
                { $set: set },
                { returnDocument: 'after' },
            );
        revalidatePath(LIST_PATH);
        if (!res) return { ok: false, error: 'Request not found.' };
        return { ok: true, data: res as unknown as RequestInstanceDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/**
 * Approver action endpoint. For `approve` we compute the next stage
 * view + SLA deadline here, then POST to the Rust decision endpoint
 * (or run the equivalent Mongo update on the TS path).
 */
export async function decideRequest(
    id: string,
    decision: {
        action: StageActionKind;
        note?: string;
        reassignTo?: string;
    },
): Promise<{ ok: boolean; data?: RequestInstanceDoc; error?: string }> {
    try {
        const current = await getRequestById(id);
        if (!current.ok || !current.data) {
            return { ok: false, error: current.error ?? 'Request not found.' };
        }
        const inst = current.data;
        const bpRes = await getBlueprintById(inst.blueprintId);
        const stages = bpRes.data?.stages ?? [];
        const nextIdx = inst.currentStageIdx + 1;
        const nextStage: BlueprintStage | undefined = stages[nextIdx];

        const payload: StageDecisionInput = {
            action: decision.action,
            note: decision.note,
            reassignTo: decision.reassignTo,
        };
        if (decision.action === 'approve' && nextStage) {
            payload.nextStage = {
                idx: nextIdx,
                name: nextStage.name,
                approverId: nextStage.approverId,
                approverKind: nextStage.approverKind,
                slaMins: nextStage.slaMins,
            };
            payload.nextStageIdx = nextIdx;
            payload.nextSlaDeadlineAt = computeSlaDeadline(nextStage);
        }

        if (useRust()) {
            try {
                const data = await sabrequestsInstancesApi.decide(id, payload);
                revalidatePath(LIST_PATH);
                revalidatePath(`/dashboard/requests/${id}`);
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('request_instance', 'other', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(id);
        if (!oid) return { ok: false, error: 'Invalid id.' };
        const { db } = await connectToDatabase();
        if (inst.status !== 'pending' && decision.action !== 'comment') {
            return {
                ok: false,
                error: `Request is already ${inst.status}; only 'comment' is allowed.`,
            };
        }
        const now = new Date();
        const set: Record<string, unknown> = { updatedAt: now, updatedBy: userId };
        if (decision.action === 'approve') {
            if (payload.nextStage) {
                set.currentStage = payload.nextStage;
                set.currentStageIdx = nextIdx;
                set.slaDeadlineAt = payload.nextSlaDeadlineAt
                    ? new Date(payload.nextSlaDeadlineAt)
                    : null;
                set.breachedAt = null;
            } else {
                set.status = 'approved';
                set.decidedAt = now;
            }
        } else if (decision.action === 'reject') {
            set.status = 'rejected';
            set.decidedAt = now;
        } else if (decision.action === 'reassign') {
            const to = toObjectIdOrUndef(decision.reassignTo);
            if (!to) {
                return { ok: false, error: 'reassignTo is required.' };
            }
            set['currentStage.approverId'] = to;
        }
        await db.collection(INSTANCES_COLL).updateOne(
            { _id: oid, userId },
            { $set: set },
        );
        await db.collection(ACTIONS_COLL).insertOne({
            _id: new ObjectId(),
            userId,
            projectId: new ObjectId(),
            requestId: oid,
            stageIdx: inst.currentStageIdx,
            actorId: userId,
            action: decision.action,
            note: decision.note ?? '',
            ts: now,
            createdAt: now,
            updatedAt: now,
            reassignedTo:
                decision.action === 'reassign'
                    ? toObjectIdOrUndef(decision.reassignTo)
                    : undefined,
        });
        const after = await db
            .collection(INSTANCES_COLL)
            .findOne({ _id: oid, userId });
        revalidatePath(LIST_PATH);
        revalidatePath(`/dashboard/requests/${id}`);
        return { ok: true, data: after as unknown as RequestInstanceDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function listStageActions(
    requestId: string,
): Promise<{ ok: boolean; data?: StageActionDoc[]; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsStageActionsApi.list({ requestId });
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('stage_action', 'list', e);
                }
            }
        }
        const userId = await requireUserId();
        const oid = toObjectIdOrUndef(requestId);
        if (!oid) return { ok: false, error: 'Invalid request id.' };
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(ACTIONS_COLL)
            .find({ userId, requestId: oid })
            .sort({ ts: 1 })
            .limit(200)
            .toArray();
        return { ok: true, data: docs as unknown as StageActionDoc[] };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* =====================================================================
 * ORG CHARTS
 * ===================================================================*/

export async function getOrgChart(
    orgId?: string,
): Promise<{ ok: boolean; data?: OrgChartDoc | null; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsOrgchartsApi.list(orgId);
                return { ok: true, data: data[0] ?? null };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('orgchart', 'list', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = { userId };
        const oid = toObjectIdOrUndef(orgId);
        if (oid) filter.orgId = oid;
        const doc = (await db
            .collection(ORGCHARTS_COLL)
            .findOne(filter)) as unknown as OrgChartDoc | null;
        return { ok: true, data: doc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function upsertOrgChart(
    input: OrgChartUpsertInput,
): Promise<{ ok: boolean; data?: OrgChartDoc; error?: string }> {
    try {
        if (useRust()) {
            try {
                const data = await sabrequestsOrgchartsApi.upsert(input);
                revalidatePath('/dashboard/requests/blueprints');
                return { ok: true, data };
            } catch (e) {
                if (e instanceof RustApiError) {
                    reportRustFallback('orgchart', 'update', e);
                }
            }
        }
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const now = new Date();
        const orgOid = toObjectIdOrUndef(input.orgId);
        const filter: Record<string, unknown> = { userId };
        if (orgOid) filter.orgId = orgOid;
        else filter.orgId = null;
        const existing = await db.collection(ORGCHARTS_COLL).findOne(filter);
        if (existing) {
            await db.collection(ORGCHARTS_COLL).updateOne(filter, {
                $set: {
                    managerOf: input.managerOf,
                    name: input.name,
                    updatedAt: now,
                    updatedBy: userId,
                },
            });
            const after = await db.collection(ORGCHARTS_COLL).findOne(filter);
            return { ok: true, data: after as unknown as OrgChartDoc };
        }
        const _id = new ObjectId();
        const doc = {
            _id,
            userId,
            projectId: toObjectIdOrUndef(input.projectId) ?? new ObjectId(),
            name: input.name,
            orgId: orgOid,
            managerOf: input.managerOf,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
        };
        await db.collection(ORGCHARTS_COLL).insertOne(doc);
        return { ok: true, data: doc as unknown as OrgChartDoc };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* =====================================================================
 * ANALYTICS
 * ===================================================================*/

export interface RequestsAnalytics {
    totals: {
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
    };
    slaBreachRate: number; // 0..1
    avgDecisionMinutes: number | null;
    byBlueprint: Array<{
        blueprintId?: string;
        blueprintName?: string;
        count: number;
        breachedCount: number;
    }>;
    bottleneckStages: Array<{
        blueprintName?: string;
        stageIdx: number;
        stageName?: string;
        pendingCount: number;
    }>;
}

export async function getRequestsAnalytics(): Promise<{
    ok: boolean;
    data?: RequestsAnalytics;
    error?: string;
}> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const coll = db.collection(INSTANCES_COLL);
        const all = (await coll
            .find({ userId, archived: { $ne: true } })
            .limit(2000)
            .toArray()) as unknown as RequestInstanceDoc[];

        const totals = {
            pending: 0,
            approved: 0,
            rejected: 0,
            cancelled: 0,
        };
        let breached = 0;
        let decided = 0;
        let decisionMins = 0;
        const byBlueprintMap = new Map<
            string,
            { blueprintId?: string; blueprintName?: string; count: number; breachedCount: number }
        >();
        const bottleneckMap = new Map<
            string,
            { blueprintName?: string; stageIdx: number; stageName?: string; pendingCount: number }
        >();

        for (const r of all) {
            totals[r.status as keyof typeof totals] =
                (totals[r.status as keyof typeof totals] ?? 0) + 1;
            if (r.breachedAt) breached++;
            if (r.decidedAt && r.createdAt) {
                const dt =
                    (new Date(r.decidedAt).getTime() -
                        new Date(r.createdAt).getTime()) /
                    60_000;
                if (Number.isFinite(dt) && dt >= 0) {
                    decisionMins += dt;
                    decided++;
                }
            }
            const bpKey = String(r.blueprintId ?? 'unknown');
            const bp = byBlueprintMap.get(bpKey) ?? {
                blueprintId: bpKey,
                blueprintName: r.blueprintName,
                count: 0,
                breachedCount: 0,
            };
            bp.count++;
            if (r.breachedAt) bp.breachedCount++;
            byBlueprintMap.set(bpKey, bp);

            if (r.status === 'pending') {
                const sk = `${bpKey}:${r.currentStageIdx}`;
                const st = bottleneckMap.get(sk) ?? {
                    blueprintName: r.blueprintName,
                    stageIdx: r.currentStageIdx,
                    stageName: r.currentStage?.name,
                    pendingCount: 0,
                };
                st.pendingCount++;
                bottleneckMap.set(sk, st);
            }
        }

        const slaBreachRate = all.length ? breached / all.length : 0;
        const avgDecisionMinutes = decided ? decisionMins / decided : null;
        const byBlueprint = Array.from(byBlueprintMap.values()).sort(
            (a, b) => b.count - a.count,
        );
        const bottleneckStages = Array.from(bottleneckMap.values())
            .sort((a, b) => b.pendingCount - a.pendingCount)
            .slice(0, 10);
        return {
            ok: true,
            data: {
                totals,
                slaBreachRate,
                avgDecisionMinutes,
                byBlueprint,
                bottleneckStages,
            },
        };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
