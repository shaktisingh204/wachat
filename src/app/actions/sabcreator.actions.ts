'use server';

/**
 * SabCreator server actions — thin Next.js wrappers over the Rust BFF.
 *
 * Every action:
 *  - resolves the current session via `getSession()`,
 *  - delegates to the matching `sabcreator*Api` rust-client,
 *  - revalidates the affected `/dashboard/sabcreator/...` route.
 *
 * Runtime form submissions reuse the SabTables records API for storage,
 * and workflow execution delegates to SabFlow when `sabflowRefId` is set
 * (otherwise inline steps will be evaluated by a future SabCreator
 * step interpreter — currently a TODO marker).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
  sabcreatorAppsApi,
  type SabcreatorAppCreateInput,
  type SabcreatorAppListParams,
  type SabcreatorAppUpdateInput,
} from '@/lib/rust-client/sabcreator-apps';
import {
  sabcreatorFormsApi,
  type SabcreatorFormCreateInput,
  type SabcreatorFormListParams,
  type SabcreatorFormUpdateInput,
} from '@/lib/rust-client/sabcreator-forms';
import {
  sabcreatorPagesApi,
  type SabcreatorPageCreateInput,
  type SabcreatorPageListParams,
  type SabcreatorPageUpdateInput,
} from '@/lib/rust-client/sabcreator-pages';
import {
  sabcreatorWorkflowsApi,
  type SabcreatorWorkflowCreateInput,
  type SabcreatorWorkflowListParams,
  type SabcreatorWorkflowUpdateInput,
} from '@/lib/rust-client/sabcreator-workflows';
import {
  sabcreatorRolesApi,
  type SabcreatorRoleCreateInput,
  type SabcreatorRoleListParams,
  type SabcreatorRoleUpdateInput,
} from '@/lib/rust-client/sabcreator-roles';
import {
  sabcreatorRoleAssignmentsApi,
  type SabcreatorRoleAssignmentListParams,
} from '@/lib/rust-client/sabcreator-role-assignments';
import {
  sabcreatorPublishingApi,
  type SabcreatorPublicationListParams,
} from '@/lib/rust-client/sabcreator-publishing';
import { sabtablesRecordsApi } from '@/lib/rust-client/sabtables-records';
import { triggerExecution } from '@/lib/rust-client/sabflow-engine';

// ── session helper ───────────────────────────────────────────────────────────

async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Not authenticated');
  }
  return session;
}

function bustApps() {
  revalidatePath('/dashboard/sabcreator');
}
function bustApp(appId: string) {
  revalidatePath('/dashboard/sabcreator');
  revalidatePath(`/dashboard/sabcreator/${appId}/builder`);
  revalidatePath(`/dashboard/sabcreator/${appId}/preview`);
}
function bustForm(appId: string, formId?: string) {
  bustApp(appId);
  if (formId) revalidatePath(`/dashboard/sabcreator/${appId}/builder/forms/${formId}`);
}
function bustPage(appId: string, pageId?: string) {
  bustApp(appId);
  if (pageId) revalidatePath(`/dashboard/sabcreator/${appId}/builder/pages/${pageId}`);
}

// ── Apps ─────────────────────────────────────────────────────────────────────

export async function listSabcreatorApps(params?: SabcreatorAppListParams) {
  await requireSession();
  return sabcreatorAppsApi.list(params);
}

export async function getSabcreatorApp(appId: string) {
  await requireSession();
  return sabcreatorAppsApi.getById(appId);
}

export async function createSabcreatorApp(input: SabcreatorAppCreateInput) {
  await requireSession();
  const res = await sabcreatorAppsApi.create(input);
  bustApps();
  return res;
}

export async function updateSabcreatorApp(
  appId: string,
  patch: SabcreatorAppUpdateInput,
) {
  await requireSession();
  const res = await sabcreatorAppsApi.update(appId, patch);
  bustApp(appId);
  return res;
}

export async function deleteSabcreatorApp(appId: string) {
  await requireSession();
  const res = await sabcreatorAppsApi.delete(appId);
  bustApps();
  return res;
}

// ── Forms ────────────────────────────────────────────────────────────────────

export async function listSabcreatorForms(params: SabcreatorFormListParams) {
  await requireSession();
  return sabcreatorFormsApi.list(params);
}

export async function getSabcreatorForm(formId: string) {
  await requireSession();
  return sabcreatorFormsApi.getById(formId);
}

export async function createSabcreatorForm(input: SabcreatorFormCreateInput) {
  await requireSession();
  const res = await sabcreatorFormsApi.create(input);
  bustApp(input.appId);
  return res;
}

export async function updateSabcreatorForm(
  formId: string,
  appId: string,
  patch: SabcreatorFormUpdateInput,
) {
  await requireSession();
  const res = await sabcreatorFormsApi.update(formId, patch);
  bustForm(appId, formId);
  return res;
}

export async function deleteSabcreatorForm(formId: string, appId: string) {
  await requireSession();
  const res = await sabcreatorFormsApi.delete(formId);
  bustApp(appId);
  return res;
}

// ── Pages ────────────────────────────────────────────────────────────────────

export async function listSabcreatorPages(params: SabcreatorPageListParams) {
  await requireSession();
  return sabcreatorPagesApi.list(params);
}

export async function getSabcreatorPage(pageId: string) {
  await requireSession();
  return sabcreatorPagesApi.getById(pageId);
}

export async function createSabcreatorPage(input: SabcreatorPageCreateInput) {
  await requireSession();
  const res = await sabcreatorPagesApi.create(input);
  bustApp(input.appId);
  return res;
}

export async function updateSabcreatorPage(
  pageId: string,
  appId: string,
  patch: SabcreatorPageUpdateInput,
) {
  await requireSession();
  const res = await sabcreatorPagesApi.update(pageId, patch);
  bustPage(appId, pageId);
  return res;
}

export async function deleteSabcreatorPage(pageId: string, appId: string) {
  await requireSession();
  const res = await sabcreatorPagesApi.delete(pageId);
  bustApp(appId);
  return res;
}

// ── Workflows ────────────────────────────────────────────────────────────────

export async function listSabcreatorWorkflows(params: SabcreatorWorkflowListParams) {
  await requireSession();
  return sabcreatorWorkflowsApi.list(params);
}

export async function getSabcreatorWorkflow(workflowId: string) {
  await requireSession();
  return sabcreatorWorkflowsApi.getById(workflowId);
}

export async function createSabcreatorWorkflow(input: SabcreatorWorkflowCreateInput) {
  await requireSession();
  const res = await sabcreatorWorkflowsApi.create(input);
  bustApp(input.appId);
  return res;
}

export async function updateSabcreatorWorkflow(
  workflowId: string,
  appId: string,
  patch: SabcreatorWorkflowUpdateInput,
) {
  await requireSession();
  const res = await sabcreatorWorkflowsApi.update(workflowId, patch);
  bustApp(appId);
  return res;
}

export async function deleteSabcreatorWorkflow(workflowId: string, appId: string) {
  await requireSession();
  const res = await sabcreatorWorkflowsApi.delete(workflowId);
  bustApp(appId);
  return res;
}

/**
 * Run a workflow. If the workflow references a SabFlow flow
 * (`sabflowRefId`), delegate to the SabFlow engine via
 * `triggerExecution`. Otherwise mark the run + return — inline-step
 * interpretation is a TODO and currently no-ops.
 */
