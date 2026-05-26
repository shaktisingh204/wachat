import 'server-only';

/**
 * SabSign templates client — wraps `/v1/sabsign/templates`.
 */
import { rustFetch } from './fetcher';
import type {
  EnvelopeField,
  EnvelopeSigner,
  RoutingOrder,
  RoutingRule,
} from './sabsign-envelopes';

export interface TemplateRecipientSlot {
  role: string;
  label: string;
  order: number;
  authMethod?: string;
}

export interface SabSignTemplateDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  docId: string;
  docUrl?: string;
  docName?: string;
  routingOrder: RoutingOrder;
  routingRules?: RoutingRule[];
  recipientSlots: TemplateRecipientSlot[];
  fields: EnvelopeField[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTemplateInput {
  name: string;
  docId: string;
  docUrl?: string;
  docName?: string;
  description?: string;
  routingOrder?: RoutingOrder;
  routingRules?: RoutingRule[];
  recipientSlots?: TemplateRecipientSlot[];
  fields?: EnvelopeField[];
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & {
  status?: 'active' | 'archived';
};

export interface InstantiateInput {
  envelopeName?: string;
  subject?: string;
  message?: string;
  signers: EnvelopeSigner[];
}

export interface TemplateListResponse {
  items: SabSignTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export const sabsignTemplatesApi = {
  list: (params?: { page?: number; limit?: number; q?: string; status?: 'active' | 'archived' | 'all' }) => {
    const u = new URLSearchParams();
    if (params?.page != null) u.set('page', String(params.page));
    if (params?.limit != null) u.set('limit', String(params.limit));
    if (params?.q) u.set('q', params.q);
    if (params?.status) u.set('status', params.status);
    const s = u.toString();
    return rustFetch<TemplateListResponse>(`/v1/sabsign/templates${s ? `?${s}` : ''}`);
  },
  getById: (id: string) =>
    rustFetch<SabSignTemplateDoc>(`/v1/sabsign/templates/${encodeURIComponent(id)}`),
  create: (input: CreateTemplateInput) =>
    rustFetch<{ id: string; entity: SabSignTemplateDoc }>(
      '/v1/sabsign/templates',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: UpdateTemplateInput) =>
    rustFetch<SabSignTemplateDoc>(
      `/v1/sabsign/templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabsign/templates/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  instantiate: (id: string, input: InstantiateInput) =>
    rustFetch<{ envelopeId: string }>(
      `/v1/sabsign/templates/${encodeURIComponent(id)}/instantiate`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
