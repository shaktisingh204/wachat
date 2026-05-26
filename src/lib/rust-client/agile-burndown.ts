import 'server-only';

/**
 * Agile Burndown client — wraps `/v1/agile/burndown`.
 */
import { rustFetch } from './fetcher';

export interface AgileBurndownSampleDoc {
  _id: string;
  userId?: string;
  sprintId: string;
  /** Zero-based day index within the sprint. */
  day: number;
  sampleDate: string;
  remainingPoints: number;
  createdAt: string;
}

export interface AgileBurndownListResponse {
  items: AgileBurndownSampleDoc[];
}

export interface AgileBurndownRecordInput {
  sprintId: string;
  day: number;
  sampleDate?: string;
  remainingPoints: number;
}

export const agileBurndownApi = {
  list: (sprintId: string) =>
    rustFetch<AgileBurndownListResponse>(
      `/v1/agile/burndown?sprintId=${encodeURIComponent(sprintId)}`,
    ),
  record: (input: AgileBurndownRecordInput) =>
    rustFetch<{ id: string; entity: AgileBurndownSampleDoc }>(
      '/v1/agile/burndown',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
