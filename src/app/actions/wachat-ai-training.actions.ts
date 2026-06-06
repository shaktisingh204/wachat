'use server';

/**
 * Wachat ai-training server actions.
 *
 * Thin shims over the `wachat-ai-training` Rust crate (mounted at
 * `/v1/wachat/ai-training`), which owns the per-number automation **model**
 * choice (`meta-native` / `sabnode-ai`) and the question/answer **training
 * samples** behind the `/wachat/automation` page's model picker + Train dialog.
 *
 * The crate scopes every read/write to the authenticated user plus the
 * `{projectId, phoneNumberId}` path pair, so these actions only:
 *   1. validate the required path scope + body,
 *   2. delegate to `wachatAiTrainingApi`,
 *   3. re-shape into the page's `{ success, ... }` / data contract,
 *   4. `revalidatePath('/wachat/automation')` on mutations.
 *
 * Imports the api namespace DIRECTLY (not via `@/lib/rust-client`) — the
 * barrel registration is wired centrally elsewhere.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatAiTrainingApi,
    type WachatAiModel,
    type TrainingSample,
} from '@/lib/rust-client/wachat-ai-training';
import { getErrorMessage } from '@/lib/utils';

const AUTOMATION_PATH = '/wachat/automation';
const ALLOWED_MODELS: readonly WachatAiModel[] = ['meta-native', 'sabnode-ai'];

// =================================================================
//  MODEL CONFIG
// =================================================================

export async function getAiModelConfig(
    projectId: string,
    phoneNumberId: string,
): Promise<{ model: WachatAiModel } | { error: string }> {
    if (!projectId || !phoneNumberId) {
        return { error: 'projectId and phoneNumberId are required.' };
    }
    try {
        const r = await wachatAiTrainingApi.getModelConfig(projectId, phoneNumberId);
        return { model: r.model };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveAiModelConfig(
    projectId: string,
    phoneNumberId: string,
    model: WachatAiModel,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !phoneNumberId) {
        return { success: false, error: 'projectId and phoneNumberId are required.' };
    }
    if (!ALLOWED_MODELS.includes(model)) {
        return { success: false, error: "model must be 'meta-native' or 'sabnode-ai'." };
    }
    try {
        const r = await wachatAiTrainingApi.upsertModelConfig(projectId, phoneNumberId, { model });
        revalidatePath(AUTOMATION_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// =================================================================
//  TRAINING SAMPLES
// =================================================================

export async function getAiTrainingSamples(
    projectId: string,
    phoneNumberId: string,
): Promise<{ samples: TrainingSample[] } | { error: string }> {
    if (!projectId || !phoneNumberId) {
        return { error: 'projectId and phoneNumberId are required.' };
    }
    try {
        const r = await wachatAiTrainingApi.listSamples(projectId, phoneNumberId);
        return { samples: r.samples };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createAiTrainingSample(
    projectId: string,
    phoneNumberId: string,
    question: string,
    answer: string,
): Promise<{ sample: TrainingSample } | { error: string }> {
    if (!projectId || !phoneNumberId) {
        return { error: 'projectId and phoneNumberId are required.' };
    }
    if (!question?.trim() || !answer?.trim()) {
        return { error: 'Question and answer are required.' };
    }
    try {
        const sample = await wachatAiTrainingApi.createSample(projectId, phoneNumberId, {
            question: question.trim(),
            answer: answer.trim(),
        });
        revalidatePath(AUTOMATION_PATH);
        return { sample };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteAiTrainingSample(
    projectId: string,
    phoneNumberId: string,
    sampleId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !phoneNumberId || !sampleId) {
        return { success: false, error: 'projectId, phoneNumberId and sampleId are required.' };
    }
    try {
        const r = await wachatAiTrainingApi.deleteSample(projectId, phoneNumberId, sampleId);
        revalidatePath(AUTOMATION_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
