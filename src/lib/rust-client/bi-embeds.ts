import 'server-only';

/**
 * BI Embeds client — wraps `/v1/bi/embeds` (auth) and
 * `/public/bi/embeds` (anonymous public token resolution).
 */
import { rustFetch } from './fetcher';

export type BiEmbedStatus = 'active' | 'revoked';

export interface BiEmbedDoc {
  _id: string;
  userId?: string;
  workbookId: string;
  token: string;
  expiresAt?: string;
  allowOrigins: string[];
  status: BiEmbedStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiEmbedListParams {
  page?: number;
  limit?: number;
  status?: BiEmbedStatus | 'active_visible' | 'all';
  workbookId?: string;
}

export interface BiEmbedListResponse {
  items: BiEmbedDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiEmbedCreateInput {
  workbookId: string;
  expiresAt?: string;
  allowOrigins?: string[];
}

export interface BiEmbedUpdateInput {
  expiresAt?: string;
  allowOrigins?: string[];
  status?: BiEmbedStatus;
}

export interface BiEmbedCreateResponse {
  id: string;
  entity: BiEmbedDoc;
  publicPath: string;
}

export interface BiEmbedResolved {
  workbookId: string;
  name: string;
  description?: string;
  charts: Record<string, unknown>[];
  allowOrigins: string[];
}

const BASE = '/v1/bi/embeds';
const PUBLIC_BASE = '/public/bi/embeds';

function buildQuery(params?: BiEmbedListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.workbookId) sp.set('workbookId', params.workbookId);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiEmbeds(params?: BiEmbedListParams): Promise<BiEmbedListResponse> {
  return rustFetch<BiEmbedListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function createBiEmbed(
  input: BiEmbedCreateInput,
): Promise<BiEmbedCreateResponse> {
  return rustFetch<BiEmbedCreateResponse>(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBiEmbed(
  id: string,
  patch: BiEmbedUpdateInput,
): Promise<BiEmbedDoc> {
  return rustFetch<BiEmbedDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiEmbed(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Public resolver — anonymous. The embed page (`/embed/bi/[token]`)
 * calls this server-side to render without forcing the viewer to log in.
 */
export async function resolveBiEmbedByToken(token: string): Promise<BiEmbedResolved> {
  return rustFetch<BiEmbedResolved>(`${PUBLIC_BASE}/${encodeURIComponent(token)}`);
}
