'use server';

/**
 * Server actions for SabBI (the Business Intelligence module).
 *
 * All actions are thin pass-throughs over the Rust crates (`bi-datasets`,
 * `bi-dataset-joins`, `bi-workbooks`, `bi-charts`, `bi-schedules`,
 * `bi-embeds`). Every call is wrapped in {@link runWithSabbiTenant} so the
 * Rust handlers scope each collection to the active SabBI workspace (project)
 * via the JWT `tid` claim — see `src/lib/sabbi/workspace.ts`. The only
 * exception is {@link resolveEmbedAction}, which resolves a public token and is
 * intentionally tenant-agnostic.
 */

import { revalidatePath } from 'next/cache';

import {
  createBiDataset,
  deleteBiDataset,
  getBiDataset,
  listBiDatasets,
  previewBiDataset,
  refreshBiDataset,
  updateBiDataset,
  type BiDatasetCreateInput,
  type BiDatasetDoc,
  type BiDatasetListParams,
  type BiDatasetUpdateInput,
} from '@/lib/rust-client/bi-datasets';
import {
  createBiJoin,
  deleteBiJoin,
  getBiJoin,
  listBiJoins,
  updateBiJoin,
  type BiDatasetJoinDoc,
  type BiJoinCreateInput,
  type BiJoinListParams,
  type BiJoinUpdateInput,
} from '@/lib/rust-client/bi-dataset-joins';
import {
  createBiWorkbook,
  deleteBiWorkbook,
  getBiWorkbook,
  listBiWorkbooks,
  updateBiWorkbook,
  type BiWorkbookCreateInput,
  type BiWorkbookDoc,
  type BiWorkbookListParams,
  type BiWorkbookUpdateInput,
} from '@/lib/rust-client/bi-workbooks';
import {
  createBiChart,
  deleteBiChart,
  getBiChart,
  listBiCharts,
  runBiChart,
  updateBiChart,
  type BiChartCreateInput,
  type BiChartDoc,
  type BiChartListParams,
  type BiChartRunInput,
  type BiChartRunResponse,
  type BiChartUpdateInput,
} from '@/lib/rust-client/bi-charts';
import {
  createBiSchedule,
  deleteBiSchedule,
  listBiSchedules,
  updateBiSchedule,
  type BiScheduleCreateInput,
  type BiScheduleDoc,
  type BiScheduleListParams,
  type BiScheduleUpdateInput,
} from '@/lib/rust-client/bi-schedules';
import {
  createBiEmbed,
  deleteBiEmbed,
  listBiEmbeds,
  resolveBiEmbedByToken,
  type BiEmbedCreateInput,
  type BiEmbedCreateResponse,
  type BiEmbedDoc,
  type BiEmbedListParams,
  type BiEmbedResolved,
} from '@/lib/rust-client/bi-embeds';
import { runWithSabbiTenant } from '@/lib/sabbi/workspace';

const WORKSPACE_PATH = '/dashboard/sabbi';

/* ─── Datasets ───────────────────────────────────────────────────────── */

export async function listDatasetsAction(params?: BiDatasetListParams) {
  return runWithSabbiTenant(() => listBiDatasets(params));
}

export async function getDatasetAction(id: string): Promise<BiDatasetDoc> {
  return runWithSabbiTenant(() => getBiDataset(id));
}

export async function createDatasetAction(input: BiDatasetCreateInput) {
  const res = await runWithSabbiTenant(() => createBiDataset(input));
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  return res;
}

export async function updateDatasetAction(id: string, patch: BiDatasetUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiDataset(id, patch));
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  revalidatePath(`${WORKSPACE_PATH}/datasets/${id}`);
  return res;
}

export async function deleteDatasetAction(id: string) {
  const res = await runWithSabbiTenant(() => deleteBiDataset(id));
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  return res;
}

export async function refreshDatasetAction(id: string) {
  const res = await runWithSabbiTenant(() => refreshBiDataset(id));
  revalidatePath(`${WORKSPACE_PATH}/datasets/${id}`);
  return res;
}

export async function previewDatasetAction(id: string) {
  return runWithSabbiTenant(() => previewBiDataset(id));
}

/* ─── Joins ──────────────────────────────────────────────────────────── */

