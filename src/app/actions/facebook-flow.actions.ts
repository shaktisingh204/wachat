'use server';

/**
 * Facebook Messenger flow-builder — server actions.
 *
 * Migrated to the Rust BFF (`facebook-flow` crate, mounted at
 * `/v1/facebook/flow`). Each function below is a thin shim around
 * `rustClient.facebookFlow.*`. The shim layer preserves the legacy
 * return-type contracts that the existing UI relies on (`WithId<FacebookFlow>`
 * etc.).
 *
 * Operations:
 *
 *   getFacebookFlows       GET    /projects/:projectId/flows
 *   getFacebookFlowById    GET    /:flowId
 *   saveFacebookFlow       POST   /projects/:projectId/flows  (upsert)
 *   deleteFlow             DELETE /:flowId
 */

import { revalidatePath } from 'next/cache';
import { type WithId } from 'mongodb';
import type { FacebookFlow, FacebookFlowNode, FacebookFlowEdge } from '@/lib/definitions';
import { rustClient } from '@/lib/rust-client';

export async function getFacebookFlows(projectId: string): Promise<WithId<FacebookFlow>[]> {
    try {
        const flows = await rustClient.facebookFlow.listFlows(projectId);
        return flows as unknown as WithId<FacebookFlow>[];
    } catch {
        return [];
    }
}

export async function getFacebookFlowById(flowId: string): Promise<WithId<FacebookFlow> | null> {
    try {
        const flow = await rustClient.facebookFlow.getFlow(flowId);
        return flow ? (flow as unknown as WithId<FacebookFlow>) : null;
    } catch {
        return null;
    }
}

export async function saveFacebookFlow(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: FacebookFlowNode[];
    edges: FacebookFlowEdge[];
    triggerKeywords: string[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, projectId, name, nodes, edges, triggerKeywords } = data;
    if (!projectId || !name) return { error: 'Project ID and Flow Name are required.' };

    try {
        const r = await rustClient.facebookFlow.saveFlow(projectId, {
            flowId,
            name,
            nodes: nodes as any,
            edges: edges as any,
            triggerKeywords,
        });
        if (r.error) return { error: r.error };
        revalidatePath('/dashboard/facebook/flow-builder');
        return { message: r.message, flowId: r.flowId };
    } catch {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    try {
        const r = await rustClient.facebookFlow.deleteFlow(flowId);
        if (r.error) return { error: r.error };
        revalidatePath('/dashboard/facebook/flow-builder');
        return { message: r.message };
    } catch {
        return { error: 'Failed to delete flow.' };
    }
}
