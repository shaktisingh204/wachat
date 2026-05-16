/**
 * Forge block: OpenWeatherMap
 *
 * Source: n8n-master/packages/nodes-base/nodes/OpenWeatherMap/OpenWeatherMap.node.ts
 *
 * No SabFlow credential type — the OpenWeatherMap API key is taken as an
 * inline `password` field on every action. Wave 12 inline-auth policy.
 *
 * Operations covered:
 *   - current.by-city       GET /data/2.5/weather?q=…
 *   - current.by-coords     GET /data/2.5/weather?lat=…&lon=…
 *   - forecast.by-city      GET /data/2.5/forecast?q=…
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.openweathermap.org/data/2.5';

function requireApiKey(ctx: ForgeActionContext): string {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('OpenWeatherMap: apiKey is required');
  return key;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) u.set(k, v);
  }
  return u.toString();
}

async function currentByCity(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireApiKey(ctx);
  const city = asString(ctx.options.city);
  if (!city) throw new Error('OpenWeatherMap: city is required');
  const qs = buildQuery({
    q: city,
    appid: apiKey,
    units: asString(ctx.options.units) || 'metric',
    lang: asString(ctx.options.lang) || undefined,
  });
  const res = await apiRequest({
    service: 'OpenWeatherMap',
    method: 'GET',
    url: `${API}/weather?${qs}`,
  });
  return {
    outputs: { weather: res.data },
    logs: [`OpenWeatherMap current → ${city}`],
  };
}

async function currentByCoords(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireApiKey(ctx);
  const lat = asString(ctx.options.lat);
  const lon = asString(ctx.options.lon);
  if (!lat || !lon) throw new Error('OpenWeatherMap: lat and lon are required');
  const qs = buildQuery({
    lat,
    lon,
    appid: apiKey,
    units: asString(ctx.options.units) || 'metric',
    lang: asString(ctx.options.lang) || undefined,
  });
  const res = await apiRequest({
    service: 'OpenWeatherMap',
    method: 'GET',
    url: `${API}/weather?${qs}`,
  });
  return {
    outputs: { weather: res.data },
    logs: [`OpenWeatherMap current → ${lat},${lon}`],
  };
}

async function forecastByCity(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireApiKey(ctx);
  const city = asString(ctx.options.city);
  if (!city) throw new Error('OpenWeatherMap: city is required');
  const qs = buildQuery({
    q: city,
    appid: apiKey,
    units: asString(ctx.options.units) || 'metric',
    lang: asString(ctx.options.lang) || undefined,
  });
  const res = await apiRequest({
    service: 'OpenWeatherMap',
    method: 'GET',
    url: `${API}/forecast?${qs}`,
  });
  return {
    outputs: { forecast: res.data },
    logs: [`OpenWeatherMap forecast → ${city}`],
  };
}

const UNIT_OPTIONS = [
  { label: 'Metric (°C)', value: 'metric' },
  { label: 'Imperial (°F)', value: 'imperial' },
  { label: 'Standard (K)', value: 'standard' },
];

const block: ForgeBlock = {
  id: 'forge_openweathermap',
  name: 'OpenWeatherMap',
  description: 'Fetch current weather and forecasts from OpenWeatherMap.',
  iconName: 'LuCloudSun',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'current_by_city',
      label: 'Current weather by city',
      description: 'Fetch the current weather for a city name.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'city', label: 'City', type: 'text', required: true, placeholder: 'London,uk' },
        { id: 'units', label: 'Units', type: 'select', options: UNIT_OPTIONS, defaultValue: 'metric' },
        { id: 'lang', label: 'Language', type: 'text', placeholder: 'en' },
      ],
      run: currentByCity,
    },
    {
      id: 'current_by_coords',
      label: 'Current weather by coordinates',
      description: 'Fetch the current weather for a latitude/longitude pair.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'lat', label: 'Latitude', type: 'text', required: true, placeholder: '51.5074' },
        { id: 'lon', label: 'Longitude', type: 'text', required: true, placeholder: '-0.1278' },
        { id: 'units', label: 'Units', type: 'select', options: UNIT_OPTIONS, defaultValue: 'metric' },
        { id: 'lang', label: 'Language', type: 'text', placeholder: 'en' },
      ],
      run: currentByCoords,
    },
    {
      id: 'forecast_by_city',
      label: '5-day forecast by city',
      description: 'Fetch the 5-day / 3-hour forecast for a city.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'city', label: 'City', type: 'text', required: true, placeholder: 'London,uk' },
        { id: 'units', label: 'Units', type: 'select', options: UNIT_OPTIONS, defaultValue: 'metric' },
        { id: 'lang', label: 'Language', type: 'text', placeholder: 'en' },
      ],
      run: forecastByCity,
    },
  ],
};

registerForgeBlock(block);
export default block;
