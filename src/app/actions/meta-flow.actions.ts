'use server';

/**
 * Meta Flows — server actions.
 *
 * Graph API v23.0 · Flow JSON 7.3 · Data API 3.0.
 *
 * Operations are split so the UI can offer explicit Save vs Publish
 * vs Deprecate vs Preview, each of which maps 1:1 to a Meta endpoint:
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
import { ObjectId, type WithId } from 'mongodb';
import axios, { isAxiosError } from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import type { MetaFlow, MetaFlowValidationError } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { cleanMetaFlowData, quickValidateFlow } from '@/lib/meta-flow-utils';

const GRAPH_API_VERSION = 'v23.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const FLOW_JSON_VERSION = '7.3';
const DATA_API_VERSION = '3.0';

type ActionResult<T = {}> = {
    success: boolean;
    message?: string;
    error?: string;
    validation_errors?: MetaFlowValidationError[];
} & Partial<T>;

/* ── helpers ─────────────────────────────────────────────────────── */

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

function pickGraphError(e: unknown): { message: string; validation_errors?: MetaFlowValidationError[] } {
    if (isAxiosError(e) && e.response?.data) {
        const data: any = e.response.data;
        const validation = data?.error?.error_user_msg
            ? undefined
            : (data?.validation_errors as MetaFlowValidationError[] | undefined);
        return {
            message: data?.error?.error_user_msg
                || data?.error?.message
                || data?.message
                || e.message,
            validation_errors: validation,
        };
    }
    return { message: getErrorMessage(e) };
}

async function loadOwnedFlow(flowId: string) {
    if (!ObjectId.isValid(flowId)) return { error: 'Invalid Flow ID.' as const };
    const { db } = await connectToDatabase();
    const flow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return { error: 'Flow not found.' as const };
    const project = await getProjectById(flow.projectId.toString());
    if (!project || !project.accessToken) return { error: 'Project access denied.' as const };
    return { db, flow, project };
}

/* ── reads ───────────────────────────────────────────────────────── */

export async function getMetaFlows(projectId: string): Promise<WithId<MetaFlow>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection('meta_flows')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch {
        return [];
    }
}

