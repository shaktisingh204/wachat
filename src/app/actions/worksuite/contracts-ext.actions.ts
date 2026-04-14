'use server';

import { revalidatePath } from 'next/cache';
import { hrList, hrGetById, hrSave, hrDelete, formToObject } from '@/lib/hr-crud';
import type {
  WsContractDiscussion,
  WsContractFile,
  WsContractRenew,
  WsContractSign,
  WsContractTemplate,
  WsContractType,
} from '@/lib/worksuite/contracts-ext-types';

type FormState = { message?: string; error?: string; id?: string };

const ROUTE_BASE = '/dashboard/crm/contracts';

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    booleanKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.booleanKeys || []) {
      if (data[k] !== undefined) {
        data[k] = data[k] === 'true' || data[k] === 'on' || data[k] === true;
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ── Contract Types ─────────────────────────────────────────────── */

const COL_TYPES = 'crm_contract_types';

export async function getContractTypes() {
  return hrList<WsContractType>(COL_TYPES);
}
export async function saveContractType(_prev: any, formData: FormData) {
  return genericSave(COL_TYPES, `${ROUTE_BASE}/types`, formData);
}
export async function deleteContractType(id: string) {
  const r = await hrDelete(COL_TYPES, id);
  revalidatePath(`${ROUTE_BASE}/types`);
  return r;
}

/* ── Contract Templates ─────────────────────────────────────────── */

const COL_TEMPLATES = 'crm_contract_templates';

export async function getContractTemplates() {
  return hrList<WsContractTemplate>(COL_TEMPLATES);
}
export async function getContractTemplateById(id: string) {
  return hrGetById<WsContractTemplate>(COL_TEMPLATES, id);
}
export async function saveContractTemplate(_prev: any, formData: FormData) {
  return genericSave(COL_TEMPLATES, `${ROUTE_BASE}/templates`, formData);
}
export async function deleteContractTemplate(id: string) {
  const r = await hrDelete(COL_TEMPLATES, id);
  revalidatePath(`${ROUTE_BASE}/templates`);
  return r;
}

/* ── Contract Discussions ──────────────────────────────────────── */

const COL_DISCUSSIONS = 'crm_contract_discussions';

export async function getContractDiscussions(contractId?: string) {
  if (contractId) {
    const all = await hrList<WsContractDiscussion>(COL_DISCUSSIONS, {
      extraFilter: { contract_id: contractId },
    });
    return all;
  }
  return hrList<WsContractDiscussion>(COL_DISCUSSIONS);
}
export async function saveContractDiscussion(_prev: any, formData: FormData) {
  return genericSave(COL_DISCUSSIONS, `${ROUTE_BASE}`, formData);
}
export async function deleteContractDiscussion(id: string) {
  const r = await hrDelete(COL_DISCUSSIONS, id);
  revalidatePath(`${ROUTE_BASE}`);
  return r;
}

/* ── Contract Files ─────────────────────────────────────────────── */

const COL_FILES = 'crm_contract_files';

export async function getContractFiles() {
  return hrList<WsContractFile>(COL_FILES);
}
export async function saveContractFile(_prev: any, formData: FormData) {
  return genericSave(COL_FILES, `${ROUTE_BASE}`, formData, {
    numericKeys: ['size'],
  });
}
export async function deleteContractFile(id: string) {
  const r = await hrDelete(COL_FILES, id);
  revalidatePath(`${ROUTE_BASE}`);
  return r;
}

/* ── Contract Renewals ─────────────────────────────────────────── */

const COL_RENEWS = 'crm_contract_renews';

export async function getContractRenewals() {
  return hrList<WsContractRenew>(COL_RENEWS);
}
export async function saveContractRenewal(_prev: any, formData: FormData) {
  return genericSave(COL_RENEWS, `${ROUTE_BASE}/renewals`, formData, {
    dateFields: ['from_date', 'to_date'],
    numericKeys: ['new_value'],
  });
}
export async function deleteContractRenewal(id: string) {
  const r = await hrDelete(COL_RENEWS, id);
  revalidatePath(`${ROUTE_BASE}/renewals`);
  return r;
}

/* ── Contract Signs ─────────────────────────────────────────────── */

const COL_SIGNS = 'crm_contract_signs';

export async function getContractSigns() {
  return hrList<WsContractSign>(COL_SIGNS);
}
export async function saveContractSign(_prev: any, formData: FormData) {
  return genericSave(COL_SIGNS, `${ROUTE_BASE}`, formData, {
    dateFields: ['signed_at'],
  });
}
export async function deleteContractSign(id: string) {
  const r = await hrDelete(COL_SIGNS, id);
  revalidatePath(`${ROUTE_BASE}`);
  return r;
}
