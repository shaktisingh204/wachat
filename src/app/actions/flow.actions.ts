'use server';

import { revalidatePath } from 'next/cache';
import { type WithId } from 'mongodb';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type { Flow, FlowNode, FlowEdge } from '@/lib/definitions';
import { getSession } from '@/app/actions/user.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export async function getFlowsForProject(projectId: string): Promise<WithId<Flow>[]> {
    try {
        const flows = await rustClient.wachatFlows.listFlows(projectId);
        return flows as unknown as WithId<Flow>[];
    } catch (e) {
        if (e instanceof RustApiError) return [];
        return [];
    }
}

export async function getFlowById(flowId: string): Promise<WithId<Flow> | null> {
    try {
        const flow = await rustClient.wachatFlows.getFlow(flowId);
        if (!flow) return null;
        return flow as unknown as WithId<Flow>;
    } catch (e) {
        if (e instanceof RustApiError) return null;
        return null;
    }
}

export async function saveFlow(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    triggerKeywords: string[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };

    const { flowId, projectId, name, nodes, edges, triggerKeywords } = data;
    if (!projectId || !name) return { error: 'Project ID and Flow Name are required.' };

    try {
        const result = await rustClient.wachatFlows.saveFlow({
            flowId,
            projectId,
            name,
            nodes: nodes as any,
            edges: edges as any,
            triggerKeywords,
            status: (data as any).status,
        });
        if (result?.error) return { error: result.error };
        revalidatePath('/wachat/flow-builder');
        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction(flowId ? 'wachat.flow.updated' : 'wachat.flow.created', {
                userId: actorId,
                target: result?.flowId ?? flowId,
                metadata: { projectId, name },
            });
        }
        return {
            message: result?.message ?? (flowId ? 'Flow updated successfully.' : 'Flow created successfully.'),
            flowId: result?.flowId ?? flowId,
        };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to save flow.' };
        }
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const result = await rustClient.wachatFlows.deleteFlow(flowId);
        if (result?.error) return { error: result.error };
        revalidatePath('/wachat/flow-builder');
        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction('wachat.flow.deleted', {
                userId: actorId,
                target: flowId,
            });
        }
        return { message: result?.message ?? 'Flow deleted.' };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to delete flow.' };
        }
        return { error: 'Failed to delete flow.' };
    }
}

export async function getFlowBuilderPageData(projectId: string): Promise<{
    flows: WithId<Flow>[];
    initialFlow: WithId<Flow> | null;
}> {
    try {
        const data = await rustClient.wachatFlows.builderData(projectId);
        return {
            flows: (data?.flows ?? []) as unknown as WithId<Flow>[],
            initialFlow: (data?.initialFlow ?? null) as unknown as WithId<Flow> | null,
        };
    } catch (e) {
        if (e instanceof RustApiError) return { flows: [], initialFlow: null };
        return { flows: [], initialFlow: null };
    }
}

export async function cloneFlow(flowId: string): Promise<{ message?: string, error?: string, newFlowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    if (!flowId) return { error: 'A flow id is required.' };

    try {
        // Single-shot clone: the Rust handler deep-copies nodes/edges/
        // triggerKeywords, suffixes the name with " (Copy)", forces
        // status = "PAUSED", and assigns a fresh _id — replacing the old
        // get-then-save round-trip.
        const result = await rustClient.wachatFlows.cloneFlow(flowId);
        if (result?.error) return { error: result.error };
        if (!result?.flowId) return { error: 'Failed to clone flow.' };
        revalidatePath('/wachat/flow-builder');

        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction('wachat.flow.created', {
                userId: actorId,
                target: result.flowId,
                metadata: { clonedFrom: flowId },
            });
        }
        return {
            message: result.message ?? 'Flow duplicated successfully.',
            newFlowId: result.flowId,
        };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to clone flow.' };
        }
        return { error: e?.message || 'Failed to clone flow.' };
    }
}

export async function bulkDeleteFlows(flowIds: string[]): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    if (!Array.isArray(flowIds) || flowIds.length === 0) {
        return { error: 'No flows selected.' };
    }
    try {
        // Single-shot bulk delete (one delete_many on the Rust side) instead
        // of an N+1 loop of deleteFlow calls.
        const result = await rustClient.wachatFlows.bulkDeleteFlows(flowIds);
        revalidatePath('/wachat/flow-builder');
        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction('wachat.flow.deleted', {
                userId: actorId,
                metadata: { count: result.deleted, requested: flowIds.length },
            });
        }
        return { message: `${result.deleted} flow${result.deleted === 1 ? '' : 's'} deleted.` };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to delete flows.' };
        }
        return { error: e?.message || 'Failed to delete flows.' };
    }
}

export async function bulkUpdateFlowStatus(flowIds: string[], status: 'ACTIVE' | 'PAUSED'): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    if (!Array.isArray(flowIds) || flowIds.length === 0) {
        return { error: 'No flows selected.' };
    }
    if (status !== 'ACTIVE' && status !== 'PAUSED') {
        return { error: 'Invalid status.' };
    }
    try {
        // Single-shot bulk status (one update_many on the Rust side) instead
        // of an N+1 loop of getFlow + saveFlow calls.
        const result = await rustClient.wachatFlows.bulkUpdateFlowStatus(flowIds, status);
        revalidatePath('/wachat/flow-builder');
        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction('wachat.flow.updated', {
                userId: actorId,
                metadata: { status, count: result.modified, requested: flowIds.length },
            });
        }
        return {
            message: `${result.modified} flow${result.modified === 1 ? '' : 's'} marked as ${status.toLowerCase()}.`,
        };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to update flows.' };
        }
        return { error: e?.message || 'Failed to update flows.' };
    }
}

export async function getFlowMetrics(flowId: string): Promise<{ triggersToday: number, totalTriggers: number, lastTriggeredAt: Date | null }> {
    // Mock analytics
    return {
        triggersToday: Math.floor(Math.random() * 50),
        totalTriggers: Math.floor(Math.random() * 1000),
        lastTriggeredAt: new Date(Date.now() - Math.random() * 100000000),
    };
}
