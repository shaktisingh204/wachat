'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import { generateCrmAutomation as generateFlow } from '@/ai/flows/generate-crm-automation-flow';
import { z } from 'zod';
import { crmAutomationsApi } from '@/lib/rust-client/crm-automations';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getCrmAutomations(): Promise<WithId<CrmAutomation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_automations', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const automations = await db.collection<CrmAutomation>('crm_automations')
            .find({ userId: new ObjectId(session.user._id) })
            .project({ name: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(automations));
    } catch (e: any) {
        console.error('[getCrmAutomations] failed:', e);
        throw new Error(e.message || 'Failed to fetch CRM automations');
    }
}

export async function getCrmAutomationById(automationId: string): Promise<WithId<CrmAutomation> | null> {
    if (!ObjectId.isValid(automationId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_automations', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAutomationsApi.getById(automationId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmAutomationById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'automation',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    const { db } = await connectToDatabase();
    const automation = await db.collection<CrmAutomation>('crm_automations').findOne({
        _id: new ObjectId(automationId),
        userId: new ObjectId(session.user._id)
    });

    return automation ? JSON.parse(JSON.stringify(automation)) : null;
}

export async function saveCrmAutomation(data: {
    flowId?: string;
    name: string;
    nodes: CrmAutomationNode[];
    edges: CrmAutomationEdge[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, name, nodes, edges } = data;
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const isNew = !flowId;

    const guard = await requirePermission('crm_automations', isNew ? 'create' : 'edit');
    if (!guard.ok) return { error: guard.error };

    if (!name) return { error: 'Automation Name is required.' };

    const automationData: Omit<CrmAutomation, '_id' | 'createdAt'> = {
        name,
        userId: new ObjectId(session.user._id),
        nodes,
        edges,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('crm_automations').insertOne({ ...automationData, createdAt: new Date() } as any);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'automation',
                    entityId: result.insertedId.toString(),
                });
            } catch { /* non-fatal */ }
            revalidatePath('/dashboard/crm/automations');
            return { message: 'Automation created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('crm_automations').updateOne(
                { _id: new ObjectId(flowId), userId: new ObjectId(session.user._id) },
                { $set: automationData }
            );
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'automation',
                    entityId: flowId!,
                });
            } catch { /* non-fatal */ }
            revalidatePath('/dashboard/crm/automations');
            return { message: 'Automation updated successfully.', flowId };
        }
    } catch (e: any) {
        console.error('[saveCrmAutomation] failed:', e);
        return { error: e.message || 'Failed to save automation.' };
    }
}

export async function deleteCrmAutomation(automationId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(automationId)) return { error: 'Invalid Automation ID.' };

    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_automations', 'delete');
    if (!guard.ok) return { error: guard.error };

    const { db } = await connectToDatabase();
    const automation = await db.collection('crm_automations').findOne({ _id: new ObjectId(automationId), userId: new ObjectId(session.user._id) });
    if (!automation) return { error: 'Automation not found or you do not have access.' };

    try {
        await db.collection('crm_automations').deleteOne({ _id: new ObjectId(automationId) });
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'automation',
                entityId: automationId,
            });
        } catch { /* non-fatal */ }
        revalidatePath('/dashboard/crm/automations');
        return { message: 'Automation deleted.' };
    } catch (e: any) {
        console.error('[deleteCrmAutomation] failed:', e);
        return { error: e.message || 'Failed to delete automation.' };
    }
}

/* ─── getCrmAutomationKpis ───────────────────────────────────────────── */

export interface CrmAutomationKpis {
    total: number;
    active: number;
    paused: number;
    executionsToday: number;
}

export async function getCrmAutomationKpis(): Promise<CrmAutomationKpis> {
    const empty: CrmAutomationKpis = { total: 0, active: 0, paused: 0, executionsToday: 0 };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [total, active, executionsAgg] = await Promise.all([
            db.collection('crm_automations').countDocuments({ userId: userObjectId } as any),
            db
                .collection('crm_automations')
                .countDocuments({ userId: userObjectId, isActive: true } as any),
            db
                .collection('crm_automations')
                .aggregate([
                    {
                        $match: {
                            userId: userObjectId,
                            lastRunAt: { $gte: startOfToday },
                        },
                    },
                    { $group: { _id: null, runs: { $sum: { $ifNull: ['$runCount', 1] } } } },
                ])
                .toArray(),
        ]);

        return {
            total,
            active,
            paused: Math.max(0, total - active),
            executionsToday: Number(executionsAgg?.[0]?.runs ?? 0),
        };
    } catch (e) {
        console.error('Failed to fetch CRM automation KPIs:', e);
        return empty;
    }
}

/* ─── listCrmAutomations (full list with pagination + filters) ───────── */

export type CrmAutomationStatusFilter = 'all' | 'active' | 'paused';

export interface CrmAutomationListFilters {
    status?: CrmAutomationStatusFilter;
    trigger?: string;
}

