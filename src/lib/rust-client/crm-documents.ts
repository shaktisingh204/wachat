import 'server-only';

/**
 * CRM Documents client — wraps `/v1/crm/documents`.
 *
 * HR document tracking — contracts, IDs, certifications, etc. Links to
 * employees / candidates / contacts / accounts / vendors. Files come
 * from SabFiles (use `fileUrl` returned by `<SabFilePicker>` etc).
 */
import { rustFetch } from './fetcher';

export type CrmDocumentStatus =
  | 'pending'
  | 'verified'
  | 'expired'
  | 'rejected'
  | 'archived';

export type CrmDocumentCategory =
  | 'id_proof'
  | 'address_proof'
  | 'qualification'
  | 'experience'
  | 'contract'
  | 'appointment'
  | 'resignation'
  | 'other';

export type CrmDocumentEntityKind =
  | 'employee'
  | 'candidate'
  | 'contact'
  | 'account'
  | 'vendor';

export interface CrmDocumentDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  category?: CrmDocumentCategory;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  employeeId?: string;
  employeeName?: string;
  candidateId?: string;
  entityKind?: CrmDocumentEntityKind;
  entityId?: string;
  issueDate?: string;
  expiryDate?: string;
  documentNumber?: string;
  tags?: string[];
  notes?: string;
  isConfidential?: boolean;
  uploadedBy?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status: CrmDocumentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmDocumentListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmDocumentStatus | 'all';
  category?: CrmDocumentCategory;
  employeeId?: string;
  entityKind?: CrmDocumentEntityKind;
  entityId?: string;
}

export interface CrmDocumentListResponse {
  items: CrmDocumentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmDocumentCreateInput {
  name: string;
  description?: string;
  category?: CrmDocumentCategory;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  employeeId?: string;
  employeeName?: string;
  candidateId?: string;
  entityKind?: CrmDocumentEntityKind;
  entityId?: string;
  issueDate?: string;
  expiryDate?: string;
  documentNumber?: string;
  tags?: string[];
  notes?: string;
  isConfidential?: boolean;
}

export type CrmDocumentUpdateInput = Partial<CrmDocumentCreateInput> & {
  status?: CrmDocumentStatus;
  verifiedBy?: string;
};

function buildListQuery(p?: CrmDocumentListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.entityKind) qs.set('entityKind', p.entityKind);
  if (p.entityId) qs.set('entityId', p.entityId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDocumentsApi = {
  list: (params?: CrmDocumentListParams) =>
    rustFetch<CrmDocumentListResponse>(
      `/v1/crm/documents${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmDocumentDoc>(
      `/v1/crm/documents/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmDocumentCreateInput) =>
    rustFetch<{ id: string; entity: CrmDocumentDoc }>(
      '/v1/crm/documents',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmDocumentUpdateInput) =>
    rustFetch<CrmDocumentDoc>(
      `/v1/crm/documents/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/documents/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