export async function getMetaFlowById(flowId: string): Promise<WithId<MetaFlow> | null> {
    const ctx = await loadOwnedFlow(flowId);
    if ('error' in ctx) return null;
    const { db, flow, project } = ctx;

    try {
        const metaResp = await axios.get(`${GRAPH_BASE}/${flow.metaId}`, {
            params: {
                fields: 'id,name,status,categories,validation_errors,json_version,endpoint_uri,preview,health_status',
            },
            headers: authHeaders(project.accessToken!),
        });

        const meta = metaResp.data || {};
        const update: Partial<MetaFlow> = {
            name: meta.name ?? flow.name,
            categories: meta.categories ?? flow.categories,
            status: meta.status ?? flow.status,
            json_version: meta.json_version ?? flow.json_version,
            endpoint_uri: meta.endpoint_uri ?? flow.endpoint_uri,
            validation_errors: meta.validation_errors ?? [],
            health_status: meta.health_status ?? null,
            preview: meta.preview ?? null,
            updatedAt: new Date(),
        };

        // Fetch the full Flow JSON via the assets download URL.
        try {
            const assetsResp = await axios.get(`${GRAPH_BASE}/${flow.metaId}/assets`, {
                headers: authHeaders(project.accessToken!),
            });
            const asset = assetsResp.data?.data?.find((a: any) => a.asset_type === 'FLOW_JSON') ?? assetsResp.data?.data?.[0];
            if (asset?.download_url) {
                const jsonResp = await axios.get(asset.download_url, { responseType: 'text' });
                const raw = typeof jsonResp.data === 'string' ? jsonResp.data : JSON.stringify(jsonResp.data);
                try { update.flow_data = JSON.parse(raw); } catch { /* keep local */ }
            } else if (asset?.asset_content) {
                // Older Graph versions inline the content.
                try { update.flow_data = JSON.parse(asset.asset_content); } catch { /* keep local */ }
            }
        } catch (e) {
            console.warn(`[meta-flow] assets fetch failed for ${flow.metaId}: ${getErrorMessage(e)}`);
        }

        await db.collection('meta_flows').updateOne({ _id: flow._id }, { $set: update });
        const fresh = await db.collection<MetaFlow>('meta_flows').findOne({ _id: flow._id });
        return fresh ? JSON.parse(JSON.stringify(fresh)) : null;
    } catch (e) {
        console.warn(`[meta-flow] sync failed for ${flow.metaId}: ${getErrorMessage(e)}`);
        return JSON.parse(JSON.stringify(flow));
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
    const { projectId, name, categories } = input;
    if (!ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project.' };
    if (!name) return { success: false, error: 'Flow name is required.' };
    if (!categories?.length) return { success: false, error: 'Select at least one category.' };

    const project = await getProjectById(projectId);
    if (!project?.accessToken || !project?.wabaId) {
        return { success: false, error: 'Project is missing an access token or WABA ID.' };
    }

    const flowData = input.flow_data
        ? cleanMetaFlowData(input.flow_data)
        : {
            version: FLOW_JSON_VERSION,
            data_api_version: input.endpoint_uri ? DATA_API_VERSION : undefined,
            routing_model: {},
            screens: [],
        };

    if (!input.clone_flow_id) {
        const quick = quickValidateFlow(flowData);
        // When starting empty we skip — validator fails on 0 screens.
        if (flowData.screens?.length && !quick.ok) {
            return { success: false, error: quick.errors.join('; ') };
        }
    }

    const body: Record<string, any> = { name, categories };
    if (input.endpoint_uri) body.endpoint_uri = input.endpoint_uri;
    if (input.clone_flow_id) body.clone_flow_id = input.clone_flow_id;
    else body.flow_json = JSON.stringify(flowData);

    try {
        const resp = await axios.post(
            `${GRAPH_BASE}/${project.wabaId}/flows`,
            body,
            { headers: authHeaders(project.accessToken) },
        );
        const data = resp.data || {};
        const newMetaId: string | undefined = data.id;
        if (!newMetaId) return { success: false, error: 'Meta did not return a flow id.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const doc: Omit<MetaFlow, '_id'> = {
            name,
            projectId: new ObjectId(projectId),
            metaId: newMetaId,
            status: 'DRAFT',
            json_version: flowData.version,
            categories,
            flow_data: flowData,
            endpoint_uri: input.endpoint_uri,
            validation_errors: data.validation_errors ?? [],
            health_status: null,
            preview: null,
            createdAt: now,
            updatedAt: now,
        };
        const ins = await db.collection('meta_flows').insertOne(doc as any);

        revalidatePath('/dashboard/flows');
        return {
            success: true,
            flowId: ins.insertedId.toString(),
            metaId: newMetaId,
            message: `Flow "${name}" created as DRAFT.`,
            validation_errors: data.validation_errors ?? [],
        };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message, validation_errors: err.validation_errors };
    }
}

/**
 * Save Flow JSON to Meta as a DRAFT asset without publishing.
 * Meta accepts JSON updates only while the flow is in DRAFT.
 */
export async function saveMetaFlowDraft(input: {
    flowId: string;
    flow_data: any;
}): Promise<ActionResult> {
    const ctx = await loadOwnedFlow(input.flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    if (flow.status && flow.status !== 'DRAFT') {
        return {
            success: false,
            error: `Cannot edit JSON while flow is ${flow.status}. Create a new version or deprecate first.`,
        };
    }

    const cleaned = cleanMetaFlowData(input.flow_data);
    const quick = quickValidateFlow(cleaned);
    if (!quick.ok) return { success: false, error: quick.errors.join('; ') };

    try {
        // Meta's /assets endpoint expects multipart/form-data.
        const form = new FormData();
        const blob = new Blob([JSON.stringify(cleaned)], { type: 'application/json' });
        form.append('file', blob, 'flow.json');
        form.append('name', 'flow.json');
        form.append('asset_type', 'FLOW_JSON');

        const resp = await axios.post(
            `${GRAPH_BASE}/${flow.metaId}/assets`,
            form,
            { headers: authHeaders(project.accessToken!) },
        );
        const data = resp.data || {};
        const validation: MetaFlowValidationError[] = data.validation_errors ?? [];

        if (data.success === false && validation.length) {
            await db.collection('meta_flows').updateOne(
                { _id: flow._id },
                { $set: { validation_errors: validation, updatedAt: new Date() } },
            );
            return { success: false, error: 'Flow JSON validation failed.', validation_errors: validation };
        }

        await db.collection('meta_flows').updateOne(
            { _id: flow._id },
            {
                $set: {
                    flow_data: cleaned,
                    json_version: cleaned.version ?? FLOW_JSON_VERSION,
                    validation_errors: validation,
                    updatedAt: new Date(),
                },
            },
        );

        revalidatePath('/dashboard/flows');
        revalidatePath(`/dashboard/flows/create`);
        return { success: true, message: 'Draft saved.', validation_errors: validation };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message, validation_errors: err.validation_errors };
    }
}

export async function updateMetaFlowMetadata(input: {
    flowId: string;
    name?: string;
    categories?: string[];
    endpoint_uri?: string | null;
    application_id?: string;
}): Promise<ActionResult> {
    const ctx = await loadOwnedFlow(input.flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    const body: Record<string, any> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.categories !== undefined) body.categories = input.categories;
    if (input.endpoint_uri !== undefined) body.endpoint_uri = input.endpoint_uri ?? '';
    if (input.application_id !== undefined) body.application_id = input.application_id;

    if (Object.keys(body).length === 0) return { success: true, message: 'Nothing to update.' };

    try {
        await axios.post(
            `${GRAPH_BASE}/${flow.metaId}`,
            body,
            { headers: authHeaders(project.accessToken!) },
        );

        await db.collection('meta_flows').updateOne(
            { _id: flow._id },
            {
                $set: {
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.categories !== undefined ? { categories: input.categories } : {}),
                    ...(input.endpoint_uri !== undefined ? { endpoint_uri: input.endpoint_uri ?? undefined } : {}),
                    ...(input.application_id !== undefined ? { application_id: input.application_id } : {}),
                    updatedAt: new Date(),
                },
            },
        );

        revalidatePath('/dashboard/flows');
        return { success: true, message: 'Metadata updated.' };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message };
    }
}

