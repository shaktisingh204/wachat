/**
 * Conversion-rate optimization (CRO) helpers:
 *   - heatmap-event ingestion (validates + buckets)
 *   - funnel-drop analysis
 */
import type { FunnelDrop, FunnelStep, HeatmapEvent } from './types';

const VALID_EVENT_TYPES: HeatmapEvent['type'][] = ['click', 'scroll', 'move', 'rage-click', 'dead-click'];

export type IngestResult = {
  accepted: HeatmapEvent[];
  rejected: { event: unknown; reason: string }[];
};

/**
 * Validate and ingest a batch of heatmap events. Pure function — storage is
 * up to the caller. Sanitizes obvious bad data so downstream aggregation
 * never sees NaN coordinates.
 */
export function ingestHeatmapEvents(batch: unknown[]): IngestResult {
  const accepted: HeatmapEvent[] = [];
  const rejected: { event: unknown; reason: string }[] = [];

  for (const raw of batch) {
    const reason = validateEvent(raw);
    if (reason) {
      rejected.push({ event: raw, reason });
      continue;
    }
    accepted.push(raw as HeatmapEvent);
  }
  return { accepted, rejected };
}

function validateEvent(e: unknown): string | null {
  if (!e || typeof e !== 'object') return 'not_object';
  const ev = e as Record<string, unknown>;
  if (typeof ev.pageUrl !== 'string' || !ev.pageUrl) return 'missing_pageUrl';
  if (typeof ev.type !== 'string' || !VALID_EVENT_TYPES.includes(ev.type as HeatmapEvent['type'])) {
    return 'invalid_type';
  }
  if (typeof ev.x !== 'number' || !Number.isFinite(ev.x)) return 'invalid_x';
  if (typeof ev.y !== 'number' || !Number.isFinite(ev.y)) return 'invalid_y';
  if (typeof ev.viewportWidth !== 'number' || ev.viewportWidth <= 0) return 'invalid_viewport';
  if (typeof ev.viewportHeight !== 'number' || ev.viewportHeight <= 0) return 'invalid_viewport';
  if (typeof ev.timestamp !== 'string' || Number.isNaN(new Date(ev.timestamp).getTime())) {
    return 'invalid_timestamp';
  }
  if (typeof ev.visitorId !== 'string' || !ev.visitorId) return 'missing_visitorId';
  if (typeof ev.sessionId !== 'string' || !ev.sessionId) return 'missing_sessionId';
  return null;
}

export type HeatmapBucket = {
  pageUrl: string;
  type: HeatmapEvent['type'];
  /** Bucketed coordinates as a percentage of the viewport (0..100). */
  xPct: number;
  yPct: number;
  count: number;
};

/**
 * Aggregate events into percentage-bucketed cells, suitable for rendering
 * a heatmap that adapts to any viewport.
 */
export function aggregateHeatmap(events: HeatmapEvent[], cellSize = 5): HeatmapBucket[] {
  const map = new Map<string, HeatmapBucket>();
  for (const e of events) {
    const xPct = clamp(round((e.x / e.viewportWidth) * 100, cellSize), 0, 100);
    const yPct = clamp(round((e.y / e.viewportHeight) * 100, cellSize), 0, 100);
    const k = `${e.pageUrl}|${e.type}|${xPct}|${yPct}`;
    const cur = map.get(k);
    if (cur) cur.count += 1;
    else map.set(k, { pageUrl: e.pageUrl, type: e.type, xPct, yPct, count: 1 });
  }
  return Array.from(map.values());
}

/**
 * Funnel-drop analysis. For each consecutive step, compute drop rate
 * and flag steps that lose more than `flagThreshold` (default 50%).
 */
export function analyzeFunnel(steps: FunnelStep[], flagThreshold = 0.5): FunnelDrop[] {
  const drops: FunnelDrop[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i];
    const to = steps[i + 1];
    const denom = from.visitors;
    const dropRate = denom > 0 ? Math.max(0, (denom - to.visitors) / denom) : 0;
    drops.push({
      fromStep: from.name,
      toStep: to.name,
      dropRate,
      flagged: dropRate >= flagThreshold,
    });
  }
  return drops;
}

function round(n: number, step: number): number {
  return Math.round(n / step) * step;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