export async function runSabcreatorWorkflow(
  workflowId: string,
  triggerData?: unknown,
) {
  await requireSession();
  const workflow = await sabcreatorWorkflowsApi.getById(workflowId);
  // Stamp lastRunAt + verify ownership.
  await sabcreatorWorkflowsApi.run(workflowId, { triggerData });

  if (workflow.sabflowRefId) {
    const exec = await triggerExecution(workflow.sabflowRefId, {
      triggerMode: 'sabcreator',
      triggerData,
    });
    return { engine: 'sabflow' as const, executionId: exec.executionId };
  }

  // Inline-step interpreter — deferred. The workflow doc carries
  // `inlineStepsJson`; a future runner will evaluate it here.
  return {
    engine: 'inline' as const,
    executionId: null,
    note: 'inline workflow execution not yet implemented',
  };
}

// ── Roles & Assignments ──────────────────────────────────────────────────────

export async function listSabcreatorRoles(params: SabcreatorRoleListParams) {
  await requireSession();
  return sabcreatorRolesApi.list(params);
}

export async function createSabcreatorRole(input: SabcreatorRoleCreateInput) {
  await requireSession();
  const res = await sabcreatorRolesApi.create(input);
  bustApp(input.appId);
  return res;
}

export async function updateSabcreatorRole(
  roleId: string,
  appId: string,
  patch: SabcreatorRoleUpdateInput,
) {
  await requireSession();
  const res = await sabcreatorRolesApi.update(roleId, patch);
  bustApp(appId);
  return res;
}

