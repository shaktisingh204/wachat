/**
 * Client for the Wachat **ai-training** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/ai-training` by the
 * `wachat-ai-training` crate — the `/wachat/automation` page's model picker
 * (`meta-native` / `sabnode-ai`) and question/answer training samples:
 *
 *   GET    /model-config/{projectId}/{phoneId}             → getModelConfig
 *   POST   /model-config/{projectId}/{phoneId}             → upsertModelConfig
 *   GET    /samples/{projectId}/{phoneId}                  → listSamples
 *   POST   /samples/{projectId}/{phoneId}                  → createSample
 *   DELETE /samples/{projectId}/{phoneId}/{sampleId}       → deleteSample
 *
 * Everything is scoped to the authenticated user plus the
 * `{projectId, phoneNumberId}` path pair. Server-only — uses the shared
 * JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/ai-training';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Automation engine identifier. */
export type WachatAiModel = 'meta-native' | 'sabnode-ai' | (string & {});

/**
 * Body for `POST /v1/wachat/ai-training/model-config/{projectId}/{phoneId}` —
 * upsert the automation model for a number.
 */
export interface ModelConfigBody {
    /** Automation engine: `"meta-native"` or `"sabnode-ai"`. */
    model: WachatAiModel;
}

/**
 * Response for `GET /v1/wachat/ai-training/model-config/{projectId}/{phoneId}`
 * — the selected model (defaults to `"meta-native"` when no config exists).
 */
export interface ModelConfigResponse {
    /** Automation engine: `"meta-native"` or `"sabnode-ai"`. */
    model: WachatAiModel;
}

/**
 * Body for `POST /v1/wachat/ai-training/samples/{projectId}/{phoneId}` —
 * create one training sample (a question/ideal-answer pair).
 */
export interface SampleBody {
    /** Customer question to train against. */
    question: string;
    /** Ideal answer the assistant should give. */
    answer: string;
}

/**
 * One persisted training sample, as the Rust handler cleans it
 * (`document_to_clean_json`): `_id` stringified, BSON dates as ISO strings.
 */
export interface TrainingSample {
    _id: string;
    userId: string;
    projectId: string;
    phoneNumberId: string;
    question: string;
    answer: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Response for `GET /v1/wachat/ai-training/samples/{projectId}/{phoneId}` —
 * the caller's saved samples as cleaned JSON docs.
 */
export interface ListSamplesResponse {
    samples: TrainingSample[];
}

/** `{ success: true }` envelope returned by the mutating endpoints. */
export interface SuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatAiTrainingApi = {
    getModelConfig: (projectId: string, phoneId: string) =>
        rustFetch<ModelConfigResponse>(
            `${BASE}/model-config/${encodeURIComponent(projectId)}/${encodeURIComponent(phoneId)}`,
        ),

    upsertModelConfig: (projectId: string, phoneId: string, body: ModelConfigBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/model-config/${encodeURIComponent(projectId)}/${encodeURIComponent(phoneId)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    listSamples: (projectId: string, phoneId: string) =>
        rustFetch<ListSamplesResponse>(
            `${BASE}/samples/${encodeURIComponent(projectId)}/${encodeURIComponent(phoneId)}`,
        ),

    createSample: (projectId: string, phoneId: string, body: SampleBody) =>
        rustFetch<TrainingSample>(
            `${BASE}/samples/${encodeURIComponent(projectId)}/${encodeURIComponent(phoneId)}`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    deleteSample: (projectId: string, phoneId: string, sampleId: string) =>
        rustFetch<SuccessResponse>(
            `${BASE}/samples/${encodeURIComponent(projectId)}/${encodeURIComponent(phoneId)}/${encodeURIComponent(sampleId)}`,
            { method: 'DELETE' },
        ),
};

export type WachatAiTrainingApi = typeof wachatAiTrainingApi;
