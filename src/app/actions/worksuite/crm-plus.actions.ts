'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import {
  hrList,
  hrListPaginated,
  hrGetById,
  hrSave,
  hrDelete,
  hrBulkDelete,
  hrBulkArchive,
  formToObject,
  requireSession,
} from '@/lib/hr-crud';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  WsLeadSource,
  WsLeadStatus,
  WsLeadCategory,
  WsLeadPipeline,
  WsLeadPipelineStage,
  WsLeadAgent,
  WsLeadCustomForm,
  WsLeadNote,
  WsLeadProduct,
  WsLeadSetting,
  WsClientCategory,
  WsClientSubCategory,
  WsClientContact,
  WsClientDocument,
  WsClientNote,
  WsClientDetails,
} from '@/lib/worksuite/crm-types';

/**
 * Worksuite CRM Plus server actions — Lead pipeline configuration and
 * Client sub-records. Each entity exposes generic
 *   get<Entity>s, get<Entity>ById, save<Entity>, delete<Entity>
 * via hrList/hrGetById/hrSave/hrDelete helpers, matching the hr.actions
 * pattern.
 */

type FormState = { message?: string; error?: string; id?: string };

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
    booleanKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave as string */
        }
      }
    }
    for (const k of options.booleanKeys || []) {
      if (data[k] !== undefined) {
        const v = data[k];
        data[k] = v === true || v === 'true' || v === 'on' || v === 'yes' || v === '1';
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save';
    return { error: msg };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Collections
 * ══════════════════════════════════════════════════════════════════ */

const COL_SOURCES = 'crm_lead_sources';
const COL_STATUSES = 'crm_lead_statuses';
const COL_LEAD_CATEGORIES = 'crm_lead_categories';
const COL_PIPELINES = 'crm_lead_pipelines';
const COL_STAGES = 'crm_lead_pipeline_stages';
const COL_AGENTS = 'crm_lead_agents';
const COL_CUSTOM_FORMS = 'crm_lead_custom_forms';
const COL_LEAD_NOTES = 'crm_lead_notes';
const COL_LEAD_PRODUCTS = 'crm_lead_products';
const COL_LEAD_SETTINGS = 'crm_lead_settings';
const COL_CLIENT_CATEGORIES = 'crm_client_categories';
const COL_CLIENT_SUB_CATEGORIES = 'crm_client_sub_categories';
const COL_CLIENT_CONTACTS = 'crm_client_contacts';
const COL_CLIENT_DOCUMENTS = 'crm_client_documents';
const COL_CLIENT_NOTES = 'crm_client_notes';
const COL_CLIENT_DETAILS = 'crm_client_details';

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Sources
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadSources() {
  return hrList<WsLeadSource>(COL_SOURCES);
}
export async function getLeadSourceById(id: string) {
  return hrGetById<WsLeadSource>(COL_SOURCES, id);
}
export async function saveLeadSource(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_SOURCES,
    '/dashboard/crm/sales-crm/sources',
    formData,
  );
}
export async function deleteLeadSource(id: string) {
  const r = await hrDelete(COL_SOURCES, id);
  revalidatePath('/dashboard/crm/sales-crm/sources');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Statuses
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadStatuses() {
  return hrList<WsLeadStatus>(COL_STATUSES, { sortBy: { priority: 1 } });
}
export async function getLeadStatusById(id: string) {
  return hrGetById<WsLeadStatus>(COL_STATUSES, id);
}
export async function saveLeadStatus(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_STATUSES,
    '/dashboard/crm/sales-crm/statuses',
    formData,
    {
      numericKeys: ['priority'],
      booleanKeys: ['default'],
    },
  );
}
export async function deleteLeadStatus(id: string) {
  const r = await hrDelete(COL_STATUSES, id);
  revalidatePath('/dashboard/crm/sales-crm/statuses');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Categories
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadCategories() {
  return hrList<WsLeadCategory>(COL_LEAD_CATEGORIES);
}
export async function getLeadCategoryById(id: string) {
  return hrGetById<WsLeadCategory>(COL_LEAD_CATEGORIES, id);
}
export async function saveLeadCategory(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_LEAD_CATEGORIES,
    '/dashboard/crm/sales-crm/categories',
    formData,
    {
      booleanKeys: ['is_default'],
    },
  );
}
export async function deleteLeadCategory(id: string) {
  const r = await hrDelete(COL_LEAD_CATEGORIES, id);
  revalidatePath('/dashboard/crm/sales-crm/categories');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Pipelines
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadPipelines() {
  return hrList<WsLeadPipeline>(COL_PIPELINES);
}
export async function getLeadPipelineById(id: string) {
  return hrGetById<WsLeadPipeline>(COL_PIPELINES, id);
}
export async function saveLeadPipeline(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_PIPELINES,
    '/dashboard/sabbigin/pipelines',
    formData,
    { booleanKeys: ['default'] },
  );
}
export async function deleteLeadPipeline(id: string) {
  const r = await hrDelete(COL_PIPELINES, id);
  revalidatePath('/dashboard/sabbigin/pipelines');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Pipeline Stages
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadPipelineStages() {
  return hrList<WsLeadPipelineStage>(COL_STAGES, { sortBy: { priority: 1 } });
}
export async function getLeadPipelineStageById(id: string) {
  return hrGetById<WsLeadPipelineStage>(COL_STAGES, id);
}
export async function saveLeadPipelineStage(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_STAGES,
    '/dashboard/crm/sales-crm/pipeline-stages',
    formData,
    {
      idFields: ['pipeline_id'],
      numericKeys: ['priority'],
    },
  );
}
export async function deleteLeadPipelineStage(id: string) {
  const r = await hrDelete(COL_STAGES, id);
  revalidatePath('/dashboard/crm/sales-crm/pipeline-stages');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Agents
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadAgents() {
  return hrList<WsLeadAgent>(COL_AGENTS);
}
export async function getLeadAgentById(id: string) {
  return hrGetById<WsLeadAgent>(COL_AGENTS, id);
}
export async function saveLeadAgent(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_AGENTS,
    '/dashboard/crm/sales-crm/agents',
    formData,
    { idFields: ['user_id', 'lead_id'] },
  );
}
export async function deleteLeadAgent(id: string) {
  const r = await hrDelete(COL_AGENTS, id);
  revalidatePath('/dashboard/crm/sales-crm/agents');
  return r;
}

/* ─── KPI aggregate for the lead-agents list page ───────────────────── */

export interface LeadAgentKpis {
  /** Total agent assignments for the tenant. */
  total: number;
  /** Distinct employee_id (user_id) count — i.e. active agents. */
  active: number;
  /** Total leads currently assigned (distinct lead_id). */
  leadsHandled: number;
  /** Display label (employee id) of the agent with the most leads. */
  topPerformerId: string;
  /** Count of leads handled by the top performer. */
  topPerformerLeads: number;
}

const EMPTY_AGENT_KPIS: LeadAgentKpis = {
  total: 0,
  active: 0,
  leadsHandled: 0,
  topPerformerId: '',
  topPerformerLeads: 0,
};

export async function getLeadAgentKpis(): Promise<LeadAgentKpis> {
  try {
    const rows = await hrList<WsLeadAgent>(COL_AGENTS);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ...EMPTY_AGENT_KPIS };
    }

    const userIds = new Set<string>();
    const leadIds = new Set<string>();
    const perUser = new Map<string, number>();

    for (const row of rows) {
      const uid = row.user_id ? String(row.user_id) : '';
      const lid = row.lead_id ? String(row.lead_id) : '';
      if (uid) {
        userIds.add(uid);
        perUser.set(uid, (perUser.get(uid) ?? 0) + 1);
      }
      if (lid) leadIds.add(lid);
    }

    let topPerformerId = '';
    let topPerformerLeads = 0;
    for (const [uid, count] of perUser) {
      if (count > topPerformerLeads) {
        topPerformerLeads = count;
        topPerformerId = uid;
      }
    }

    return {
      total: rows.length,
      active: userIds.size,
      leadsHandled: leadIds.size,
      topPerformerId,
      topPerformerLeads,
    };
  } catch (e) {
    console.error('[getLeadAgentKpis] failed:', e);
    return { ...EMPTY_AGENT_KPIS };
  }
}

