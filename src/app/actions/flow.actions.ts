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
