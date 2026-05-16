import 'server-only';

/**
 * CRM Training client — wraps `/v1/crm/training`.
 */
import { rustFetch } from './fetcher';

export type CrmTrainingStatus =
  | 'planned'
  | 'open_for_enrollment'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type CrmTrainingType =
  | 'onboarding'
  | 'compliance'
  | 'technical'
  | 'soft_skills'
  | 'leadership';

export type CrmTrainingDeliveryMode =
  | 'classroom'
  | 'online'
  | 'hybrid'
  | 'self_paced';

export interface CrmTrainingDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  trainingType?: CrmTrainingType | string;
  deliveryMode?: CrmTrainingDeliveryMode | string;
  trainerName?: string;
  trainerId?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  durationHours?: number;
  location?: string;
  maxParticipants?: number;
  enrolled: number;
  completed: number;
  costPerPerson?: number;
  currency?: string;
  certificationProvided: boolean;
  materialsUrl?: string;
  isMandatory: boolean;
  departmentIds?: string[];
  status: CrmTrainingStatus;
  tags?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTrainingListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTrainingStatus | 'all';
  trainingType?: CrmTrainingType | string;
  isMandatory?: boolean;
}

export interface CrmTrainingListResponse {
  items: CrmTrainingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTrainingCreateInput {
  name: string;
  description?: string;
  trainingType?: CrmTrainingType | string;
  deliveryMode?: CrmTrainingDeliveryMode | string;
  trainerName?: string;
  trainerId?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  durationHours?: number;
  location?: string;
  maxParticipants?: number;
  costPerPerson?: number;
  currency?: string;
  certificationProvided?: boolean;
  materialsUrl?: string;
  isMandatory?: boolean;
  departmentIds?: string[];
  tags?: string[];
  notes?: string;
}

export type CrmTrainingUpdateInput = Partial<CrmTrainingCreateInput> & {
  enrolled?: number;
  completed?: number;
  status?: CrmTrainingStatus;
};

function buildListQuery(p?: CrmTrainingListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.trainingType) qs.set('trainingType', p.trainingType);
  if (p.isMandatory != null) qs.set('isMandatory', String(p.isMandatory));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTrainingApi = {
  list: (params?: CrmTrainingListParams) =>
    rustFetch<CrmTrainingListResponse>(
      `/v1/crm/training${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTrainingDoc>(
      `/v1/crm/training/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTrainingCreateInput) =>
    rustFetch<{ id: string; entity: CrmTrainingDoc }>(
      '/v1/crm/training',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTrainingUpdateInput) =>
    rustFetch<CrmTrainingDoc>(
      `/v1/crm/training/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/training/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
