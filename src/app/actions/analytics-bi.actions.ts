'use server';

/**
 * Server actions for the standalone BI / Analytics workspace.
 *
 * All actions are thin pass-throughs over the Rust crates (`bi-datasets`,
 * `bi-dataset-joins`, `bi-workbooks`, `bi-charts`, `bi-schedules`,
 * `bi-embeds`). Tenancy is enforced by the Rust handlers via the
 * authenticated JWT.
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

const WORKSPACE_PATH = '/dashboard/analytics-workspace';

/* ─── Datasets ───────────────────────────────────────────────────────── */

export async function listDatasetsAction(params?: BiDatasetListParams) {
  return listBiDatasets(params);
}

export async function getDatasetAction(id: string): Promise<BiDatasetDoc> {
  return getBiDataset(id);
}

export async function createDatasetAction(input: BiDatasetCreateInput) {
  const res = await createBiDataset(input);
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  return res;
}

export async function updateDatasetAction(id: string, patch: BiDatasetUpdateInput) {
  const res = await updateBiDataset(id, patch);
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  revalidatePath(`${WORKSPACE_PATH}/datasets/${id}`);
  return res;
}

export async function deleteDatasetAction(id: string) {
  const res = await deleteBiDataset(id);
  revalidatePath(`${WORKSPACE_PATH}/datasets`);
  return res;
}

export async function refreshDatasetAction(id: string) {
  const res = await refreshBiDataset(id);
  revalidatePath(`${WORKSPACE_PATH}/datasets/${id}`);
  return res;
}

export async function previewDatasetAction(id: string) {
  return previewBiDataset(id);
}

/* ─── Joins ──────────────────────────────────────────────────────────── */

export async function listJoinsAction(params?: BiJoinListParams) {
  return listBiJoins(params);
}

export async function getJoinAction(id: string): Promise<BiDatasetJoinDoc> {
  return getBiJoin(id);
}

export async function createJoinAction(input: BiJoinCreateInput) {
  const res = await createBiJoin(input);
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

export async function updateJoinAction(id: string, patch: BiJoinUpdateInput) {
  const res = await updateBiJoin(id, patch);
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

export async function deleteJoinAction(id: string) {
  const res = await deleteBiJoin(id);
  revalidatePath(`${WORKSPACE_PATH}/datasets/joins`);
  return res;
}

/* ─── Workbooks ──────────────────────────────────────────────────────── */

export async function listWorkbooksAction(params?: BiWorkbookListParams) {
  return listBiWorkbooks(params);
}

export async function getWorkbookAction(id: string): Promise<BiWorkbookDoc> {
  return getBiWorkbook(id);
}

export async function createWorkbookAction(input: BiWorkbookCreateInput) {
  const res = await createBiWorkbook(input);
  revalidatePath(WORKSPACE_PATH);
  return res;
}

export async function updateWorkbookAction(id: string, patch: BiWorkbookUpdateInput) {
  const res = await updateBiWorkbook(id, patch);
  revalidatePath(WORKSPACE_PATH);
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${id}`);
  return res;
}

export async function deleteWorkbookAction(id: string) {
  const res = await deleteBiWorkbook(id);
  revalidatePath(WORKSPACE_PATH);
  return res;
}

/* ─── Charts ─────────────────────────────────────────────────────────── */

export async function listChartsAction(params?: BiChartListParams) {
  return listBiCharts(params);
}

export async function getChartAction(id: string): Promise<BiChartDoc> {
  return getBiChart(id);
}

export async function createChartAction(input: BiChartCreateInput) {
  const res = await createBiChart(input);
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${input.workbookId}`);
  return res;
}

export async function updateChartAction(id: string, patch: BiChartUpdateInput) {
  const res = await updateBiChart(id, patch);
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${res.workbookId}`);
  return res;
}

export async function deleteChartAction(id: string) {
  return deleteBiChart(id);
}

export async function runChartAction(
  id: string,
  input: BiChartRunInput = {},
): Promise<BiChartRunResponse> {
  return runBiChart(id, input);
}

/* ─── Schedules ──────────────────────────────────────────────────────── */

export async function listSchedulesAction(params?: BiScheduleListParams) {
  return listBiSchedules(params);
}

export async function createScheduleAction(input: BiScheduleCreateInput) {
  const res = await createBiSchedule(input);
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

export async function updateScheduleAction(id: string, patch: BiScheduleUpdateInput) {
  const res = await updateBiSchedule(id, patch);
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

export async function deleteScheduleAction(id: string) {
  const res = await deleteBiSchedule(id);
  revalidatePath(`${WORKSPACE_PATH}/schedules`);
  return res;
}

/* ─── Embeds ─────────────────────────────────────────────────────────── */

export async function listEmbedsAction(params?: BiEmbedListParams) {
  return listBiEmbeds(params);
}

export async function createEmbedAction(input: BiEmbedCreateInput): Promise<BiEmbedCreateResponse> {
  const res = await createBiEmbed(input);
  revalidatePath(`${WORKSPACE_PATH}/workbooks/${input.workbookId}`);
  return res;
}

export async function deleteEmbedAction(id: string) {
  return deleteBiEmbed(id);
}

export async function resolveEmbedAction(token: string): Promise<BiEmbedResolved> {
  return resolveBiEmbedByToken(token);
}


