/**
 * Real-User-Monitoring (RUM) ingestion + percentile aggregation.
 *
 * The store here is intentionally simple — an in-process ring buffer keyed by
 * metric name. Production deployments will swap this for a sink (ClickHouse,
 * Tinybird, etc.) but the percentile helpers below are designed to be reused
 * regardless of where the events live.
 */

import type { RumEvent } from './types';

/** Ingestion buffer with per-metric rings. */
export class RumStore {
    private readonly buffers = new Map<string, RumEvent[]>();

    constructor(private readonly capacityPerMetric: number = 10_000) {}

    /** Record one event. Cheap and synchronous. */
    ingest(event: RumEvent): void {
        const bucket = this.buffers.get(event.metric) ?? [];
        bucket.push(event);
        if (bucket.length > this.capacityPerMetric) {
            bucket.splice(0, bucket.length - this.capacityPerMetric);
        }
        this.buffers.set(event.metric, bucket);
    }

    /** Bulk ingestion convenience. */
    ingestMany(events: Iterable<RumEvent>): void {
        for (const event of events) this.ingest(event);
    }

    /** Snapshot the current values for a metric — copy, not the live array. */
    valuesFor(metric: string, since?: number): number[] {
        const bucket = this.buffers.get(metric) ?? [];
        const out: number[] = [];
        for (const evt of bucket) {
            if (since !== undefined && evt.timestamp < since) continue;
            out.push(evt.value);
        }
        return out;
    }

    /** All metric names currently tracked. */
    metrics(): string[] {
        return [...this.buffers.keys()];
    }

    /** Number of stored events for a metric. */
    size(metric: string): number {
        return this.buffers.get(metric)?.length ?? 0;
    }

    /** Empty everything. */
    clear(): void {
        this.buffers.clear();
    }
}

/** A standard percentile bundle. */
export interface PercentileSnapshot {
    count: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    mean: number;
}

/**
 * Compute a single percentile from an array of numbers using linear
 * interpolation between closest ranks (the same definition R uses for
 * `type=7`, which is the default in NumPy and most statistical libs).
 *
 * `p` is in [0, 1]. Returns NaN for empty input.
 */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return Number.NaN;
    if (p <= 0) return Math.min(...values);
    if (p >= 1) return Math.max(...values);

    const sorted = [...values].sort((a, b) => a - b);
    const rank = p * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower]!;
    const weight = rank - lower;
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/** Compute a full p50/p75/p95/p99 snapshot. */
export function percentiles(values: number[]): PercentileSnapshot {
    if (values.length === 0) {
        return { count: 0, p50: 0, p75: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0 };
    }
    let min = values[0]!;
    let max = values[0]!;
    let sum = 0;
    for (const v of values) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
    }
    return {
        count: values.length,
        p50: percentile(values, 0.5),
        p75: percentile(values, 0.75),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        min,
        max,
        mean: sum / values.length,
    };
}

/** Convenience: percentile snapshot for a metric in a `RumStore`. */
export function metricSnapshot(store: RumStore, metric: string, since?: number): PercentileSnapshot {
    return percentiles(store.valuesFor(metric, since));
}

/** Default singleton store — handy in API routes that don't want to manage state. */
export const defaultRumStore = new RumStore();
