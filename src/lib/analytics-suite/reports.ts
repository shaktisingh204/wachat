/**
 * Report engine — small JSON DSL that compiles to a Mongo aggregation
 * pipeline. Tenant-scoped at every operation.
 */

import 'server-only';

import type {
    Report,
    ReportDefinition,
    ReportFilter,
    ReportResult,
    ReportRow,
} from './types';

const COLLECTION = 'analytics_reports';

async function db() {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    return db;
}

function newId(): string {
    // Avoids pulling in nanoid here; cuid2 is a project dep but a tiny local
    // helper is enough for ids that never leave the analytics module.
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10)
    );
}

export interface CreateReportInput {
    tenantId: string;
    name: string;
    description?: string;
    definition: ReportDefinition;
    createdBy?: string;
}

export async function createReport(input: CreateReportInput): Promise<Report> {
    if (!input.tenantId) throw new Error('tenantId required');
    if (!input.name) throw new Error('report name required');
    validateDefinition(input.definition);
    const now = new Date();
    const doc: Report = {
        _id: newId(),
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        definition: input.definition,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy,
    };
    const database = await db();
    await database.collection(COLLECTION).insertOne(doc as any);
    return doc;
}

export async function listReports(tenantId: string): Promise<Report[]> {
    const database = await db();
    const rows = await database
        .collection(COLLECTION)
        .find({ tenantId })
        .sort({ updatedAt: -1 })
        .toArray();
    return rows as unknown as Report[];
}

export async function getReport(
    tenantId: string,
    reportId: string,
): Promise<Report | null> {
    const database = await db();
    const row = await database
        .collection(COLLECTION)
        .findOne({ _id: reportId, tenantId } as any);
    return (row as unknown as Report) ?? null;
}

export interface RunReportParams {
    /** Optional ad-hoc parameter overrides for filters (e.g. date ranges). */
    filters?: ReportFilter[];
    limit?: number;
}

export async function runReport(
    tenantId: string,
    reportId: string,
    params: RunReportParams = {},
): Promise<ReportResult> {
    const report = await getReport(tenantId, reportId);
    if (!report) throw new Error(`report not found: ${reportId}`);

    const def: ReportDefinition = {
        ...report.definition,
        filters: [...(report.definition.filters ?? []), ...(params.filters ?? [])],
        limit: params.limit ?? report.definition.limit,
    };

    return runReportDefinition(tenantId, reportId, def);
}

/** Compile + execute a report definition without persisting it. */
export async function runReportDefinition(
    tenantId: string,
    reportId: string,
    def: ReportDefinition,
): Promise<ReportResult> {
    validateDefinition(def);
    const start = Date.now();
    const pipeline = compile(tenantId, def);
    const database = await db();
    const rows = (await database
        .collection(def.source)
        .aggregate(pipeline)
        .toArray()) as ReportRow[];
    return {
        reportId,
        rows,
        totalRows: rows.length,
        executedAt: new Date(),
        durationMs: Date.now() - start,
    };
}

/** Validate the structure of a report definition. */
function validateDefinition(def: ReportDefinition): void {
    if (!def.source) throw new Error('definition.source required');
    if (!Array.isArray(def.measures) || def.measures.length === 0) {
        throw new Error('definition.measures must be non-empty');
    }
    for (const m of def.measures) {
        if (!m.field || !m.agg) {
            throw new Error('each measure needs field + agg');
        }
    }
    for (const f of def.filters ?? []) {
        if (!f.field || !f.op) throw new Error('invalid filter');
    }
}

const OP_MAP: Record<string, string> = {
    eq: '$eq',
    ne: '$ne',
    gt: '$gt',
    gte: '$gte',
    lt: '$lt',
    lte: '$lte',
    in: '$in',
    nin: '$nin',
};

function buildMatch(filters: ReportFilter[] = []): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of filters) {
        if (f.op === 'contains') {
            out[f.field] = { $regex: String(f.value), $options: 'i' };
        } else {
            const op = OP_MAP[f.op];
            if (!op) continue;
            out[f.field] = { [op]: f.value };
        }
    }
    return out;
}

function aggExpr(agg: string, field: string): Record<string, unknown> {
    switch (agg) {
        case 'sum':
            return { $sum: `$${field}` };
        case 'avg':
            return { $avg: `$${field}` };
        case 'min':
            return { $min: `$${field}` };
        case 'max':
            return { $max: `$${field}` };
        case 'count':
            return { $sum: 1 };
        case 'count_distinct':
            return { $addToSet: `$${field}` };
        default:
            return { $sum: `$${field}` };
    }
}

/** Compile a definition into a Mongo aggregation pipeline. */
export function compile(
    tenantId: string,
    def: ReportDefinition,
): Record<string, unknown>[] {
    const pipeline: Record<string, unknown>[] = [];

    pipeline.push({ $match: { tenantId, ...buildMatch(def.filters) } });

    const groupId: Record<string, unknown> = {};
    for (const dim of def.dimensions ?? []) {
        groupId[dim] = `$${dim}`;
    }
    for (const g of def.groupBy ?? []) {
        groupId[g] = `$${g}`;
    }

    const groupStage: Record<string, unknown> = {
        _id: Object.keys(groupId).length > 0 ? groupId : null,
    };
    for (const m of def.measures) {
        const alias = m.alias ?? `${m.agg}_${m.field}`;
        groupStage[alias] = aggExpr(m.agg, m.field);
    }
    pipeline.push({ $group: groupStage });

    // Project group keys back into top-level fields.
    const project: Record<string, unknown> = { _id: 0 };
    for (const key of Object.keys(groupId)) {
        project[key] = `$_id.${key}`;
    }
    for (const m of def.measures) {
        const alias = m.alias ?? `${m.agg}_${m.field}`;
        if (m.agg === 'count_distinct') {
            project[alias] = { $size: `$${alias}` };
        } else {
            project[alias] = 1;
        }
    }
    pipeline.push({ $project: project });

    if (def.sortBy && def.sortBy.length > 0) {
        const sort: Record<string, 1 | -1> = {};
        for (const s of def.sortBy) sort[s.field] = s.dir === 'asc' ? 1 : -1;
        pipeline.push({ $sort: sort });
    }
    if (typeof def.limit === 'number' && def.limit > 0) {
        pipeline.push({ $limit: def.limit });
    }
    return pipeline;
}
