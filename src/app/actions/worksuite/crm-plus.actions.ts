'use server';

import { revalidatePath } from 'next/cache';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
} from '@/lib/hr-crud';
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
    '/dashboard/crm/sales-crm/pipelines',
    formData,
    { booleanKeys: ['default'] },
  );
}
export async function deleteLeadPipeline(id: string) {
  const r = await hrDelete(COL_PIPELINES, id);
  revalidatePath('/dashboard/crm/sales-crm/pipelines');
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

export async function getLeadNotes() {
  return hrList<WsLeadNote>(COL_LEAD_NOTES);
}
export async function getLeadNoteById(id: string) {
  return hrGetById<WsLeadNote>(COL_LEAD_NOTES, id);
}
export async function saveLeadNote(_prev: unknown, formData: FormData) {
  return genericSave(
    COL_LEAD_NOTES,
    '/dashboard/crm/sales-crm/notes',
    formData,
    { idFields: ['lead_id', 'added_by_user_id'] },
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
    { idFields: ['client_id', 'added_by_user_id'] },
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