export async function deleteSabcreatorRole(roleId: string, appId: string) {
  await requireSession();
  const res = await sabcreatorRolesApi.delete(roleId);
  bustApp(appId);
  return res;
}

export async function listSabcreatorRoleAssignments(
  params: SabcreatorRoleAssignmentListParams,
) {
  await requireSession();
  return sabcreatorRoleAssignmentsApi.list(params);
}

export async function assignSabcreatorRole(
  appId: string,
  userId: string,
  roleId: string,
) {
  await requireSession();
  const res = await sabcreatorRoleAssignmentsApi.create({
    appId,
    assigneeUserId: userId,
    roleId,
  });
  bustApp(appId);
  return res;
}

export async function unassignSabcreatorRole(assignmentId: string, appId: string) {
  await requireSession();
  const res = await sabcreatorRoleAssignmentsApi.delete(assignmentId);
  bustApp(appId);
  return res;
}

// ── Publishing ───────────────────────────────────────────────────────────────

export async function listSabcreatorPublications(
  params: SabcreatorPublicationListParams,
) {
  await requireSession();
  return sabcreatorPublishingApi.list(params);
}

export async function getLatestSabcreatorPublication(appId: string) {
  await requireSession();
  return sabcreatorPublishingApi.getLatestForApp(appId);
}

/**
 * Snapshot the current draft state of an App (its forms, pages,
 * workflows, roles) into a frozen Publication, then flip the app
 * status to `published`.
 */
export async function publishSabcreatorApp(appId: string) {
  await requireSession();
  const [app, forms, pages, workflows, roles] = await Promise.all([
    sabcreatorAppsApi.getById(appId),
    sabcreatorFormsApi.list({ appId, limit: 500 }),
    sabcreatorPagesApi.list({ appId, limit: 500 }),
    sabcreatorWorkflowsApi.list({ appId, limit: 500 }),
    sabcreatorRolesApi.list({ appId, limit: 500 }),
  ]);

  const snapshot = {
    app,
    forms: forms.items,
    pages: pages.items,
    workflows: workflows.items,
    roles: roles.items,
    snapshotAt: new Date().toISOString(),
  } as Record<string, unknown>;

  const res = await sabcreatorPublishingApi.publish({
    appId,
    snapshotJson: snapshot,
  });

  // Promote the app's status.
  await sabcreatorAppsApi.update(appId, { status: 'published' });
  bustApp(appId);
  return res;
}

// ── Runtime: form submission ────────────────────────────────────────────────

/**
 * Validate then submit a SabCreator form. Behaviour depends on the
 * form's `submitAction`:
 *   - `createRecord` → writes to the linked SabTables table.
 *   - `updateRecord` → patches `data.recordId` on the linked table.
 *   - `callWorkflow` → fires `runSabcreatorWorkflow(submitWorkflowId, …)`.
 */
export async function submitSabcreatorForm(
  formId: string,
  data: Record<string, unknown>,
) {
  await requireSession();
  const form = await sabcreatorFormsApi.getById(formId);

  // Lightweight required-field validation against `fieldsJson`.
  const fields = Array.isArray(form.fieldsJson) ? form.fieldsJson : [];
  const missing: string[] = [];
  for (const f of fields as Array<Record<string, unknown>>) {
    if (f?.required && (data[String(f.tableFieldId)] == null || data[String(f.tableFieldId)] === '')) {
      missing.push(String(f.label ?? f.tableFieldId));
    }
  }
  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (form.submitAction === 'callWorkflow') {
    if (!form.submitWorkflowId) {
      throw new Error('Form is configured to call a workflow but submitWorkflowId is empty');
    }
    return {
      kind: 'workflow' as const,
      result: await runSabcreatorWorkflow(form.submitWorkflowId, data),
    };
  }

  if (!form.sabtablesTableId) {
    throw new Error('Form has no linked SabTables table');
  }

  if (form.submitAction === 'updateRecord') {
    const recordId = String((data as Record<string, unknown>).recordId ?? '');
    if (!recordId) {
      throw new Error('updateRecord requires a `recordId` field in the payload');
    }
    const { recordId: _omit, ...rest } = data as Record<string, unknown>;
    const updated = await sabtablesRecordsApi.update(recordId, { fieldsJson: rest });
    return { kind: 'record' as const, action: 'update' as const, record: updated };
  }

  // Default: createRecord.
  const created = await sabtablesRecordsApi.create({
    tableId: form.sabtablesTableId,
    fieldsJson: data,
  });
  return { kind: 'record' as const, action: 'create' as const, record: created };
}
