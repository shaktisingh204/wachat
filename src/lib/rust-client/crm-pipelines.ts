import 'server-only';

/**
 * CRM Pipeline + Stage client — wraps `/v1/crm/pipelines` on the Rust BFF.
 *
 * Unlike the generic `makeCrmClient` factory (which assumes
 * list/get/create/update/delete on a single entity path), pipelines have
 * 8 endpoints because the **Stage** sub-entity is addressed under its
 * parent pipeline:
 *
 * ```
 * GET    /v1/crm/pipelines
 * GET    /v1/crm/pipelines/:pipelineId
 * POST   /v1/crm/pipelines
 * PATCH  /v1/crm/pipelines/:pipelineId
 * DELETE /v1/crm/pipelines/:pipelineId
 * POST   /v1/crm/pipelines/:pipelineId/stages
 * PATCH  /v1/crm/pipelines/:pipelineId/stages/:stageId
 * DELETE /v1/crm/pipelines/:pipelineId/stages/:stageId
 * ```
 *
 * Built directly on {@link rustFetch} rather than the factory. Tightly typed
 * against `rust/crates/crm-pipelines/src/types.rs`.
 *
 * Counterpart to the legacy direct-Mongo server actions in
 * `src/app/actions/crm-pipelines.actions.ts`. When `USE_RUST_CRM === 'true'`
 * those actions delegate here.
 */

import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm-pipelines::types ────────────────────────── */

export interface CrmPipelineStageDoc {
    /** Mongo ObjectId (hex). New stages get one stamped server-side. */
    _id: string;
    /** Legacy uuid id stamped by the older TS code path. Preserved if present. */
    id?: string;
    name: string;
    color?: string;
    order?: number;
    /** Legacy "% chance of winning". */
    chance?: number;
}

export interface CrmPipelineDoc {
    _id: string;
    /** Legacy uuid id stamped by the older TS code path. */
    id?: string;
    name: string;
    stages: CrmPipelineStageDoc[];
    isDefault?: boolean;
    color?: string;
}

/* ─── Input shapes — mirror crm-pipelines::dto ───────────────────────── */

export interface CrmPipelineStageCreateInput {
    name: string;
    color?: string;
    order?: number;
    chance?: number;
}

export interface CrmPipelineCreateInput {
    name: string;
    color?: string;
    isDefault?: boolean;
    stages?: CrmPipelineStageCreateInput[];
}

export interface CrmPipelineUpdateInput {
    name?: string;
    color?: string;
    isDefault?: boolean;
}

export interface CrmStageAddInput {
    name: string;
    color?: string;
    order?: number;
    chance?: number;
}

export type CrmStageUpdateInput = Partial<CrmStageAddInput>;

/* ─── Wire envelopes ─────────────────────────────────────────────────── */

interface ListEnvelope {
    items: CrmPipelineDoc[];
}

interface CreatePipelineEnvelope {
    id: string;
    entity: CrmPipelineDoc;
}

interface AddStageEnvelope {
    id: string;
    entity: CrmPipelineStageDoc;
}

interface DeleteEnvelope {
    deleted: boolean;
}

/* ─── Guard ──────────────────────────────────────────────────────────── */

function guard(): void {
    if (process.env.USE_RUST_CRM === 'false') {
        throw new Error(
            'USE_RUST_CRM disabled — call the TS server action instead.',
        );
    }
}

const BASE = '/v1/crm/pipelines';

/* ─── Public API ─────────────────────────────────────────────────────── */

export const pipelineApi = {
    async list(): Promise<CrmPipelineDoc[]> {
        guard();
        const raw = await rustFetch<ListEnvelope | CrmPipelineDoc[]>(BASE);
        if (Array.isArray(raw)) return raw;
        return raw?.items ?? [];
    },

    async getById(id: string): Promise<CrmPipelineDoc | null> {
        guard();
        if (!id) return null;
        try {
            const doc = await rustFetch<CrmPipelineDoc>(
                `${BASE}/${encodeURIComponent(id)}`,
            );
            return doc ?? null;
        } catch (e) {
            // Surface 404 as null, like the makeCrmClient contract.
            const status = (e as { status?: number })?.status;
            if (status === 404) return null;
            throw e;
        }
    },

    async create(input: CrmPipelineCreateInput): Promise<CreatePipelineEnvelope> {
        guard();
        return rustFetch<CreatePipelineEnvelope>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async update(
        id: string,
        patch: CrmPipelineUpdateInput,
    ): Promise<CrmPipelineDoc> {
        guard();
        return rustFetch<CrmPipelineDoc>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },

    async delete(id: string): Promise<DeleteEnvelope> {
        guard();
        try {
            return await rustFetch<DeleteEnvelope>(
                `${BASE}/${encodeURIComponent(id)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            const status = (e as { status?: number })?.status;
            if (status === 404) return { deleted: false };
            throw e;
        }
    },

    async addStage(
        pipelineId: string,
        input: CrmStageAddInput,
    ): Promise<AddStageEnvelope> {
        guard();
        return rustFetch<AddStageEnvelope>(
            `${BASE}/${encodeURIComponent(pipelineId)}/stages`,
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        );
    },

    async updateStage(
        pipelineId: string,
        stageId: string,
        patch: CrmStageUpdateInput,
    ): Promise<CrmPipelineStageDoc> {
        guard();
        return rustFetch<CrmPipelineStageDoc>(
            `${BASE}/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        );
    },

    async removeStage(
        pipelineId: string,
        stageId: string,
    ): Promise<DeleteEnvelope> {
        guard();
        try {
            return await rustFetch<DeleteEnvelope>(
                `${BASE}/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
                { method: 'DELETE' },
            );
        } catch (e) {
            const status = (e as { status?: number })?.status;
            if (status === 404) return { deleted: false };
            throw e;
        }
    },
};
