/**
 * Metrics pipeline — thin wrapper over a Mongo time-series collection.
 *
 * The collection is named `analytics_metrics` and is created lazily as a
 * time-series collection on first write. Reads use the aggregation pipeline
 * with `$dateTrunc` to bucket by the requested granularity.
 */

import 'server-only';

import type {
    AggregateFn,
    Granularity,
    Metric,
    MetricQuery,
    MetricQueryResult,
    MetricSeriesPoint,
} from './types';

const COLLECTION = 'analytics_metrics';

/** Lazy-import Mongo so this module remains tree-shakeable / test-friendly. */
async function db() {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    return db;
}

let ensured = false;
async function ensureCollection() {
    if (ensured) return;
    const database = await db();
    const existing = await database
        .listCollections({ name: COLLECTION })
        .toArray();
    if (existing.length === 0) {
        try {
            await database.createCollection(COLLECTION, {
                timeseries: {
                    timeField: 'ts',
                    metaField: 'meta',
                    granularity: 'minutes',
                },
            } as any);
        } catch {
            // Mongo < 5 fallback — fall back to a plain collection.
            await database.createCollection(COLLECTION).catch(() => {});
        }
        await database
            .collection(COLLECTION)
            .createIndex({ 'meta.tenantId': 1, 'meta.name': 1, ts: -1 })
            .catch(() => {});
    }
    ensured = true;
}

export interface RecordMetricInput {
    tenantId: string;
    name: string;
    value: number;
    dimensions?: Record<string, string | number | boolean>;
    ts?: Date | string | number;
}

export async function recordMetric(input: RecordMetricInput): Promise<void> {
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.name) throw new Error('metric name is required');
    if (typeof input.value !== 'number' || Number.isNaN(input.value)) {
        throw new Error('metric value must be a finite number');
    }
    await ensureCollection();
    const database = await db();
    const ts = input.ts instanceof Date ? input.ts : new Date(input.ts ?? Date.now());
    await database.collection(COLLECTION).insertOne({
        ts,
        value: input.value,
        meta: {
            tenantId: input.tenantId,
            name: input.name,
            ...(input.dimensions ?? {}),
        },
    });
}

const GRAN_TO_UNIT: Record<Granularity, { unit: string; binSize: number }> = {
    minute: { unit: 'minute', binSize: 1 },
    hour: { unit: 'hour', binSize: 1 },
    day: { unit: 'day', binSize: 1 },
    week: { unit: 'week', binSize: 1 },
    month: { unit: 'month', binSize: 1 },
};

function toDate(d: Date | string | number): Date {
    return d instanceof Date ? d : new Date(d);
}

/** Build the aggregation operator for a given aggregate function. */
function aggOp(agg: AggregateFn): Record<string, unknown> {
    switch (agg) {
        case 'sum':
            return { $sum: '$value' };
        case 'avg':
            return { $avg: '$value' };
        case 'min':
            return { $min: '$value' };
        case 'max':
            return { $max: '$value' };
        case 'count':
            return { $sum: 1 };
        case 'count_distinct':
            return { $addToSet: '$value' };
        case 'p50':
        case 'p95':
        case 'p99':
            return { $push: '$value' };
        default:
            return { $sum: '$value' };
    }
}

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor((p / 100) * sorted.length)),
    );
    return sorted[idx];
}

export async function queryMetric(query: MetricQuery): Promise<MetricQueryResult> {
    await ensureCollection();
    const database = await db();
    const granularity: Granularity = query.range.granularity ?? 'day';
    const agg: AggregateFn = query.agg ?? 'sum';
    const from = toDate(query.range.from);
    const to = toDate(query.range.to);

    const match: Record<string, unknown> = {
        'meta.tenantId': query.tenantId,
        'meta.name': query.name,
        ts: { $gte: from, $lte: to },
    };
    if (query.filters) {
        for (const [k, v] of Object.entries(query.filters)) {
            (match as any)[`meta.${k}`] = v;
        }
    }

    const groupKey: Record<string, unknown> = {
        bucket: {
            $dateTrunc: {
                date: '$ts',
                ...GRAN_TO_UNIT[granularity],
            },
        },
    };
    for (const dim of query.groupBy ?? []) {
        groupKey[dim] = `$meta.${dim}`;
    }

    const pipeline: any[] = [
        { $match: match },
        { $group: { _id: groupKey, agg: aggOp(agg) } },
        { $sort: { '_id.bucket': 1 } },
    ];

    const docs = await database.collection(COLLECTION).aggregate(pipeline).toArray();

    const points: MetricSeriesPoint[] = docs.map((d: any) => {
        const dimensions: Record<string, string | number | boolean> = {};
        for (const dim of query.groupBy ?? []) {
            dimensions[dim] = d._id[dim];
        }
        let value: number;
        if (agg === 'count_distinct') {
            value = Array.isArray(d.agg) ? new Set(d.agg).size : 0;
        } else if (agg === 'p50') {
            value = percentile(d.agg as number[], 50);
        } else if (agg === 'p95') {
            value = percentile(d.agg as number[], 95);
        } else if (agg === 'p99') {
            value = percentile(d.agg as number[], 99);
        } else {
            value = typeof d.agg === 'number' ? d.agg : 0;
        }
        return {
            bucket: new Date(d._id.bucket).toISOString(),
            value,
            ...(query.groupBy && query.groupBy.length > 0 ? { dimensions } : {}),
        };
    });

    return { name: query.name, agg, granularity, points };
}

/** Convenience helper for ad-hoc reads (used by alerts.ts). */
export async function readWindow(
    tenantId: string,
    name: string,
    windowMinutes: number,
    agg: AggregateFn = 'sum',
): Promise<number> {
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60_000);
    const result = await queryMetric({
        tenantId,
        name,
        range: { from, to, granularity: 'minute' },
        agg,
    });
    if (result.points.length === 0) return 0;
    if (agg === 'avg') {
        const sum = result.points.reduce((s, p) => s + p.value, 0);
        return sum / result.points.length;
    }
    if (agg === 'max') return Math.max(...result.points.map((p) => p.value));
    if (agg === 'min') return Math.min(...result.points.map((p) => p.value));
    return result.points.reduce((s, p) => s + p.value, 0);
}

export type { Metric };
