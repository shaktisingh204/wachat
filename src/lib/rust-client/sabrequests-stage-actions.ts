import 'server-only';

/**
 * Stage Action audit log client — wraps `/v1/sabrequests/stage-actions`.
 *
 * Read-only — the audit rows are produced exclusively by
 * `sabrequestsInstancesApi.decide` (which goes through
 * `sabrequests-instances::decide_request` on the Rust side and atomically
 * writes the instance update + the action row).
 */
import { rustFetch } from './fetcher';

export type StageActionKind = 'approve' | 'reject' | 'reassign' | 'comment';

export interface StageActionDoc {
  _id: string;
  projectId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  requestId: string;
  stageIdx: number;
  actorId: string;
  action: StageActionKind | string;
  note?: string;
  ts?: string;
  reassignedTo?: string;
}

export interface StageActionListParams {
  page?: number;
  limit?: number;
  /** Required in practice — the timeline UI always passes one. */
  requestId: string;
  actorId?: string;
}

function buildListQuery(p: StageActionListParams): string {
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  qs.set('requestId', p.requestId);
  if (p.actorId) qs.set('actorId', p.actorId);
  return `?${qs.toString()}`;
}

export const sabrequestsStageActionsApi = {
  list: (params: StageActionListParams) =>
    rustFetch<StageActionDoc[]>(
      `/v1/sabrequests/stage-actions${buildListQuery(params)}`,
    ),
};
