/**
 * Forge block: QuickChart
 *
 * Source: n8n-master/packages/nodes-base/nodes/QuickChart/QuickChart.node.ts
 * Credential: none — QuickChart's free endpoint is unauthenticated.
 *
 * Operations covered:
 *   - chart.url            build a GET URL with the chart config embedded
 *   - chart.render-base64  POST /chart and return a base64 PNG/PDF/SVG payload
 *   - chart.short-url      POST /chart/create — returns a hosted short URL
 *
 * Deferred:
 *   - QuickChart paid tenant + API key support (env `QUICKCHART_KEY`)
 *   - binary image streaming into SabFiles
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const HOST = 'https://quickchart.io';

function parseChartConfig(v: unknown): unknown {
  const s = asString(v).trim();
  if (!s) throw new Error('QuickChart: chart configuration is required');
  try {
    return JSON.parse(s);
  } catch {
    // QuickChart also accepts JS-style object literals, but for the forge port
    // we require strict JSON to keep the runtime free of `eval`.
    throw new Error('QuickChart: chart configuration must be valid JSON');
  }
}

function buildQuery(ctx: ForgeActionContext, chart: unknown): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set('c', JSON.stringify(chart));
  const width = asNumber(ctx.options.width);
  const height = asNumber(ctx.options.height);
  const devicePixelRatio = asNumber(ctx.options.devicePixelRatio);
  const backgroundColor = asString(ctx.options.backgroundColor);
  const format = asString(ctx.options.format);
  if (width) qs.set('width', String(width));
  if (height) qs.set('height', String(height));
  if (devicePixelRatio) qs.set('devicePixelRatio', String(devicePixelRatio));
  if (backgroundColor) qs.set('backgroundColor', backgroundColor);
  if (format) qs.set('format', format);
  return qs;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function chartUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chart = parseChartConfig(ctx.options.chart);
  const qs = buildQuery(ctx, chart);
  const url = `${HOST}/chart?${qs.toString()}`;
  return {
    outputs: { url, length: url.length },
    logs: ['QuickChart url generated'],
  };
}

async function chartRenderBase64(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chart = parseChartConfig(ctx.options.chart);
  const body: Record<string, unknown> = { chart };
  const width = asNumber(ctx.options.width);
  const height = asNumber(ctx.options.height);
  const devicePixelRatio = asNumber(ctx.options.devicePixelRatio);
  const backgroundColor = asString(ctx.options.backgroundColor);
  const format = asString(ctx.options.format);
  if (width) body.width = width;
  if (height) body.height = height;
  if (devicePixelRatio) body.devicePixelRatio = devicePixelRatio;
  if (backgroundColor) body.backgroundColor = backgroundColor;
  if (format) body.format = format;

  const res = await fetch(`${HOST}/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickChart POST /chart failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  const contentType = res.headers.get('content-type') ?? 'image/png';
  return {
    outputs: { base64, contentType, dataUrl: `data:${contentType};base64,${base64}` },
    logs: [`QuickChart render → ${buf.byteLength} bytes`],
  };
}

async function chartShortUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chart = parseChartConfig(ctx.options.chart);
  const body: Record<string, unknown> = { chart };
  const width = asNumber(ctx.options.width);
  const height = asNumber(ctx.options.height);
  const backgroundColor = asString(ctx.options.backgroundColor);
  if (width) body.width = width;
  if (height) body.height = height;
  if (backgroundColor) body.backgroundColor = backgroundColor;

  const res = await apiRequest({
    service: 'QuickChart',
    method: 'POST',
    url: `${HOST}/chart/create`,
    json: body,
  });
  const data = res.data as { url?: string; success?: boolean };
  if (!data.url) throw new Error('QuickChart: short URL endpoint did not return a url');
  return {
    outputs: { url: data.url },
    logs: [`QuickChart short url → ${data.url}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const commonFields = [
  {
    id: 'chart',
    label: 'Chart configuration (JSON)',
    type: 'json' as const,
    required: true,
    placeholder: '{"type":"bar","data":{"labels":["A","B"],"datasets":[{"data":[1,2]}]}}',
  },
  { id: 'width', label: 'Width (px)', type: 'number' as const },
  { id: 'height', label: 'Height (px)', type: 'number' as const },
  { id: 'devicePixelRatio', label: 'Device pixel ratio', type: 'number' as const },
  { id: 'backgroundColor', label: 'Background color', type: 'text' as const, placeholder: 'white' },
  {
    id: 'format',
    label: 'Format',
    type: 'select' as const,
    options: [
      { label: 'PNG (default)', value: '' },
      { label: 'PNG', value: 'png' },
      { label: 'JPG', value: 'jpg' },
      { label: 'PDF', value: 'pdf' },
      { label: 'SVG', value: 'svg' },
      { label: 'WebP', value: 'webp' },
    ],
  },
];

const block: ForgeBlock = {
  id: 'forge_quickchart',
  name: 'QuickChart',
  description: 'Render Chart.js charts as URLs, base64 images or short links.',
  iconName: 'LuChartBar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chart_url',
      label: 'Build chart URL',
      description: 'Encode a Chart.js config into a QuickChart image URL.',
      fields: commonFields,
      run: chartUrl,
    },
    {
      id: 'chart_render_base64',
      label: 'Render chart (base64)',
      description: 'POST to QuickChart and receive the rendered image as base64.',
      fields: commonFields,
      run: chartRenderBase64,
    },
    {
      id: 'chart_short_url',
      label: 'Create short URL',
      description: 'Publish the chart to QuickChart and receive a hosted short link.',
      fields: commonFields.filter((f) => f.id !== 'devicePixelRatio' && f.id !== 'format'),
      run: chartShortUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
