'use server';

/**
 * Meta Flows — server actions.
 *
 * Migrated to the Rust BFF (`meta-flows` crate, mounted at
 * `/v1/meta/flows`). Each function below is a thin shim around
 * `rustClient.metaFlows.*`. The shim layer preserves the legacy
 * return-type contracts that the existing UI relies on.
 *
 * Operations on Meta:
 *
 *   createMetaFlow           POST /{WABA}/flows
 *   saveMetaFlowDraft        POST /{FLOW}/assets          (multipart, flow.json)
 *   updateMetaFlowMetadata   POST /{FLOW}                 (name / categories / endpoint_uri)
 *   publishMetaFlow          POST /{FLOW}/publish
 *   deprecateMetaFlow        POST /{FLOW}/deprecate
 *   deleteMetaFlow           DELETE /{FLOW}               (DRAFT only)
 *   getMetaFlowPreview       GET  /{FLOW}?fields=preview…
 *   handleSyncMetaFlows      GET  /{WABA}/flows           (paginated pull)
 */

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import type { MetaFlow, MetaFlowValidationError } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { cleanMetaFlowData } from '@/lib/meta-flow-utils';
import { rustClient } from '@/lib/rust-client';

type ActionResult<T = {}> = {
    success: boolean;
    message?: string;
    error?: string;
    validation_errors?: MetaFlowValidationError[];
} & Partial<T>;

/* ── reads ───────────────────────────────────────────────────────── */

export async function getMetaFlows(projectId: string): Promise<WithId<MetaFlow>[]> {
    try {
        const flows = await rustClient.metaFlows.listFlows(projectId);
        return flows as unknown as WithId<MetaFlow>[];
    } catch {
        return [];
    }
}

export async function getMetaFlowById(flowId: string): Promise<WithId<MetaFlow> | null> {
    try {
        const flow = await rustClient.metaFlows.getFlow(flowId);
        return flow ? (flow as unknown as WithId<MetaFlow>) : null;
    } catch {
        return null;
    }
}

/* ── writes: create / save / update ──────────────────────────────── */

