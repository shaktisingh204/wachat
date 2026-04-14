import type { ObjectId } from 'mongodb';

/**
 * Worksuite CRM Plus (Lead pipeline + Client enhancements) — MongoDB type
 * definitions ported from the Worksuite (Laravel) schema at
 * `/Users/harshkhandelwal/Downloads/script/app/Models/`.
 *
 * Multi-tenant isolation is via `userId` (replacing Laravel `company_id`).
 * All entities carry `_id`, `userId`, `createdAt`, `updatedAt`.
 */

export interface WsCrmBase {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  addedBy?: ObjectId | string;
  lastUpdatedBy?: ObjectId | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Lead taxonomy
 * ══════════════════════════════════════════════════════════════════ */

export interface WsLeadSource extends WsCrmBase {
  type: string;
  color?: string; // hex
}

export interface WsLeadStatus extends WsCrmBase {
  type: string;
  color?: string; // hex
  default?: boolean;
  priority?: number;
}

export interface WsLeadCategory extends WsCrmBase {
  category_name: string;
  is_default?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Pipeline + Stages
 * ══════════════════════════════════════════════════════════════════ */

export interface WsLeadPipeline extends WsCrmBase {
  name: string;
  description?: string;
  default?: boolean;
}

export interface WsLeadPipelineStage extends WsCrmBase {
  pipeline_id: ObjectId | string;
  name: string;
  slug?: string;
  priority?: number;
  label_color?: string; // hex
}

/* ═══════════════════════════════════════════════════════════════════
 *  Agents, Custom forms, Notes, Products, Settings
 * ══════════════════════════════════════════════════════════════════ */

export interface WsLeadAgent extends WsCrmBase {
  user_id: ObjectId | string; // employee being assigned
  lead_id: ObjectId | string;
}

export type WsLeadCustomFormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'date'
  | 'number';

export interface WsLeadCustomForm extends WsCrmBase {
  field_name: string;
  field_type: WsLeadCustomFormFieldType;
  field_values?: string[]; // for select field type
  is_required?: boolean;
}

export interface WsLeadNote extends WsCrmBase {
  lead_id: ObjectId | string;
  title: string;
  details?: string;
  added_by_user_id?: ObjectId | string;
}

export interface WsLeadProduct extends WsCrmBase {
  lead_id: ObjectId | string;
  product_id: ObjectId | string;
  quantity: number;
  price: number;
  total?: number;
}

export interface WsLeadSetting extends WsCrmBase {
  form_id?: ObjectId | string;
  company_name?: string;
  logo?: string;
  default_url?: string;
  share_link?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Client taxonomy + sub-records
 * ══════════════════════════════════════════════════════════════════ */

export interface WsClientCategory extends WsCrmBase {
  category_name: string;
}

export interface WsClientSubCategory extends WsCrmBase {
  client_category_id: ObjectId | string;
  name: string;
}

export interface WsClientContact extends WsCrmBase {
  client_id: ObjectId | string; // account_id
  name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  is_primary?: boolean;
}

export interface WsClientDocument extends WsCrmBase {
  client_id: ObjectId | string;
  filename: string;
  url?: string;
  size?: number;
  uploaded_at?: Date | string;
}

export interface WsClientNote extends WsCrmBase {
  client_id: ObjectId | string;
  title: string;
  details?: string;
  added_by_user_id?: ObjectId | string;
}

export interface WsClientDetails extends WsCrmBase {
  client_id: ObjectId | string; // extends existing account record
  logo?: string;
  gstin?: string;
  pan?: string;
  shipping_address?: string;
  billing_address?: string;
  notes?: string;
}
