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
    } catch (e) {
        return [];
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
        return { error: 'Failed to save automation.' };
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
    } catch (e) {
        return { error: 'Failed to delete automation.' };
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
    try {
        const raw = formData.get('nodes') as string | null;
        if (raw) nodes = JSON.parse(raw) as CrmAutomationNode[];
    } catch {
        return { error: 'Invalid nodes payload.' };
    }

    const triggerNode: CrmAutomationNode = {
        id: 'trigger',
        type: `trigger_${trigger}`,
        data: { conditions } as any,
    } as CrmAutomationNode;

    const result = await saveCrmAutomation({
        flowId,
        name,
        nodes: [triggerNode, ...nodes],
        edges: [] as CrmAutomationEdge[],
    });
    return {
        message: result.message,
        error: result.error,
        id: result.flowId,
    };
}
