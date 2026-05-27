import 'server-only';

/**
 * CRM Delivery Challan client — wraps `/v1/crm/delivery-challans`.
 */
import { rustFetch } from './fetcher';

export type CrmChallanStatus =
  | 'Draft'
  | 'Issued'
  | 'Delivered'
  | 'Cancelled'
  | 'archived';

export interface CrmChallanLineItem {
  itemId?: string;
  description: string;
  quantity: number;
  unit?: string;
  hsnCode?: string;
}

export interface CrmTransportDetails {
  vehicleNumber?: string;
  driverName?: string;
  mode?: string;
}

export interface CrmDeliveryChallanDoc {
  _id: string;
  userId?: string;
  challanNumber: string;
  accountId?: string;
  challanDate: string;
  lineItems: CrmChallanLineItem[];
  reason?: string;
  transportDetails?: CrmTransportDetails;
  notes?: string;
  status?: CrmChallanStatus;
  designMetadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmChallanListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmChallanStatus | 'all';
  accountId?: string;
}

export interface CrmChallanListResponse {
  items: CrmDeliveryChallanDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmChallanCreateInput {
  challanNumber: string;
  accountId?: string;
  challanDate: string;
  lineItems: CrmChallanLineItem[];
  reason?: string;
  transportDetails?: CrmTransportDetails;
  notes?: string;
  /**
   * §13.5 lineage seeding — when both `fromKind` and `fromId` are set,
   * the Rust handler fetches the parent doc (scoped by `userId`) and
   * stamps the new challan's `lineage[]` with the parent's full
   * ancestry plus the parent itself. Allowed `fromKind` values:
   * `"salesOrder"`, `"invoice"`, `"quotation"`.
   */
  fromKind?: 'salesOrder' | 'invoice' | 'quotation';
  fromId?: string;
  designMetadata?: Record<string, unknown>;
}

export type CrmChallanUpdateInput = Partial<CrmChallanCreateInput> & {
  status?: CrmChallanStatus;
  designMetadata?: Record<string, unknown>;
};

function buildListQuery(p?: CrmChallanListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.accountId) qs.set('accountId', p.accountId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmDeliveryChallansApi = {
  list: (params?: CrmChallanListParams) =>
    rustFetch<CrmChallanListResponse>(
      `/v1/crm/delivery-challans${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmDeliveryChallanDoc>(
      `/v1/crm/delivery-challans/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmChallanCreateInput) =>
    rustFetch<{ id: string; entity: CrmDeliveryChallanDoc }>(
      '/v1/crm/delivery-challans',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmChallanUpdateInput) =>
    rustFetch<CrmDeliveryChallanDoc>(
      `/v1/crm/delivery-challans/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/delivery-challans/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