/* ─── Bulk delete lead agents ───────────────────────────────────────── */

export async function bulkDeleteLeadAgents(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true, processed: 0 };
  }
  let processed = 0;
  let lastError: string | undefined;
  for (const id of ids) {
    try {
      const r = await hrDelete(COL_AGENTS, id);
      if (r.success) processed += 1;
      else if (r.error) lastError = r.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  revalidatePath('/dashboard/crm/sales-crm/agents');
  return {
    success: lastError === undefined,
    processed,
    error: lastError,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Custom Forms (field definitions)
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadCustomForms() {
  return hrList<WsLeadCustomForm>(COL_CUSTOM_FORMS);
}
export async function getLeadCustomFormById(id: string) {
  return hrGetById<WsLeadCustomForm>(COL_CUSTOM_FORMS, id);
}
export async function saveLeadCustomForm(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CUSTOM_FORMS,
    '/dashboard/crm/sales-crm/custom-forms',
    formData,
    {
      booleanKeys: ['is_required'],
      jsonKeys: ['field_values'],
    },
  );
}
export async function deleteLeadCustomForm(id: string) {
  const r = await hrDelete(COL_CUSTOM_FORMS, id);
  revalidatePath('/dashboard/crm/sales-crm/custom-forms');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Notes
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadNotes(params?: {
  limit?: number;
  skip?: number;
  q?: string;
  tag?: string;
  leadId?: string;
  from?: string;
  to?: string;
}) {
  const extraFilter: any = {};
  if (params?.q) {
    extraFilter.$or = [
      { title: { $regex: params.q, $options: 'i' } },
      { details: { $regex: params.q, $options: 'i' } },
      { 'mentions.label': { $regex: params.q, $options: 'i' } },
    ];
  }
  if (params?.tag) {
    extraFilter.tags = params.tag;
  }
  if (params?.leadId) {
    extraFilter.lead_id = params.leadId;
  }
  if (params?.from || params?.to) {
    extraFilter.createdAt = {};
    if (params.from) {
      extraFilter.createdAt.$gte = new Date(params.from).toISOString();
    }
    if (params.to) {
      extraFilter.createdAt.$lte = new Date(`${params.to}T23:59:59`).toISOString();
    }
  }

  return hrListPaginated<WsLeadNote>(COL_LEAD_NOTES, {
    limit: params?.limit,
    skip: params?.skip,
    extraFilter,
  });
}
export async function getLeadNoteById(id: string) {
  return hrGetById<WsLeadNote>(COL_LEAD_NOTES, id);
}
export async function saveLeadNote(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_LEAD_NOTES,
    '/dashboard/crm/sales-crm/notes',
    formData,
    {
      idFields: ['lead_id', 'added_by_user_id'],
      jsonKeys: ['tags'],
      booleanKeys: ['pinned'],
    },
  );
}
export async function deleteLeadNote(id: string) {
  const r = await hrDelete(COL_LEAD_NOTES, id);
  revalidatePath('/dashboard/crm/sales-crm/notes');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Products (line items linking leads to products)
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadProducts() {
  return hrList<WsLeadProduct>(COL_LEAD_PRODUCTS);
}
export async function getLeadProductById(id: string) {
  return hrGetById<WsLeadProduct>(COL_LEAD_PRODUCTS, id);
}
export async function saveLeadProduct(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_LEAD_PRODUCTS,
    '/dashboard/crm/sales-crm/products',
    formData,
    {
      idFields: ['lead_id', 'product_id'],
      numericKeys: ['quantity', 'price', 'total'],
    },
  );
}
export async function deleteLeadProduct(id: string) {
  const r = await hrDelete(COL_LEAD_PRODUCTS, id);
  revalidatePath('/dashboard/crm/sales-crm/products');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead Settings (capture form settings)
 * ══════════════════════════════════════════════════════════════════ */

export async function getLeadSettings() {
  return hrList<WsLeadSetting>(COL_LEAD_SETTINGS);
}
export async function getLeadSettingById(id: string) {
  return hrGetById<WsLeadSetting>(COL_LEAD_SETTINGS, id);
}
export async function saveLeadSetting(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_LEAD_SETTINGS,
    '/dashboard/crm/sales-crm/settings',
    formData,
    { idFields: ['form_id'] },
  );
}
export async function deleteLeadSetting(id: string) {
  const r = await hrDelete(COL_LEAD_SETTINGS, id);
  revalidatePath('/dashboard/crm/sales-crm/settings');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Categories
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientCategories() {
  return hrList<WsClientCategory>(COL_CLIENT_CATEGORIES);
}
export async function getClientCategoryById(id: string) {
  return hrGetById<WsClientCategory>(COL_CLIENT_CATEGORIES, id);
}
export async function saveClientCategory(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_CATEGORIES,
    '/dashboard/crm/sales/clients/categories',
    formData,
  );
}
export async function deleteClientCategory(id: string) {
  const r = await hrDelete(COL_CLIENT_CATEGORIES, id);
  revalidatePath('/dashboard/crm/sales/clients/categories');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Sub-Categories
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientSubCategories() {
  return hrList<WsClientSubCategory>(COL_CLIENT_SUB_CATEGORIES);
}
export async function getClientSubCategoryById(id: string) {
  return hrGetById<WsClientSubCategory>(COL_CLIENT_SUB_CATEGORIES, id);
}
export async function saveClientSubCategory(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_SUB_CATEGORIES,
    '/dashboard/crm/sales/clients/categories',
    formData,
    { idFields: ['client_category_id'] },
  );
}
export async function deleteClientSubCategory(id: string) {
  const r = await hrDelete(COL_CLIENT_SUB_CATEGORIES, id);
  revalidatePath('/dashboard/crm/sales/clients/categories');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Contacts
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientContacts() {
  return hrList<WsClientContact>(COL_CLIENT_CONTACTS);
}
export async function getClientContactById(id: string) {
  return hrGetById<WsClientContact>(COL_CLIENT_CONTACTS, id);
}
export async function saveClientContact(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_CONTACTS,
    '/dashboard/crm/sales/clients/contacts',
    formData,
    {
      idFields: ['client_id'],
      booleanKeys: ['is_primary'],
    },
  );
}
export async function deleteClientContact(id: string) {
  const r = await hrDelete(COL_CLIENT_CONTACTS, id);
  revalidatePath('/dashboard/crm/sales/clients/contacts');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Documents
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientDocuments() {
  return hrList<WsClientDocument>(COL_CLIENT_DOCUMENTS);
}
export async function getClientDocumentById(id: string) {
  return hrGetById<WsClientDocument>(COL_CLIENT_DOCUMENTS, id);
}
export async function saveClientDocument(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_DOCUMENTS,
    '/dashboard/crm/sales/clients/documents',
    formData,
    {
      idFields: ['client_id'],
      dateFields: ['uploaded_at'],
      numericKeys: ['size'],
    },
  );
}

/**
 * Lookup-only loaders for the deepened list pages — return id→label maps
 * so the row-level UI can render entity-aware breadcrumbs without
 * making per-row picker calls. Scoped via `lookupEntity` which already
 * enforces tenant isolation.
 */
export async function deleteClientDocument(id: string) {
  const r = await hrDelete(COL_CLIENT_DOCUMENTS, id);
  revalidatePath('/dashboard/crm/sales/clients/documents');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Notes
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientNotes() {
  return hrList<WsClientNote>(COL_CLIENT_NOTES);
}
export async function getClientNoteById(id: string) {
  return hrGetById<WsClientNote>(COL_CLIENT_NOTES, id);
}
export async function saveClientNote(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_NOTES,
    '/dashboard/crm/sales/clients/notes',
    formData,
    {
      idFields: ['client_id', 'added_by_user_id'],
      booleanKeys: ['pinned'],
    },
  );
}
export async function deleteClientNote(id: string) {
  const r = await hrDelete(COL_CLIENT_NOTES, id);
  revalidatePath('/dashboard/crm/sales/clients/notes');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client Details (extension for accounts)
 * ══════════════════════════════════════════════════════════════════ */

export async function getClientDetailsAll() {
  return hrList<WsClientDetails>(COL_CLIENT_DETAILS);
}
export async function getClientDetailsById(id: string) {
  return hrGetById<WsClientDetails>(COL_CLIENT_DETAILS, id);
}
export async function saveClientDetails(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_CLIENT_DETAILS,
    '/dashboard/crm/sales/clients',
    formData,
    { idFields: ['client_id'] },
  );
}
export async function deleteClientDetails(id: string) {
  const r = await hrDelete(COL_CLIENT_DETAILS, id);
  revalidatePath('/dashboard/crm/sales/clients');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk operations — delete + archive across Client/Lead sub-records.
 *  Each wraps the tenant-scoped hrBulkDelete / hrBulkArchive helpers
 *  in hr-crud.ts so multi-tenant isolation is preserved.
 * ══════════════════════════════════════════════════════════════════ */

export async function bulkDeleteClientCategories(ids: string[]) {
  const r = await hrBulkDelete(COL_CLIENT_CATEGORIES, ids);
  revalidatePath('/dashboard/crm/sales/clients/categories');
  return r;
}
export async function bulkArchiveClientCategories(ids: string[]) {
  const r = await hrBulkArchive(COL_CLIENT_CATEGORIES, ids);
  revalidatePath('/dashboard/crm/sales/clients/categories');
  return r;
}

export async function bulkDeleteClientContacts(ids: string[]) {
  const r = await hrBulkDelete(COL_CLIENT_CONTACTS, ids);
  revalidatePath('/dashboard/crm/sales/clients/contacts');
  return r;
}
export async function bulkArchiveClientContacts(ids: string[]) {
  const r = await hrBulkArchive(COL_CLIENT_CONTACTS, ids);
  revalidatePath('/dashboard/crm/sales/clients/contacts');
  return r;
}

export async function bulkDeleteClientDocuments(ids: string[]) {
  const r = await hrBulkDelete(COL_CLIENT_DOCUMENTS, ids);
  revalidatePath('/dashboard/crm/sales/clients/documents');
  return r;
}
export async function bulkArchiveClientDocuments(ids: string[]) {
  const r = await hrBulkArchive(COL_CLIENT_DOCUMENTS, ids);
  revalidatePath('/dashboard/crm/sales/clients/documents');
  return r;
}

export async function bulkDeleteClientNotes(ids: string[]) {
  const r = await hrBulkDelete(COL_CLIENT_NOTES, ids);
  revalidatePath('/dashboard/crm/sales/clients/notes');
  return r;
}
export async function bulkArchiveClientNotes(ids: string[]) {
  const r = await hrBulkArchive(COL_CLIENT_NOTES, ids);
  revalidatePath('/dashboard/crm/sales/clients/notes');
  return r;
}

export async function bulkDeleteLeadNotes(ids: string[]) {
  const r = await hrBulkDelete(COL_LEAD_NOTES, ids);
  revalidatePath('/dashboard/crm/sales-crm/notes');
  return r;
}
export async function bulkArchiveLeadNotes(ids: string[]) {
  const r = await hrBulkArchive(COL_LEAD_NOTES, ids);
  revalidatePath('/dashboard/crm/sales-crm/notes');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  KPI aggregations — computed server-side over the tenant's full
 *  collection so headline metrics stay accurate regardless of
 *  client-side filtering or pagination. All shapes are flat numbers
 *  + small label arrays to keep payloads tiny.
 * ══════════════════════════════════════════════════════════════════ */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function isWithinDays(value: unknown, days: number): boolean {
  if (!value) return false;
  const d = new Date(value as string | Date);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= days * MS_PER_DAY;
}

export interface ClientCategoryKpis {
  total: number;
  totalClientsAcrossCategories: number;
  topCategory: { id: string; label: string; count: number } | null;
  lastAdded: { id: string; label: string; at: string } | null;
}

export async function getClientCategoryKpis(): Promise<ClientCategoryKpis> {
  const [cats, subs] = await Promise.all([
    hrList<WsClientCategory>(COL_CLIENT_CATEGORIES),
    hrList<WsClientSubCategory>(COL_CLIENT_SUB_CATEGORIES),
  ]);

  const counts = new Map<string, number>();
  for (const s of subs) {
    const key = String(s.client_category_id ?? '');
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let topId = '';
  let topCount = 0;
  for (const [id, n] of counts) {
    if (n > topCount) {
      topId = id;
      topCount = n;
    }
  }
  const topRow = cats.find((c) => String(c._id) === topId) ?? null;

  const sorted = [...cats].sort((a, b) => {
    const da = new Date(String(a.createdAt ?? 0)).getTime();
    const db = new Date(String(b.createdAt ?? 0)).getTime();
    return db - da;
  });
  const last = sorted[0] ?? null;

  return {
    total: cats.length,
    totalClientsAcrossCategories: subs.length,
    topCategory: topRow
      ? {
          id: String(topRow._id),
          label: topRow.category_name,
          count: topCount,
        }
      : null,
    lastAdded: last
      ? {
          id: String(last._id),
          label: last.category_name,
          at: String(last.createdAt ?? ''),
        }
      : null,
  };
}

export interface ClientContactKpis {
  total: number;
  withEmail: number;
  recent7d: number;
  byClient: number;
}

export async function getClientContactKpis(): Promise<ClientContactKpis> {
  const rows = await hrList<WsClientContact>(COL_CLIENT_CONTACTS);
  const unique = new Set<string>();
  let withEmail = 0;
  let recent = 0;
  for (const r of rows) {
    if (r.email && String(r.email).trim()) withEmail += 1;
    if (isWithinDays(r.createdAt, 7)) recent += 1;
    if (r.client_id) unique.add(String(r.client_id));
  }
  return {
    total: rows.length,
    withEmail,
    recent7d: recent,
    byClient: unique.size,
  };
}

export interface ClientDocumentKpis {
  total: number;
  byType: Record<string, number>;
  recent7d: number;
  totalSizeBytes: number;
}

export async function getClientDocumentKpis(): Promise<ClientDocumentKpis> {
  const rows = await hrList<WsClientDocument>(COL_CLIENT_DOCUMENTS);
  const byType: Record<string, number> = {};
  let recent = 0;
  let size = 0;
  for (const r of rows) {
    const t = (r.doc_type as string) || 'other';
    byType[t] = (byType[t] ?? 0) + 1;
    if (isWithinDays(r.uploaded_at ?? r.createdAt, 7)) recent += 1;
    const n = Number(r.size);
    if (!isNaN(n)) size += n;
  }
  return {
    total: rows.length,
    byType,
    recent7d: recent,
    totalSizeBytes: size,
  };
}

export interface ClientNoteKpis {
  total: number;
  byClient: number;
  recent7d: number;
  pinned: number;
}

export async function getClientNoteKpis(): Promise<ClientNoteKpis> {
  const rows = await hrList<WsClientNote>(COL_CLIENT_NOTES);
  const unique = new Set<string>();
  let recent = 0;
  let pinned = 0;
  for (const r of rows) {
    if (r.client_id) unique.add(String(r.client_id));
    if (isWithinDays(r.createdAt, 7)) recent += 1;
    if (r.pinned) pinned += 1;
  }
  return {
    total: rows.length,
    byClient: unique.size,
    recent7d: recent,
    pinned,
  };
}

export interface LeadNoteKpis {
  total: number;
  byLead: number;
  recent7d: number;
  byTag: Record<string, number>;
}

export async function getLeadNoteKpis(): Promise<LeadNoteKpis> {
  const rows = await hrList<WsLeadNote>(COL_LEAD_NOTES);
  const unique = new Set<string>();
  const byTag: Record<string, number> = {};
  let recent = 0;
  for (const r of rows) {
    if (r.lead_id) unique.add(String(r.lead_id));
    if (isWithinDays(r.createdAt, 7)) recent += 1;
    if (Array.isArray(r.tags)) {
      for (const t of r.tags) {
        const tag = String(t).trim();
        if (!tag) continue;
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }
    }
  }
  return {
    total: rows.length,
    byLead: unique.size,
    recent7d: recent,
    byTag,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 *  KPI aggregates + bulk-delete — Categories, Sources, Statuses
 * ══════════════════════════════════════════════════════════════════ */

/* ─── Category KPIs ─────────────────────────────────────────────── */

export interface LeadCategoryKpis {
  total: number;
  withDeals: number;
  withLeads: number;
  mostUsed: string;
}

export async function getLeadCategoryKpis(): Promise<LeadCategoryKpis> {
  try {
    const categories = await hrList<WsLeadCategory>(COL_LEAD_CATEGORIES);
    if (!categories.length) {
      return { total: 0, withDeals: 0, withLeads: 0, mostUsed: '—' };
    }

    const { db } = await connectToDatabase();
    const user = await requireSession();
    if (!user) return { total: categories.length, withDeals: 0, withLeads: 0, mostUsed: '—' };

    const userObjectId = new ObjectId(user._id);

    const [leadsRaw, dealsRaw] = await Promise.all([
      db
        .collection('crm_leads')
        .find({ userId: userObjectId }, { projection: { categoryId: 1, category: 1 } })
        .toArray(),
      db
        .collection('crm_deals')
        .find({ userId: userObjectId }, { projection: { categoryId: 1, category: 1 } })
        .toArray(),
    ]);

    const catIdSet = new Set(categories.map((c) => String(c._id)));
    const leadsByCat = new Map<string, number>();
    const dealsByCat = new Map<string, number>();

    for (const l of leadsRaw) {
      const cid = String((l as Record<string, unknown>).categoryId ?? (l as Record<string, unknown>).category ?? '');
      if (catIdSet.has(cid)) leadsByCat.set(cid, (leadsByCat.get(cid) ?? 0) + 1);
    }
    for (const d of dealsRaw) {
      const cid = String((d as Record<string, unknown>).categoryId ?? (d as Record<string, unknown>).category ?? '');
      if (catIdSet.has(cid)) dealsByCat.set(cid, (dealsByCat.get(cid) ?? 0) + 1);
    }

    const withLeads = new Set([...leadsByCat.keys()]).size;
    const withDeals = new Set([...dealsByCat.keys()]).size;

    let mostUsedId = '';
    let mostUsedCount = -1;
    for (const [id, count] of [...leadsByCat, ...dealsByCat]) {
      const total = (leadsByCat.get(id) ?? 0) + (dealsByCat.get(id) ?? 0);
      if (total > mostUsedCount) { mostUsedCount = total; mostUsedId = id; }
    }
    const mostUsedCat = categories.find((c) => String(c._id) === mostUsedId);
    const mostUsed = mostUsedCat?.category_name ?? (categories[0]?.category_name ?? '—');

    return { total: categories.length, withDeals, withLeads, mostUsed };
  } catch (e) {
    console.error('[getLeadCategoryKpis] failed:', e);
    return { total: 0, withDeals: 0, withLeads: 0, mostUsed: '—' };
  }
}

export async function bulkDeleteLeadCategories(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const r = await hrBulkDelete(COL_LEAD_CATEGORIES, ids);
  revalidatePath('/dashboard/crm/sales-crm/categories');
  return { success: r.success, processed: r.deleted, error: r.error };
}

/* ─── Source KPIs ───────────────────────────────────────────────── */

export interface LeadSourceKpis {
  total: number;
  withActiveLeads: number;
  topSource: string;
  topSourceLeads: number;
}

export async function getLeadSourceKpis(): Promise<LeadSourceKpis> {
  try {
    const sources = await hrList<WsLeadSource>(COL_SOURCES);
    if (!sources.length) {
      return { total: 0, withActiveLeads: 0, topSource: '—', topSourceLeads: 0 };
    }

    const { db } = await connectToDatabase();
    const user = await requireSession();
    if (!user) return { total: sources.length, withActiveLeads: 0, topSource: '—', topSourceLeads: 0 };

    const userObjectId = new ObjectId(user._id);
    const leadsRaw = await db
      .collection('crm_leads')
      .find(
        { userId: userObjectId },
        { projection: { sourceId: 1, source: 1, status: 1 } },
      )
      .toArray();

    const srcIdSet = new Set(sources.map((s) => String(s._id)));
    const countBySrc = new Map<string, number>();

    for (const l of leadsRaw) {
      const sid = String((l as Record<string, unknown>).sourceId ?? (l as Record<string, unknown>).source ?? '');
      if (srcIdSet.has(sid)) countBySrc.set(sid, (countBySrc.get(sid) ?? 0) + 1);
    }

    const withActiveLeads = countBySrc.size;
    let topSourceId = '';
    let topSourceLeads = 0;
    for (const [id, count] of countBySrc) {
      if (count > topSourceLeads) { topSourceLeads = count; topSourceId = id; }
    }
    const topSrc = sources.find((s) => String(s._id) === topSourceId);
    const topSource = topSrc?.type ?? (sources[0]?.type ?? '—');

    return { total: sources.length, withActiveLeads, topSource, topSourceLeads };
  } catch (e) {
    console.error('[getLeadSourceKpis] failed:', e);
    return { total: 0, withActiveLeads: 0, topSource: '—', topSourceLeads: 0 };
  }
}

export async function bulkDeleteLeadSources(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const r = await hrBulkDelete(COL_SOURCES, ids);
  revalidatePath('/dashboard/crm/sales-crm/sources');
  return { success: r.success, processed: r.deleted, error: r.error };
}

/* ─── Status KPIs ───────────────────────────────────────────────── */

export interface LeadStatusKpis {
  total: number;
  openCount: number;
  closedCount: number;
  wonLostCount: number;
}

export async function getLeadStatusKpis(): Promise<LeadStatusKpis> {
  try {
    const statuses = await hrList<WsLeadStatus>(COL_STATUSES);
    const total = statuses.length;
    const CLOSED_KEYWORDS = ['closed', 'won', 'lost', 'converted', 'disqualified', 'dead'];
    const WON_LOST_KEYWORDS = ['won', 'lost'];
    let openCount = 0;
    let closedCount = 0;
    let wonLostCount = 0;
    for (const s of statuses) {
      const name = (s.type ?? '').toLowerCase();
      const isWonLost = WON_LOST_KEYWORDS.some((k) => name.includes(k));
      const isClosed = CLOSED_KEYWORDS.some((k) => name.includes(k));
      if (isWonLost) wonLostCount += 1;
      if (isClosed) closedCount += 1;
      else openCount += 1;
    }
    return { total, openCount, closedCount, wonLostCount };
  } catch (e) {
    console.error('[getLeadStatusKpis] failed:', e);
    return { total: 0, openCount: 0, closedCount: 0, wonLostCount: 0 };
  }
}

export async function bulkDeleteLeadStatuses(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const r = await hrBulkDelete(COL_STATUSES, ids);
  revalidatePath('/dashboard/crm/sales-crm/statuses');
  return { success: r.success, processed: r.deleted, error: r.error };
}

/* ─── Sales CRM Settings (pipeline + lead + deal + notification) ── */

export interface SalesCrmConfig {
  _id?: string;
  userId?: string;
  // Pipeline
  defaultPipelineId?: string;
  autoProgression?: boolean;
  // Lead
  autoAssignLeads?: boolean;
  leadScoringEnabled?: boolean;
  defaultLeadStatusId?: string;
  // Deal
  probabilityTracking?: boolean;
  dealRotDays?: number;
  defaultCurrency?: string;
  // Notifications
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  updatedAt?: string;
}

const COL_SALES_CONFIG = 'crm_sales_config';

export async function getSalesCrmConfig(): Promise<SalesCrmConfig> {
  const { db } = await connectToDatabase();
  const user = await requireSession();
  if (!user) return {};
  const doc = await db
    .collection(COL_SALES_CONFIG)
    .findOne({ userId: new ObjectId(user._id) });
  if (!doc) return {};
  const out: SalesCrmConfig = {
    _id: String(doc._id),
    userId: String(doc.userId),
    defaultPipelineId: doc.defaultPipelineId ? String(doc.defaultPipelineId) : undefined,
    autoProgression: Boolean(doc.autoProgression),
    autoAssignLeads: Boolean(doc.autoAssignLeads),
    leadScoringEnabled: Boolean(doc.leadScoringEnabled),
    defaultLeadStatusId: doc.defaultLeadStatusId ? String(doc.defaultLeadStatusId) : undefined,
    probabilityTracking: Boolean(doc.probabilityTracking),
    dealRotDays: typeof doc.dealRotDays === 'number' ? doc.dealRotDays : 30,
    defaultCurrency: typeof doc.defaultCurrency === 'string' ? doc.defaultCurrency : 'INR',
    emailNotifications: Boolean(doc.emailNotifications),
    inAppNotifications: doc.inAppNotifications !== false,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : undefined,
  };
  return out;
}

type ConfigState = { message?: string; error?: string };

export async function saveSalesCrmPipelineConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const { db } = await connectToDatabase();
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const patch = {
    defaultPipelineId: formData.get('defaultPipelineId') as string | null || undefined,
    autoProgression: formData.get('autoProgression') === 'on',
    updatedAt: new Date(),
  };
  await db.collection(COL_SALES_CONFIG).updateOne(
    { userId: new ObjectId(user._id) },
    { $set: { ...patch, userId: new ObjectId(user._id) } },
    { upsert: true },
  );
  revalidatePath('/dashboard/crm/sales-crm/settings');
  return { message: 'Pipeline settings saved.' };
}

export async function saveSalesCrmLeadConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const { db } = await connectToDatabase();
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const patch = {
    autoAssignLeads: formData.get('autoAssignLeads') === 'on',
    leadScoringEnabled: formData.get('leadScoringEnabled') === 'on',
    defaultLeadStatusId: formData.get('defaultLeadStatusId') as string | null || undefined,
    updatedAt: new Date(),
  };
  await db.collection(COL_SALES_CONFIG).updateOne(
    { userId: new ObjectId(user._id) },
    { $set: { ...patch, userId: new ObjectId(user._id) } },
    { upsert: true },
  );
  revalidatePath('/dashboard/crm/sales-crm/settings');
  return { message: 'Lead settings saved.' };
}

export async function saveSalesCrmDealConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const { db } = await connectToDatabase();
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const rotRaw = Number(formData.get('dealRotDays'));
  const patch = {
    probabilityTracking: formData.get('probabilityTracking') === 'on',
    dealRotDays: Number.isFinite(rotRaw) ? rotRaw : 30,
    defaultCurrency: (formData.get('defaultCurrency') as string | null) || 'INR',
    updatedAt: new Date(),
  };
  await db.collection(COL_SALES_CONFIG).updateOne(
    { userId: new ObjectId(user._id) },
    { $set: { ...patch, userId: new ObjectId(user._id) } },
    { upsert: true },
  );
  revalidatePath('/dashboard/crm/sales-crm/settings');
  return { message: 'Deal settings saved.' };
}

export async function saveSalesCrmNotificationConfig(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const { db } = await connectToDatabase();
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const patch = {
    emailNotifications: formData.get('emailNotifications') === 'on',
    inAppNotifications: formData.get('inAppNotifications') === 'on',
    updatedAt: new Date(),
  };
  await db.collection(COL_SALES_CONFIG).updateOne(
    { userId: new ObjectId(user._id) },
    { $set: { ...patch, userId: new ObjectId(user._id) } },
    { upsert: true },
  );
  revalidatePath('/dashboard/crm/sales-crm/settings');
  return { message: 'Notification settings saved.' };
}
