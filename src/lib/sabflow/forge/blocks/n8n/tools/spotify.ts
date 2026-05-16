/**
 * Forge block: Spotify
 *
 * Source: n8n-master/packages/nodes-base/nodes/Spotify/Spotify.node.ts
 *
 * Spotify access token (OAuth) passed inline as a `password` field.
 *
 * Operations covered:
 *   - search                   GET /search
 *   - track.get                GET /tracks/{id}
 *   - artist.get               GET /artists/{id}
 *   - album.get                GET /albums/{id}
 *   - user.me                  GET /me
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.spotify.com/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Spotify: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.query);
  const type = asString(ctx.options.type) || 'track';
  if (!q) throw new Error('Spotify: query is required');
  const params = new URLSearchParams({ q, type });
  const limit = asString(ctx.options.limit);
  const market = asString(ctx.options.market);
  if (limit) params.set('limit', limit);
  if (market) params.set('market', market);
  const res = await apiRequest({
    service: 'Spotify',
    method: 'GET',
    url: `${API}/search?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { results: res.data }, logs: [`Spotify search → ${q} (${type})`] };
}

async function trackGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.trackId);
  if (!id) throw new Error('Spotify: trackId is required');
  const res = await apiRequest({
    service: 'Spotify',
    method: 'GET',
    url: `${API}/tracks/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { track: res.data }, logs: [`Spotify track get → ${id}`] };
}

async function artistGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.artistId);
  if (!id) throw new Error('Spotify: artistId is required');
  const res = await apiRequest({
    service: 'Spotify',
    method: 'GET',
    url: `${API}/artists/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { artist: res.data }, logs: [`Spotify artist get → ${id}`] };
}

async function albumGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.albumId);
  if (!id) throw new Error('Spotify: albumId is required');
  const res = await apiRequest({
    service: 'Spotify',
    method: 'GET',
    url: `${API}/albums/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { album: res.data }, logs: [`Spotify album get → ${id}`] };
}

async function userMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Spotify',
    method: 'GET',
    url: `${API}/me`,
    headers: authHeader(ctx),
  });
  return { outputs: { user: res.data }, logs: ['Spotify user me'] };
}

const SEARCH_TYPE_OPTIONS = [
  { label: 'Track', value: 'track' },
  { label: 'Artist', value: 'artist' },
  { label: 'Album', value: 'album' },
  { label: 'Playlist', value: 'playlist' },
  { label: 'Show', value: 'show' },
  { label: 'Episode', value: 'episode' },
];

const block: ForgeBlock = {
  id: 'forge_spotify',
  name: 'Spotify',
  description: 'Search Spotify and fetch tracks, artists, albums and the current user.',
  iconName: 'LuMusic',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search',
      description: 'Search Spotify for tracks, artists, albums and more.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true, placeholder: 'remaster%20track:Doxy' },
        { id: 'type', label: 'Type', type: 'select', options: SEARCH_TYPE_OPTIONS, defaultValue: 'track' },
        { id: 'limit', label: 'Limit (1-50)', type: 'number' },
        { id: 'market', label: 'Market', type: 'text', placeholder: 'US' },
      ],
      run: search,
    },
    {
      id: 'track_get',
      label: 'Get track',
      description: 'Fetch a single track by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'trackId', label: 'Track ID', type: 'text', required: true },
      ],
      run: trackGet,
    },
    {
      id: 'artist_get',
      label: 'Get artist',
      description: 'Fetch a single artist by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'artistId', label: 'Artist ID', type: 'text', required: true },
      ],
      run: artistGet,
    },
    {
      id: 'album_get',
      label: 'Get album',
      description: 'Fetch a single album by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'albumId', label: 'Album ID', type: 'text', required: true },
      ],
      run: albumGet,
    },
    {
      id: 'user_me',
      label: 'Get current user',
      description: 'Fetch the profile of the authenticated user.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: userMe,
    },
  ],
};

registerForgeBlock(block);
export default block;