export interface CrmAutomationListItem {
    _id: string;
    name: string;
    trigger?: string;
    actionsCount?: number;
    conditionsCount?: number;
    isActive?: boolean;
    lastRunAt?: string;
    runCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

export async function listCrmAutomations(
    page: number = 1,
    limit: number = 20,
    query: string = '',
    filters: CrmAutomationListFilters = {},
): Promise<{ items: CrmAutomationListItem[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { items: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const mongoFilter: Record<string, unknown> = { userId: userObjectId };
        if (query) {
            mongoFilter.name = { $regex: query, $options: 'i' };
        }
        if (filters.status === 'active') mongoFilter.isActive = true;
        else if (filters.status === 'paused') mongoFilter.isActive = { $ne: true };
        if (filters.trigger) mongoFilter.trigger = filters.trigger;

        const skip = (Math.max(1, page) - 1) * limit;
        const [docs, total] = await Promise.all([
            db
                .collection('crm_automations')
                .find(mongoFilter as any)
                .sort({ updatedAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_automations').countDocuments(mongoFilter as any),
        ]);
        return {
            items: JSON.parse(JSON.stringify(docs)) as CrmAutomationListItem[],
            total,
        };
    } catch (e: any) {
        console.error('Failed to list CRM automations:', e);
        throw new Error(e.message || 'Failed to list CRM automations');
    }
}

/* ─── bulkAutomationAction ───────────────────────────────────────────── */

export async function bulkAutomationAction(
    ids: string[],
    op: 'delete' | 'activate' | 'pause',
): Promise<{ success: boolean; processed?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, error: 'No ids.' };

    const validIds = ids.filter((id) => ObjectId.isValid(id));
    if (validIds.length === 0) return { success: false, error: 'No valid ids.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const objectIds = validIds.map((id) => new ObjectId(id));
        const match = { _id: { $in: objectIds }, userId: userObjectId } as any;

        if (op === 'delete') {
            const result = await db.collection('crm_automations').deleteMany(match);
            revalidatePath('/dashboard/crm/sales-crm/automations');
            return { success: true, processed: result.deletedCount ?? 0 };
        }
        if (op === 'activate' || op === 'pause') {
            const result = await db
                .collection('crm_automations')
                .updateMany(match, { $set: { isActive: op === 'activate', updatedAt: new Date() } });
            revalidatePath('/dashboard/crm/sales-crm/automations');
            return { success: true, processed: result.modifiedCount ?? 0 };
        }
        return { success: false, error: 'Unsupported op.' };
    } catch (e: any) {
        console.error('Bulk operation failed:', e);
        return { success: false, error: e.message || 'Bulk operation failed.' };
    }
}

const GenerateCrmAutomationInputSchema = z.object({
    prompt: z.string().describe("The user's description of the automation they want to create."),
});

export async function generateCrmAutomation(input: z.infer<typeof GenerateCrmAutomationInputSchema>) {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_automations', 'create');
    if (!guard.ok) return { error: guard.error };
    return await generateFlow(input);
}

/* ─── Legacy-name aliases used by the AutomationForm UI ─────────────── */

export async function getAutomationById(
    automationId: string,
): Promise<WithId<CrmAutomation> | null> {
    return getCrmAutomationById(automationId);
}

/**
 * `useActionState`-compatible wrapper around `saveCrmAutomation`. Reads
 * the form fields posted by `<AutomationForm />` and feeds them to the
 * canonical action.
 */
export async function saveAutomation(
    _prevState: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const flowId = (formData.get('automationId') as string | null) || undefined;
    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'Automation name is required.' };

    const trigger = (formData.get('trigger') as string | null) || 'manual';
    const conditions = (formData.get('conditions') as string | null) || '';

    let nodes: CrmAutomationNode[] = [];
    let edges: CrmAutomationEdge[] = [];
    try {
        const rawNodes = formData.get('nodes') as string | null;
        if (rawNodes) nodes = JSON.parse(rawNodes) as CrmAutomationNode[];
        
        const rawEdges = formData.get('edges') as string | null;
        if (rawEdges) edges = JSON.parse(rawEdges) as CrmAutomationEdge[];
    } catch {
        return { error: 'Invalid nodes/edges payload.' };
    }

    const isAdvancedGraph = formData.get('isAdvancedGraph') === 'true';
    if (!isAdvancedGraph) {
        const triggerNode: CrmAutomationNode = {
            id: 'trigger',
            type: `trigger_${trigger}`,
            data: { conditions } as any,
            position: { x: 50, y: 50 }
        } as CrmAutomationNode;
        nodes = [triggerNode, ...nodes];
    }

    const result = await saveCrmAutomation({
        flowId,
        name,
        nodes,
        edges,
    });
    return {
        message: result.message,
        error: result.error,
        id: result.flowId,
    };
}

export async function getAutomationRuns(automationId: string) {
    const { getSession } = await import('@/app/actions/user.actions');
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { ObjectId } = await import('mongodb');
    const session = await getSession();
    if (!session?.user) return [];
    
    if (!ObjectId.isValid(automationId)) return [];
    
    try {
        const { db } = await connectToDatabase();
        const runs = await db.collection('crm_automation_runs').find({
            automationId: automationId,
            userId: new ObjectId(session.user._id)
        }).sort({ startedAt: -1 }).limit(10).toArray();
        return JSON.parse(JSON.stringify(runs));
    } catch (e) {
        console.error('Failed to get automation runs:', e);
        return [];
    }
}
