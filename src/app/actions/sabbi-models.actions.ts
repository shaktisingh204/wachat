'use server';

/**
 * Server actions for the SabBI semantic layer (models) + MetricQuery runs.
 *
 * Thin pass-throughs over the `bi-models` Rust client, each wrapped in
 * {@link runWithSabbiTenant} so the `sabbi-semantic` crate scopes every model
 * to the active project. The MetricQuery runner is the live query surface for
 * the visual builder, dashboards, and the AI copilot.
 */

import { revalidatePath } from 'next/cache';

import {
  createBiModel,
  deleteBiModel,
  getBiModel,
  listBiModels,
  runBiMetricQuery,
  runBiRawQuery,
  updateBiModel,
  type BiModelCreateInput,
  type BiModelDoc,
  type BiModelListParams,
  type BiModelUpdateInput,
  type MetricQueryInput,
  type RawQueryInput,
} from '@/lib/rust-client/bi-models';
import { clearVerified } from '@/lib/sabbi/governance.server';
import { cacheGet, cacheKey, cacheSet } from '@/lib/sabbi/query-cache';
import { getSabbiWorkspaceId, runWithSabbiTenant } from '@/lib/sabbi/workspace';

const MODELS_PATH = '/dashboard/sabbi/models';

export async function listModelsAction(params?: BiModelListParams) {
  return runWithSabbiTenant(() => listBiModels(params));
}

export async function getModelAction(id: string): Promise<BiModelDoc> {
  return runWithSabbiTenant(() => getBiModel(id));
}

export async function createModelAction(input: BiModelCreateInput) {
  const res = await runWithSabbiTenant(() => createBiModel(input));
  revalidatePath(MODELS_PATH);
  return res;
}

export async function updateModelAction(id: string, patch: BiModelUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiModel(id, patch));
  // Auto-strip verification when the model's LOGIC changes (Metabase pattern):
  // a "Verified" badge must never outlive an edit to its measures/dimensions.
  if (patch.measures || patch.dimensions || patch.collection || patch.baseFilter) {
    await clearVerified(id).catch(() => {});
  }
  revalidatePath(MODELS_PATH);
  revalidatePath(`${MODELS_PATH}/${id}`);
  return res;
}

export async function deleteModelAction(id: string) {
  const res = await runWithSabbiTenant(() => deleteBiModel(id));
  revalidatePath(MODELS_PATH);
  return res;
}

/**
 * Run a MetricQuery against a governed model → aggregated rows + columns.
 * Read-through cached per workspace+query (RBAC-safe; short TTL) so dashboards,
 * boards, and the copilot stay snappy on repeated identical queries.
 */
export async function runMetricQueryAction(query: MetricQueryInput) {
  const ws = await getSabbiWorkspaceId();
  const key = cacheKey(ws, query);
  const cached = cacheGet<Awaited<ReturnType<typeof runBiMetricQuery>>>(key);
  if (cached) return cached;
  const res = await runWithSabbiTenant(() => runBiMetricQuery(query));
  cacheSet(key, res);
  return res;
}

/** Run a raw (governed, sandboxed) aggregation pipeline — the Query Lab. */
export async function runRawQueryAction(query: RawQueryInput) {
  return runWithSabbiTenant(() => runBiRawQuery(query));
}