/* ── publish / deprecate / delete ────────────────────────────────── */

export async function publishMetaFlow(flowId: string): Promise<ActionResult> {
    const ctx = await loadOwnedFlow(flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    try {
        await axios.post(
            `${GRAPH_BASE}/${flow.metaId}/publish`,
            {},
            { headers: authHeaders(project.accessToken!) },
        );

        await db.collection('meta_flows').updateOne(
            { _id: flow._id },
            { $set: { status: 'PUBLISHED', lastPublishedAt: new Date(), updatedAt: new Date() } },
        );

        revalidatePath('/dashboard/flows');
        return { success: true, message: 'Flow published.' };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message, validation_errors: err.validation_errors };
    }
}

export async function deprecateMetaFlow(flowId: string): Promise<ActionResult> {
    const ctx = await loadOwnedFlow(flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    try {
        await axios.post(
            `${GRAPH_BASE}/${flow.metaId}/deprecate`,
            {},
            { headers: authHeaders(project.accessToken!) },
        );

        await db.collection('meta_flows').updateOne(
            { _id: flow._id },
            { $set: { status: 'DEPRECATED', updatedAt: new Date() } },
        );

        revalidatePath('/dashboard/flows');
        return { success: true, message: 'Flow deprecated.' };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message };
    }
}

