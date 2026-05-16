/**
 * Forge block: NASA
 *
 * Source: n8n-master/packages/nodes-base/nodes/Nasa/Nasa.node.ts
 *
 * API key passed inline as a `password` field (DEMO_KEY works for testing).
 *
 * Operations covered:
 *   - apod.get                   GET /planetary/apod
 *   - mars-rover-photos.list     GET /mars-photos/api/v1/rovers/{rover}/photos
 *   - neo.feed                   GET /neo/rest/v1/feed
 *   - eonet.events               GET https://eonet.gsfc.nasa.gov/api/v3/events
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.nasa.gov';

function requireKey(ctx: ForgeActionContext): string {
  const k = asString(ctx.options.apiKey);
  if (!k) throw new Error('NASA: apiKey is required (use DEMO_KEY for testing)');
  return k;
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.set(k, v);
  }
  return u.toString();
}

async function apodGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const url = `${API}/planetary/apod?${qs({
    api_key: apiKey,
    date: asString(ctx.options.date),
    hd: asString(ctx.options.hd),
  })}`;
  const res = await apiRequest({ service: 'NASA', method: 'GET', url });
  return {
    outputs: { apod: res.data },
    logs: ['NASA APOD'],
  };
}

async function marsRoverPhotos(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const rover = asString(ctx.options.rover) || 'curiosity';
  const url = `${API}/mars-photos/api/v1/rovers/${encodeURIComponent(rover)}/photos?${qs({
    api_key: apiKey,
    sol: asString(ctx.options.sol),
    earth_date: asString(ctx.options.earthDate),
    camera: asString(ctx.options.camera),
    page: asString(ctx.options.page),
  })}`;
  const res = await apiRequest({ service: 'NASA', method: 'GET', url });
  return {
    outputs: { photos: res.data },
    logs: [`NASA mars-rover-photos → ${rover}`],
  };
}

async function neoFeed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const start = asString(ctx.options.startDate);
  if (!start) throw new Error('NASA: startDate is required');
  const url = `${API}/neo/rest/v1/feed?${qs({
    api_key: apiKey,
    start_date: start,
    end_date: asString(ctx.options.endDate),
  })}`;
  const res = await apiRequest({ service: 'NASA', method: 'GET', url });
  return {
    outputs: { neo: res.data },
    logs: [`NASA NEO feed → ${start}`],
  };
}

async function eonetEvents(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // EONET is on a different host and does not require the api.nasa.gov key.
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?${qs({
    status: asString(ctx.options.status) || 'open',
    limit: asString(ctx.options.limit),
    days: asString(ctx.options.days),
    category: asString(ctx.options.category),
  })}`;
  const res = await apiRequest({ service: 'NASA-EONET', method: 'GET', url });
  return {
    outputs: { events: res.data },
    logs: ['NASA EONET events'],
  };
}

const ROVERS = [
  { label: 'Curiosity', value: 'curiosity' },
  { label: 'Opportunity', value: 'opportunity' },
  { label: 'Spirit', value: 'spirit' },
  { label: 'Perseverance', value: 'perseverance' },
];

const block: ForgeBlock = {
  id: 'forge_nasa',
  name: 'NASA',
  description: 'Fetch APOD, Mars rover photos, near-earth objects and EONET events.',
  iconName: 'LuRocket',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'apod_get',
      label: 'Astronomy Picture of the Day',
      description: 'Fetch APOD for today or a specific date.',
      fields: [
        { id: 'apiKey', label: 'API key (or DEMO_KEY)', type: 'password', required: true, defaultValue: 'DEMO_KEY' },
        { id: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
        { id: 'hd', label: 'HD (true/false)', type: 'text' },
      ],
      run: apodGet,
    },
    {
      id: 'mars_rover_photos',
      label: 'Mars rover photos',
      description: 'Fetch photos taken by a Mars rover on a given sol or Earth date.',
      fields: [
        { id: 'apiKey', label: 'API key (or DEMO_KEY)', type: 'password', required: true, defaultValue: 'DEMO_KEY' },
        { id: 'rover', label: 'Rover', type: 'select', options: ROVERS, defaultValue: 'curiosity' },
        { id: 'sol', label: 'Sol', type: 'number' },
        { id: 'earthDate', label: 'Earth date (YYYY-MM-DD)', type: 'text' },
        { id: 'camera', label: 'Camera', type: 'text' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: marsRoverPhotos,
    },
    {
      id: 'neo_feed',
      label: 'Near-earth objects feed',
      description: 'Fetch near-earth objects between two dates (max 7 days).',
      fields: [
        { id: 'apiKey', label: 'API key (or DEMO_KEY)', type: 'password', required: true, defaultValue: 'DEMO_KEY' },
        { id: 'startDate', label: 'Start date (YYYY-MM-DD)', type: 'text', required: true },
        { id: 'endDate', label: 'End date (YYYY-MM-DD)', type: 'text' },
      ],
      run: neoFeed,
    },
    {
      id: 'eonet_events',
      label: 'EONET natural events',
      description: 'Fetch natural events from the EONET feed (no API key required).',
      fields: [
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
            { label: 'All', value: 'all' },
          ],
          defaultValue: 'open',
        },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'days', label: 'Days back', type: 'number' },
        { id: 'category', label: 'Category id', type: 'text' },
      ],
      run: eonetEvents,
    },
  ],
};

registerForgeBlock(block);
export default block;