export async function createMetaFlow(input: {
    projectId: string;
    name: string;
    categories: string[];
    flow_data?: any;
    endpoint_uri?: string;
    clone_flow_id?: string;
}): Promise<ActionResult<{ flowId: string; metaId: string }>> {
    try {
        const cleaned = input.flow_data ? cleanMetaFlowData(input.flow_data) : undefined;
        const r = await rustClient.metaFlows.createFlow(input.projectId, {
            name: input.name,
            categories: input.categories,
            flow_data: cleaned,
            endpoint_uri: input.endpoint_uri,
            clone_flow_id: input.clone_flow_id,
        });
        if (!r.success) {
            return { success: false, error: r.error, validation_errors: r.validation_errors };
        }
        revalidatePath('/wachat/flows');
        return {
            success: true,
            flowId: r.flowId!,
            metaId: r.metaId!,
            message: r.message,
            validation_errors: r.validation_errors ?? [],
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function saveMetaFlowDraft(input: {
    flowId: string;
    flow_data: any;
}): Promise<ActionResult> {
    try {
        const cleaned = cleanMetaFlowData(input.flow_data);
        const r = await rustClient.metaFlows.saveDraft(input.flowId, { flow_data: cleaned });
        if (!r.success) {
            return { success: false, error: r.error, validation_errors: r.validation_errors };
        }
        revalidatePath('/wachat/flows');
        revalidatePath(`/wachat/flows/create`);
        return { success: true, message: r.message ?? 'Draft saved.', validation_errors: r.validation_errors };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateMetaFlowMetadata(input: {
    flowId: string;
    name?: string;
    categories?: string[];
    endpoint_uri?: string | null;
    application_id?: string;
}): Promise<ActionResult> {
    try {
        const r = await rustClient.metaFlows.updateMetadata(input.flowId, {
            name: input.name,
            categories: input.categories,
            endpoint_uri: input.endpoint_uri,
            application_id: input.application_id,
        });
        if (!r.success) return { success: false, error: r.error };
        revalidatePath('/wachat/flows');
        return { success: true, message: r.message ?? 'Metadata updated.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ── publish / deprecate / delete ────────────────────────────────── */

export async function publishMetaFlow(flowId: string): Promise<ActionResult> {
    try {
        const r = await rustClient.metaFlows.publish(flowId);
        if (!r.success) {
            return { success: false, error: r.error, validation_errors: r.validation_errors };
        }
        revalidatePath('/wachat/flows');
        return { success: true, message: r.message ?? 'Flow published.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deprecateMetaFlow(flowId: string): Promise<ActionResult> {
    try {
        const r = await rustClient.metaFlows.deprecate(flowId);
        if (!r.success) return { success: false, error: r.error };
        revalidatePath('/wachat/flows');
        return { success: true, message: r.message ?? 'Flow deprecated.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteMetaFlow(flowId: string, metaId?: string): Promise<ActionResult> {
    try {
        const r = await rustClient.metaFlows.deleteFlow(flowId, metaId);
        if (!r.success) return { success: false, error: r.error };
        revalidatePath('/wachat/flows');
        return { success: true, message: r.message };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ── preview / health ────────────────────────────────────────────── */

export async function getMetaFlowPreview(input: {
    flowId: string;
    invalidate?: boolean;
    flow_token?: string;
    flow_action?: 'navigate' | 'data_exchange';
    flow_action_payload?: Record<string, any>;
    phone_number?: string;
    interactive?: boolean;
}): Promise<ActionResult<{ preview_url: string; expires_at: string }>> {
    try {
        const r = await rustClient.metaFlows.preview(input.flowId, {
            invalidate: input.invalidate,
            flow_token: input.flow_token,
            flow_action: input.flow_action,
            flow_action_payload: input.flow_action_payload,
            phone_number: input.phone_number,
            interactive: input.interactive,
        });
        if (!r.success) return { success: false, error: r.error };
        return {
            success: true,
            message: r.message ?? 'Preview ready.',
            preview_url: r.preview_url!,
            expires_at: r.expires_at!,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ── bulk sync from Meta ─────────────────────────────────────────── */

export async function handleSyncMetaFlows(projectId: string): Promise<ActionResult<{ count: number }>> {
    try {
        const r = await rustClient.metaFlows.syncFlows(projectId);
        if (!r.success) return { success: false, error: r.error };
        revalidatePath('/wachat/flows');
        return { success: true, count: r.count ?? 0, message: r.message };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ── legacy adapter — keep form-action signature the create page used
 *    until it migrates to the split actions above. Thin wrapper. ──── */

export async function saveMetaFlow(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; payload?: string; validation_errors?: MetaFlowValidationError[] }> {
    const projectId = formData.get('projectId') as string;
    const flowId = formData.get('flowId') as string | null;
    const flowName = formData.get('flowName') as string;
    const category = formData.get('category') as string;
    const endpoint_uri = (formData.get('endpoint_uri') as string) || undefined;
    const flowDataStr = formData.get('flow_data') as string;
    const shouldPublish = formData.get('publish') === 'on';

    if (!projectId || !flowName || !category || !flowDataStr) {
        return { error: 'Missing required fields.' };
    }

    let flow_data: any;
    try { flow_data = JSON.parse(flowDataStr); }
    catch { return { error: 'Invalid JSON format for flow data.' }; }

    if (flowId) {
        const save = await saveMetaFlowDraft({ flowId, flow_data });
        if (!save.success) return { error: save.error, validation_errors: save.validation_errors };

        const meta = await updateMetaFlowMetadata({ flowId, name: flowName, categories: [category], endpoint_uri });
        if (!meta.success) return { error: meta.error };

        if (shouldPublish) {
            const pub = await publishMetaFlow(flowId);
            if (!pub.success) return { error: pub.error, validation_errors: pub.validation_errors };
        }
        return { message: shouldPublish ? 'Flow updated and published.' : 'Draft saved.' };
    }

    const created = await createMetaFlow({
        projectId,
        name: flowName,
        categories: [category],
        flow_data,
        endpoint_uri,
    });
    if (!created.success || !created.flowId) {
        return { error: created.error, validation_errors: created.validation_errors };
    }

    if (shouldPublish) {
        const pub = await publishMetaFlow(created.flowId);
        if (!pub.success) return { error: `Flow created but publish failed: ${pub.error}` };
    }

    return { message: shouldPublish ? `Flow "${flowName}" created and published.` : `Flow "${flowName}" created as DRAFT.` };
}
