'use server';

/**
 * SabTables server actions — thin Next.js wrapper over the Rust BFF.
 *
 * Every action:
 *  - resolves the current session,
 *  - delegates to the corresponding `sabtables*Api` rust-client,
 *  - revalidates the affected `/dashboard/sabtables/...` route.
 *
 * The Rust backend is the single source of truth for SabTables; there
 * is no legacy direct-Mongo fallback because this module is greenfield.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
  sabtablesWorkspacesApi,
  type SabtablesWorkspaceCreateInput,
  type SabtablesWorkspaceUpdateInput,
  type SabtablesWorkspaceListParams,
} from '@/lib/rust-client/sabtables-workspaces';
import {
  sabtablesBasesApi,
  type SabtablesBaseCreateInput,
  type SabtablesBaseUpdateInput,
  type SabtablesBaseListParams,
} from '@/lib/rust-client/sabtables-bases';
import {
  sabtablesTablesApi,
  type SabtablesTableCreateInput,
  type SabtablesTableUpdateInput,
  type SabtablesTableListParams,
  type AddFieldInput,
  type UpdateFieldInput,
} from '@/lib/rust-client/sabtables-tables';
import {
  sabtablesRecordsApi,
  type SabtablesRecordCreateInput,
  type SabtablesRecordUpdateInput,
  type SabtablesRecordListParams,
  type EvaluateFormulaInput,
} from '@/lib/rust-client/sabtables-records';
import {
  sabtablesViewsApi,
  type SabtablesViewCreateInput,
  type SabtablesViewUpdateInput,
  type SabtablesViewListParams,
} from '@/lib/rust-client/sabtables-views';
import {
  sabtablesAutomationsApi,
  type SabtablesAutomationCreateInput,
  type SabtablesAutomationUpdateInput,
  type SabtablesAutomationListParams,
  type RunAutomationInput,
} from '@/lib/rust-client/sabtables-automations';
import {
  sabtablesCommentsApi,
  type SabtablesCommentCreateInput,
  type SabtablesCommentUpdateInput,
} from '@/lib/rust-client/sabtables-comments';

async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Not authenticated');
  }
  return session;
}

function bustWorkspace(workspaceId?: string) {
  revalidatePath('/dashboard/sabtables');
  if (workspaceId) revalidatePath(`/dashboard/sabtables/${workspaceId}`);
}

function bustBase(workspaceId: string, baseId?: string) {
  revalidatePath(`/dashboard/sabtables/${workspaceId}`);
  if (baseId) revalidatePath(`/dashboard/sabtables/${workspaceId}/${baseId}`);
}

function bustTable(workspaceId: string, baseId: string, tableId?: string) {
  revalidatePath(`/dashboard/sabtables/${workspaceId}/${baseId}`);
  if (tableId) revalidatePath(`/dashboard/sabtables/${workspaceId}/${baseId}/${tableId}`);
}

/* ──────────────── Workspaces ──────────────── */

export async function listSabtablesWorkspaces(params?: SabtablesWorkspaceListParams) {
  await requireSession();
  return sabtablesWorkspacesApi.list(params);
}

export async function getSabtablesWorkspace(id: string) {
  await requireSession();
  return sabtablesWorkspacesApi.getById(id);
}

export async function createSabtablesWorkspace(input: SabtablesWorkspaceCreateInput) {
  await requireSession();
  const res = await sabtablesWorkspacesApi.create(input);
  bustWorkspace(res.id);
  return res;
}

export async function updateSabtablesWorkspace(
  id: string,
  patch: SabtablesWorkspaceUpdateInput,
) {
  await requireSession();
  const res = await sabtablesWorkspacesApi.update(id, patch);
  bustWorkspace(id);
  return res;
}

export async function deleteSabtablesWorkspace(id: string) {
  await requireSession();
  const res = await sabtablesWorkspacesApi.delete(id);
  bustWorkspace();
  return res;
}

/* ──────────────── Bases ──────────────── */

export async function listSabtablesBases(params?: SabtablesBaseListParams) {
  await requireSession();
  return sabtablesBasesApi.list(params);
}

export async function getSabtablesBase(id: string) {
  await requireSession();
  return sabtablesBasesApi.getById(id);
}

export async function createSabtablesBase(input: SabtablesBaseCreateInput) {
  await requireSession();
  const res = await sabtablesBasesApi.create(input);
  bustBase(input.workspaceId, res.id);
  return res;
}

export async function updateSabtablesBase(
  workspaceId: string,
  id: string,
  patch: SabtablesBaseUpdateInput,
) {
  await requireSession();
  const res = await sabtablesBasesApi.update(id, patch);
  bustBase(workspaceId, id);
  return res;
}

export async function deleteSabtablesBase(workspaceId: string, id: string) {
  await requireSession();
  const res = await sabtablesBasesApi.delete(id);
  bustBase(workspaceId);
  return res;
}

/* ──────────────── Tables ──────────────── */

export async function listSabtablesTables(params?: SabtablesTableListParams) {
  await requireSession();
  return sabtablesTablesApi.list(params);
}