export async function listJoinsAction(params?: BiJoinListParams) {
  return runWithSabbiTenant(() => listBiJoins(params));
}

export async function getJoinAction(id: string): Promise<BiDatasetJoinDoc> {
  return runWithSabbiTenant(() => getBiJoin(id));
}

export async function createJoinAction(input: BiJoinCreateInput) {
  const res = await runWithSabbiTenant(() => createBiJoin(input));
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

export async function updateJoinAction(id: string, patch: BiJoinUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiJoin(id, patch));
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

export async function deleteJoinAction(id: string) {
  const res = await runWithSabbiTenant(() => deleteBiJoin(id));
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

/* ─── Workbooks ──────────────────────────────────────────────────────── */

export async function listWorkbooksAction(params?: BiWorkbookListParams) {
  return runWithSabbiTenant(() => listBiWorkbooks(params));
}

export async function getWorkbookAction(id: string): Promise<BiWorkbookDoc> {
  return runWithSabbiTenant(() => getBiWorkbook(id));
}

export async function createWorkbookAction(input: BiWorkbookCreateInput) {
  const res = await runWithSabbiTenant(() => createBiWorkbook(input));
  revalidatePath(`${WORKSPACE_PATH}/workbooks`);
  return res;
}

export async function updateWorkbookAction(id: string, patch: BiWorkbookUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiWorkbook(id, patch));
  revalidatePath(`${WORKSPACE_PATH}/workbooks`);
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${id}`);
  return res;
}

export async function deleteWorkbookAction(id: string) {
  const res = await runWithSabbiTenant(() => deleteBiWorkbook(id));
  revalidatePath(`${WORKSPACE_PATH}/workbooks`);
  return res;
}

/* ─── Charts ─────────────────────────────────────────────────────────── */

export async function listChartsAction(params?: BiChartListParams) {
  return runWithSabbiTenant(() => listBiCharts(params));
}

export async function getChartAction(id: string): Promise<BiChartDoc> {
  return runWithSabbiTenant(() => getBiChart(id));
}

export async function createChartAction(input: BiChartCreateInput) {
  const res = await runWithSabbiTenant(() => createBiChart(input));
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${input.workbookId}`);
  return res;
}

export async function updateChartAction(id: string, patch: BiChartUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiChart(id, patch));
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${res.workbookId}`);
  return res;
}

export async function deleteChartAction(id: string) {
  return runWithSabbiTenant(() => deleteBiChart(id));
}

export async function runChartAction(
  id: string,
  input: BiChartRunInput = {},
): Promise<BiChartRunResponse> {
  return runWithSabbiTenant(() => runBiChart(id, input));
}

/* ─── Schedules ──────────────────────────────────────────────────────── */

export async function listSchedulesAction(params?: BiScheduleListParams) {
  return runWithSabbiTenant(() => listBiSchedules(params));
}

export async function createScheduleAction(input: BiScheduleCreateInput) {
  const res = await runWithSabbiTenant(() => createBiSchedule(input));
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

export async function updateScheduleAction(id: string, patch: BiScheduleUpdateInput) {
  const res = await runWithSabbiTenant(() => updateBiSchedule(id, patch));
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

export async function deleteScheduleAction(id: string) {
  const res = await runWithSabbiTenant(() => deleteBiSchedule(id));
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

/* ─── Embeds ─────────────────────────────────────────────────────────── */

export async function listEmbedsAction(params?: BiEmbedListParams) {
  return runWithSabbiTenant(() => listBiEmbeds(params));
}

export async function createEmbedAction(input: BiEmbedCreateInput): Promise<BiEmbedCreateResponse> {
  const res = await runWithSabbiTenant(() => createBiEmbed(input));
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${input.workbookId}`);
  return res;
}

export async function deleteEmbedAction(id: string) {
  return runWithSabbiTenant(() => deleteBiEmbed(id));
}

/**
 * Resolve a public embed token. Intentionally NOT tenant-scoped — the token is
 * the capability, and the public viewer has no SabNode session/project. The
 * Rust resolver enforces the embed's own status/expiry/allow-origins.
 */
export async function resolveEmbedAction(token: string): Promise<BiEmbedResolved> {
  return resolveBiEmbedByToken(token);
}
