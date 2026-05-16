/**
 * Forge block: YouTube
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/YouTube/YouTube.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - video.list    GET /youtube/v3/videos
 *   - video.search  GET /youtube/v3/search
 *   - channel.get   GET /youtube/v3/channels
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'YouTube';
const CACHE = 'google_youtube';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

// ── Actions ────────────────────────────────────────────────────────────────

async function videoList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const ids = asString(ctx.options.id);
  if (!ids) throw new Error(`${SERVICE}: id is required (comma-separated video IDs)`);
  const part = asString(ctx.options.part) || 'snippet,statistics,contentDetails';
  const params = new URLSearchParams();
  params.set('id', ids);
  params.set('part', part);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`YouTube video list → ${ids}`] };
}

async function videoSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const q = asString(ctx.options.q);
  if (!q) throw new Error(`${SERVICE}: q is required`);
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('part', asString(ctx.options.part) || 'snippet');
  params.set('type', asString(ctx.options.type) || 'video');
  const maxResults = asString(ctx.options.maxResults);
  const pageToken = asString(ctx.options.pageToken);
  const order = asString(ctx.options.order);
  if (maxResults) params.set('maxResults', maxResults);
  if (pageToken) params.set('pageToken', pageToken);
  if (order) params.set('order', order);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`YouTube search → ${q}`] };
}

async function channelGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const id = asString(ctx.options.id);
  const forUsername = asString(ctx.options.forUsername);
  const mine = asString(ctx.options.mine);
  const part = asString(ctx.options.part) || 'snippet,statistics,contentDetails';
  if (!id && !forUsername && !mine) {
    throw new Error(`${SERVICE}: one of id, forUsername, or mine (true) is required`);
  }
  const params = new URLSearchParams();
  params.set('part', part);
  if (id) params.set('id', id);
  if (forUsername) params.set('forUsername', forUsername);
  if (mine) params.set('mine', mine);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['YouTube channel get'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_youtube',
  name: 'YouTube',
  description: 'List videos by id, search videos, and fetch channel info.',
  iconName: 'LuYoutube',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'video_list',
      label: 'List videos',
      description: 'Get one or more videos by id.',
      fields: [
        ...authFields,
        { id: 'id', label: 'Video IDs (comma-separated)', type: 'text', required: true },
        { id: 'part', label: 'Part', type: 'text', defaultValue: 'snippet,statistics,contentDetails' },
      ],
      run: videoList,
    },
    {
      id: 'video_search',
      label: 'Search videos',
      description: 'Search YouTube for videos matching a query.',
      fields: [
        ...authFields,
        { id: 'q', label: 'Query', type: 'text', required: true },
        { id: 'part', label: 'Part', type: 'text', defaultValue: 'snippet' },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'video', value: 'video' },
            { label: 'channel', value: 'channel' },
            { label: 'playlist', value: 'playlist' },
          ],
          defaultValue: 'video',
        },
        { id: 'maxResults', label: 'Max results', type: 'number' },
        { id: 'pageToken', label: 'Page token', type: 'text' },
        {
          id: 'order',
          label: 'Order',
          type: 'select',
          options: [
            { label: 'relevance', value: 'relevance' },
            { label: 'date', value: 'date' },
            { label: 'rating', value: 'rating' },
            { label: 'title', value: 'title' },
            { label: 'viewCount', value: 'viewCount' },
          ],
        },
      ],
      run: videoSearch,
    },
    {
      id: 'channel_get',
      label: 'Get channel',
      description: 'Fetch channel info by id, username, or for the authenticated user (mine=true).',
      fields: [
        ...authFields,
        { id: 'id', label: 'Channel ID', type: 'text' },
        { id: 'forUsername', label: 'For username', type: 'text' },
        { id: 'mine', label: "Mine (true to use authed user's channel)", type: 'text' },
        { id: 'part', label: 'Part', type: 'text', defaultValue: 'snippet,statistics,contentDetails' },
      ],
      run: channelGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
