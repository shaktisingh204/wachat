import 'server-only';

import { rustFetch } from './fetcher';

export type SablensAnnotationKind =
  | 'arrow'
  | 'circle'
  | 'rect'
  | 'freehand'
  | 'text';

export interface SablensAnnotationGeometry {
  /** Normalized points 0..1 — `[[x0, y0], [x1, y1], ...]`. */
  points: [number, number][];
  text?: string;
  size?: number;
}

export interface SablensAnnotationDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  slideOrFrameId?: string;
  ts: string;
  authorUserId?: string;
  kind: SablensAnnotationKind;
  geometryJson: SablensAnnotationGeometry;
  color: string;
  strokeWidth: number;
  persistent: boolean;
  createdAt?: string;
}

export interface SablensAnnotationListParams {
  sessionId?: string;
  kind?: SablensAnnotationKind;
  page?: number;
  limit?: number;
}

export interface SablensAnnotationListResponse {
  items: SablensAnnotationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SablensAnnotationCreateInput {
  sessionId: string;
  slideOrFrameId?: string;
  kind: SablensAnnotationKind;
  geometryJson: SablensAnnotationGeometry;
  color?: string;
  strokeWidth?: number;
  persistent?: boolean;
}

function buildListQuery(p?: SablensAnnotationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.sessionId) qs.set('sessionId', p.sessionId);
  if (p.kind) qs.set('kind', p.kind);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sablensAnnotationsApi = {
  list: (params?: SablensAnnotationListParams) =>
    rustFetch<SablensAnnotationListResponse>(
      `/v1/sablens/annotations${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SablensAnnotationDoc>(
      `/v1/sablens/annotations/${encodeURIComponent(id)}`,
    ),
  create: (input: SablensAnnotationCreateInput) =>
    rustFetch<{ id: string; entity: SablensAnnotationDoc }>(
      '/v1/sablens/annotations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sablens/annotations/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  clearSession: (sessionId: string) =>
    rustFetch<{ deleted: number }>(
      `/v1/sablens/annotations/by-session/${encodeURIComponent(sessionId)}/clear`,
      { method: 'POST', body: '{}' },
    ),
};