export async function getSabtablesTable(id: string) {
  await requireSession();
  return sabtablesTablesApi.getById(id);
}

export async function createSabtablesTable(
  workspaceId: string,
  input: SabtablesTableCreateInput,
) {
  await requireSession();
  const res = await sabtablesTablesApi.create(input);
  bustTable(workspaceId, input.baseId, res.id);
  return res;
}

export async function updateSabtablesTable(
  workspaceId: string,
  baseId: string,
  id: string,
  patch: SabtablesTableUpdateInput,
) {
  await requireSession();
  const res = await sabtablesTablesApi.update(id, patch);
  bustTable(workspaceId, baseId, id);
  return res;
}

export async function deleteSabtablesTable(workspaceId: string, baseId: string, id: string) {
  await requireSession();
  const res = await sabtablesTablesApi.delete(id);
  bustTable(workspaceId, baseId);
  return res;
}

export async function addSabtablesField(
  workspaceId: string,
  baseId: string,
  tableId: string,
  input: AddFieldInput,
) {
  await requireSession();
  const res = await sabtablesTablesApi.addField(tableId, input);
  bustTable(workspaceId, baseId, tableId);
  return res;
}

export async function updateSabtablesField(
  workspaceId: string,
  baseId: string,
  tableId: string,
  input: UpdateFieldInput,
) {
  await requireSession();
  const res = await sabtablesTablesApi.updateField(tableId, input);
  bustTable(workspaceId, baseId, tableId);
  return res;
}

export async function deleteSabtablesField(
  workspaceId: string,
  baseId: string,
  tableId: string,
  fieldId: string,
) {
  await requireSession();
  const res = await sabtablesTablesApi.deleteField(tableId, fieldId);
  bustTable(workspaceId, baseId, tableId);
  return res;
}

/* ──────────────── Records ──────────────── */

export async function listSabtablesRecords(params: SabtablesRecordListParams) {
  await requireSession();
  return sabtablesRecordsApi.list(params);
}

export async function getSabtablesRecord(id: string) {
  await requireSession();
  return sabtablesRecordsApi.getById(id);
}

export async function createSabtablesRecord(input: SabtablesRecordCreateInput) {
  await requireSession();
  return sabtablesRecordsApi.create(input);
}

export async function updateSabtablesRecord(id: string, patch: SabtablesRecordUpdateInput) {
  await requireSession();
  return sabtablesRecordsApi.update(id, patch);
}

export async function deleteSabtablesRecord(id: string) {
  await requireSession();
  return sabtablesRecordsApi.delete(id);
}

/** Preview a formula expression against a snapshot of field values. */
export async function evaluateSabtablesFormula(input: EvaluateFormulaInput) {
  await requireSession();
  return sabtablesRecordsApi.evaluateFormula(input);
}

/* ──────────────── Views ──────────────── */

export async function listSabtablesViews(params?: SabtablesViewListParams) {
  await requireSession();
  return sabtablesViewsApi.list(params);
}

export async function getSabtablesView(id: string) {
  await requireSession();
  return sabtablesViewsApi.getById(id);
}

export async function createSabtablesView(input: SabtablesViewCreateInput) {
  await requireSession();
  return sabtablesViewsApi.create(input);
}

export async function updateSabtablesView(id: string, patch: SabtablesViewUpdateInput) {
  await requireSession();
  return sabtablesViewsApi.update(id, patch);
}

export async function deleteSabtablesView(id: string) {
  await requireSession();
  return sabtablesViewsApi.delete(id);
}

/* ──────────────── Automations ──────────────── */

export async function listSabtablesAutomations(params?: SabtablesAutomationListParams) {
  await requireSession();
  return sabtablesAutomationsApi.list(params);
}

export async function getSabtablesAutomation(id: string) {
  await requireSession();
  return sabtablesAutomationsApi.getById(id);
}

export async function createSabtablesAutomation(input: SabtablesAutomationCreateInput) {
  await requireSession();
  return sabtablesAutomationsApi.create(input);
}

export async function updateSabtablesAutomation(
  id: string,
  patch: SabtablesAutomationUpdateInput,
) {
  await requireSession();
  return sabtablesAutomationsApi.update(id, patch);
}

export async function deleteSabtablesAutomation(id: string) {
  await requireSession();
  return sabtablesAutomationsApi.delete(id);
}

/** Manually fire an automation — used by the "Run now" test button. */
export async function runSabtablesAutomation(id: string, input: RunAutomationInput = {}) {
  await requireSession();
  return sabtablesAutomationsApi.run(id, input);
}

/* ──────────────── Comments ──────────────── */

export async function listSabtablesComments(recordId: string) {
  await requireSession();
  return sabtablesCommentsApi.list({ recordId });
}

export async function createSabtablesComment(input: SabtablesCommentCreateInput) {
  await requireSession();
  return sabtablesCommentsApi.create(input);
}

export async function updateSabtablesComment(id: string, patch: SabtablesCommentUpdateInput) {
  await requireSession();
  return sabtablesCommentsApi.update(id, patch);
}

export async function deleteSabtablesComment(id: string) {
  await requireSession();
  return sabtablesCommentsApi.delete(id);
}
