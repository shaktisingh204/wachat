import 'server-only';

/**
 * CRM Custom Fields client — wraps `/v1/crm/custom-fields`.
 *
 * Per-entity custom field definitions. Each row attaches to one entity kind
 * (contact, deal, lead, account, ticket, employee, ...) and describes a
 * single user-defined field (label, type, options, validation, layout).
 */
import { rustFetch } from './fetcher';

export type CrmCustomFieldStatus = 'active' | 'archived';

export type CrmCustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'url'
  | 'email'
  | 'phone'
  | 'file';

export interface CrmCustomFieldOption {
  value: string;
  label: string;
  color?: string;
  [key: string]: unknown;
}

export interface CrmCustomFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface CrmCustomFieldDoc {
  _id: string;
  userId?: string;
  entityKind: string;
  name: string;
  label: string;
  fieldType: CrmCustomFieldType;
  helpText?: string;
  placeholder?: string;
  defaultValue?: Record<string, unknown>;
  required: boolean;
  unique: boolean;
  options?: CrmCustomFieldOption[];
  validation?: CrmCustomFieldValidation;
  displayOrder: number;
  section?: string;
  visibleInList: boolean;
  visibleInForm: boolean;
  editableInForm: boolean;
  isActive: boolean;
  status: CrmCustomFieldStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCustomFieldListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmCustomFieldStatus | 'all';
  entityKind?: string;
  fieldType?: CrmCustomFieldType;
  section?: string;
}

export interface CrmCustomFieldListResponse {
  items: CrmCustomFieldDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCustomFieldCreateInput {
  entityKind: string;
  name: string;
  label: string;
  fieldType: CrmCustomFieldType;
  helpText?: string;
  placeholder?: string;
  defaultValue?: Record<string, unknown>;
  required?: boolean;
  unique?: boolean;
  options?: CrmCustomFieldOption[];
  validation?: CrmCustomFieldValidation;
  displayOrder?: number;
  section?: string;
  visibleInList?: boolean;
  visibleInForm?: boolean;
  editableInForm?: boolean;
  isActive?: boolean;
}

export type CrmCustomFieldUpdateInput = Partial<CrmCustomFieldCreateInput> & {
  status?: CrmCustomFieldStatus;
};

function buildListQuery(p?: CrmCustomFieldListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.entityKind) qs.set('entityKind', p.entityKind);
  if (p.fieldType) qs.set('fieldType', p.fieldType);
  if (p.section) qs.set('section', p.section);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCustomFieldsApi = {
  list: (params?: CrmCustomFieldListParams) =>
    rustFetch<CrmCustomFieldListResponse>(
      `/v1/crm/custom-fields${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmCustomFieldDoc>(
      `/v1/crm/custom-fields/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmCustomFieldCreateInput) =>
    rustFetch<{ id: string; entity: CrmCustomFieldDoc }>(
      '/v1/crm/custom-fields',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmCustomFieldUpdateInput) =>
    rustFetch<CrmCustomFieldDoc>(
      `/v1/crm/custom-fields/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/custom-fields/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
