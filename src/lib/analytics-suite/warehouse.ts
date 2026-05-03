/**
 * Warehouse mirror adapters. We intentionally do not pull in the
 * BigQuery / Snowflake / pg client SDKs here — those are heavyweight
 * and project-specific. Each adapter implements `MirrorAdapter` and
 * accepts a `pushBatch(rows)` call. Real cloud calls are stubbed to
 * an internal "_mirror_outbox_*" Mongo collection so retries can be
 * driven from a worker.
 */

import 'server-only';

import type { WarehouseMirrorConfig, WarehouseProvider } from './types';

export interface MirrorAdapter {
    readonly provider: WarehouseProvider;
    readonly dataset: string;
    readonly table: string;
    pushBatch(rows: Record<string, unknown>[]): Promise<MirrorPushResult>;
}

export interface MirrorPushResult {
    accepted: number;
    rejected: number;
    durationMs: number;
    error?: string;
}

async function db() {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    return db;
}

abstract class BaseAdapter implements MirrorAdapter {
    abstract readonly provider: WarehouseProvider;
    constructor(
        public readonly dataset: string,
        public readonly table: string,
        protected readonly tenantId: string,
    ) {}

    async pushBatch(rows: Record<string, unknown>[]): Promise<MirrorPushResult> {
        const start = Date.now();
        if (!Array.isArray(rows) || rows.length === 0) {
            return { accepted: 0, rejected: 0, durationMs: 0 };
        }
        try {
            await this.persistOutbox(rows);
            return {
                accepted: rows.length,
                rejected: 0,
                durationMs: Date.now() - start,
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'unknown error';
            return {
                accepted: 0,
                rejected: rows.length,
                durationMs: Date.now() - start,
                error,
            };
        }
    }

    /** Persist rows to a per-provider outbox so a real worker can drain them. */
    protected async persistOutbox(rows: Record<string, unknown>[]): Promise<void> {
        const database = await db();
        const collection = `_mirror_outbox_${this.provider}`;
        await database.collection(collection).insertMany(
            rows.map((r) => ({
                tenantId: this.tenantId,
                dataset: this.dataset,
                table: this.table,
                row: r,
                createdAt: new Date(),
                status: 'pending',
            })),
        );
    }
}

export class BigQueryAdapter extends BaseAdapter {
    readonly provider = 'bigquery' as const;
}

export class SnowflakeAdapter extends BaseAdapter {
    readonly provider = 'snowflake' as const;
}

export class PostgresAdapter extends BaseAdapter {
    readonly provider = 'postgres' as const;
}

export function adapterFor(config: WarehouseMirrorConfig): MirrorAdapter {
    switch (config.provider) {
        case 'bigquery':
            return new BigQueryAdapter(config.dataset, config.table, config.tenantId);
        case 'snowflake':
            return new SnowflakeAdapter(config.dataset, config.table, config.tenantId);
        case 'postgres':
            return new PostgresAdapter(config.dataset, config.table, config.tenantId);
        default: {
            const exhaustive: never = config.provider;
            throw new Error(`unknown provider: ${String(exhaustive)}`);
        }
    }
}

/**
 * Mirror a single batch of rows for a given mirror config. Useful for
 * driving from a cron / worker that already has the rows in hand.
 */
export async function mirrorBatch(
    config: WarehouseMirrorConfig,
    rows: Record<string, unknown>[],
): Promise<MirrorPushResult> {
    if (!config.enabled) {
        return { accepted: 0, rejected: rows.length, durationMs: 0, error: 'disabled' };
    }
    const adapter = adapterFor(config);
    return adapter.pushBatch(rows);
}