export async function deleteMetaFlow(flowId: string, metaId?: string): Promise<ActionResult> {
    const ctx = await loadOwnedFlow(flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    if (flow.status && flow.status !== 'DRAFT') {
        // Meta only allows deleting DRAFT flows; everything else must be deprecated.
        return { success: false, error: `Only DRAFT flows can be deleted. Current status: ${flow.status}.` };
    }

    try {
        await axios.delete(
            `${GRAPH_BASE}/${metaId ?? flow.metaId}`,
            { headers: authHeaders(project.accessToken!) },
        );
    } catch (e) {
        // Tolerate "not found" on Meta so local cleanup still succeeds.
        const err = pickGraphError(e);
        if (!/not found|does not exist/i.test(err.message)) {
            return { success: false, error: err.message };
        }
    }

    await db.collection('meta_flows').deleteOne({ _id: flow._id });
    revalidatePath('/dashboard/flows');
    return { success: true, message: `Flow "${flow.name}" deleted.` };
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
    const ctx = await loadOwnedFlow(input.flowId);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { db, flow, project } = ctx;

    const invalidate = input.invalidate ? 'true' : 'false';
    const params: Record<string, string> = { fields: `preview.invalidate(${invalidate})` };
    if (input.flow_token) params.flow_token = input.flow_token;
    if (input.flow_action) params.flow_action = input.flow_action;
    if (input.flow_action_payload) params.flow_action_payload = JSON.stringify(input.flow_action_payload);
    if (input.phone_number) params.phone_number = input.phone_number;
    if (input.interactive !== undefined) params.interactive = String(input.interactive);

    try {
        const resp = await axios.get(`${GRAPH_BASE}/${flow.metaId}`, {
            params,
            headers: authHeaders(project.accessToken!),
        });
        const preview = resp.data?.preview;
        if (!preview?.preview_url) return { success: false, error: 'Meta returned no preview URL.' };

        await db.collection('meta_flows').updateOne(
            { _id: flow._id },
            { $set: { preview, updatedAt: new Date() } },
        );

        return {
            success: true,
            message: 'Preview ready.',
            preview_url: preview.preview_url,
            expires_at: preview.expires_at,
        };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message };
    }
}

/* ── bulk sync from Meta ─────────────────────────────────────────── */

export async function handleSyncMetaFlows(projectId: string): Promise<ActionResult<{ count: number }>> {
    const project = await getProjectById(projectId);
    if (!project?.accessToken || !project?.wabaId) {
        return { success: false, error: 'Project not connected to a WABA.' };
    }

    try {
        const { db } = await connectToDatabase();
        const all: any[] = [];
        let nextUrl: string | undefined = `${GRAPH_BASE}/${project.wabaId}/flows?fields=id,name,status,categories,validation_errors,json_version,endpoint_uri&limit=100`;

        while (nextUrl) {
            const resp: any = await axios.get(nextUrl, { headers: authHeaders(project.accessToken) });
            if (resp.data?.data?.length) all.push(...resp.data.data);
            nextUrl = resp.data?.paging?.next;
        }

        if (!all.length) return { success: true, count: 0, message: 'No flows on Meta yet.' };

        const ops = all.map((f: any) => ({
            updateOne: {
                filter: { metaId: f.id, projectId: new ObjectId(projectId) },
                update: {
                    $set: {
                        name: f.name,
                        status: f.status,
                        categories: f.categories,
                        json_version: f.json_version,
                        endpoint_uri: f.endpoint_uri,
                        validation_errors: f.validation_errors ?? [],
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        metaId: f.id,
                        projectId: new ObjectId(projectId),
                        createdAt: new Date(),
                        flow_data: {},
                    },
                },
                upsert: true,
            },
        }));

        const result = await db.collection('meta_flows').bulkWrite(ops);
        const count = result.upsertedCount + result.modifiedCount;

        revalidatePath('/dashboard/flows');
        return { success: true, count, message: `Synced ${count} flow(s) from Meta.` };
    } catch (e) {
        const err = pickGraphError(e);
        return { success: false, error: err.message };
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
