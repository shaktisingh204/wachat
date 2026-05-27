'use server';

/**
 * Generic CSV / Excel import actions for the CRM import wizard.
 *
 * The wizard at `/dashboard/crm/import-export` posts a base64-encoded
 * file plus a column mapping; these actions:
 *
 *   1. `parseImportFile` — peeks at the file (first 50 rows) so the UI
 *      can render the column-mapping table.
 *   2. `createImportJob` — persists the job in `crm_import_jobs`,
 *      kicks off `processImportJob` fire-and-forget, returns `jobId`.
 *   3. `processImportJob` — internal worker. Streams the rows in
 *      batches of 50, validates, inserts into the target collection,
 *      updates the job counters as it goes.
 *   4. `getImportJobStatus` — UI polls this every 1 s.
 *   5. `listImportJobs` / `deleteImportJob` — recent-jobs table.
 *
 * Multi-tenant: every read/write is scoped by `userId` from
 * `getSession()`. Max file size: 5 MB.
 *
 * NOTE: This uses fire-and-forget on the same process (acceptable for
 * files ≤ 5000 rows). For larger imports, swap `processImportJob` for
 * a real worker queue.
 */

import { ObjectId } from 'mongodb';
import ExcelJS from 'exceljs';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
    ENTITY_SCHEMAS,
    coerceCell,
    getEntitySchema,
} from '@/lib/crm-import/entity-schemas';

/* ─── constants ───────────────────────────────────────────────────── */

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const PREVIEW_ROWS = 50;
const BATCH_SIZE = 50;
const IMPORT_JOBS_COLLECTION = 'crm_import_jobs';

/* ─── types ───────────────────────────────────────────────────────── */

interface ImportJobError {
    row: number;
    message: string;
}

interface ImportJobStatus {
    _id: string;
    entityType: string;
    filename: string;
    totalRows: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: ImportJobError[];
    status: 'queued' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
    finishedAt?: Date | null;
}

interface ParseImportFileResult {
    ok: boolean;
    error?: string;
    headers?: string[];
    sampleRows?: Record<string, string>[];
    totalRows?: number;
}

interface CreateImportJobResult {
    ok: boolean;
    jobId?: string;
    error?: string;
}

/* ─── shared helpers ──────────────────────────────────────────────── */

async function requireUserId(): Promise<string> {
    const session = await getSession();
    const uid = session?.user?._id;
    if (!uid) throw new Error('Not authenticated');
    return String(uid);
}

function decodeBase64ToBuffer(b64: string): Buffer {
    // Strip data-URI prefix if present.
    const stripped = b64.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(stripped, 'base64');
}

async function workbookToRows(buf: Buffer): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headers: string[] = [];
    const result: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
        const vals = (row.values as ExcelJS.CellValue[]).slice(1);
        if (rowNumber === 1) {
            headers.push(...vals.map(v => v == null ? '' : String(v).trim()));
        } else {
            const out: Record<string, string> = {};
            headers.forEach((h, i) => {
                const v = vals[i];
                out[h] = v == null ? '' : String(v);
            });
            result.push(out);
        }
    });
    return result;
}

function detectHeaders(rows: Record<string, string>[]): string[] {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
}

/* ─── action 1: parse + preview ───────────────────────────────────── */

export async function parseImportFile(
    entityType: string,
    fileBase64: string,
): Promise<ParseImportFileResult> {
    try {
        await requireUserId();
        const schema = getEntitySchema(entityType);
        if (!schema) return { ok: false, error: `Unknown entity type: ${entityType}` };

        const buf = decodeBase64ToBuffer(fileBase64);
        if (buf.byteLength === 0) {
            return { ok: false, error: 'File is empty.' };
        }
        if (buf.byteLength > MAX_FILE_BYTES) {
            return {
                ok: false,
                error: `File is too large (max ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB).`,
            };
        }
        const rows = await workbookToRows(buf);
        if (rows.length === 0) {
            return { ok: false, error: 'No rows found in the file.' };
        }
        return {
            ok: true,
            headers: detectHeaders(rows),
            sampleRows: rows.slice(0, PREVIEW_ROWS),
            totalRows: rows.length,
        };
    } catch (e) {
        console.error('[parseImportFile] failed:', e);
        return { ok: false, error: (e as Error).message || 'Parse failed.' };
    }
}

/* ─── action 2: create job + fire-and-forget worker ───────────────── */

export async function createImportJob(args: {
    entityType: string;
    filename: string;
    fileBase64: string;
    columnMapping: Record<string, string>;
}): Promise<CreateImportJobResult> {
    try {
        const userId = await requireUserId();
        const { entityType, filename, fileBase64, columnMapping } = args;

        const schema = getEntitySchema(entityType);
        if (!schema) return { ok: false, error: `Unknown entity type: ${entityType}` };

        const buf = decodeBase64ToBuffer(fileBase64);
        if (buf.byteLength === 0) return { ok: false, error: 'File is empty.' };
        if (buf.byteLength > MAX_FILE_BYTES) {
            return {
                ok: false,
                error: `File is too large (max ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB).`,
            };
        }
        // Verify the file parses + count rows up front so we can store
        // the total on the job doc.
        const rows = await workbookToRows(buf);
        if (rows.length === 0) return { ok: false, error: 'No rows in the file.' };

        // Verify every required field is mapped.
        for (const field of schema.fields) {
            if (field.required && !columnMapping[field.name]) {
                return {
                    ok: false,
                    error: `Required field "${field.label}" is not mapped.`,
                };
            }
        }

        const { db } = await connectToDatabase();
        const now = new Date();
        const jobDoc = {
            userId: new ObjectId(userId),
            entityType,
            filename,
            totalRows: rows.length,
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [] as ImportJobError[],
            status: 'queued' as const,
            columnMapping,
            // We re-decode the file inside the worker — storing the raw
            // base64 lets the worker run after the action returns.
            fileBase64,
            createdAt: now,
            updatedAt: now,
            finishedAt: null as Date | null,
        };
        const ins = await db.collection(IMPORT_JOBS_COLLECTION).insertOne(jobDoc);
        const jobId = ins.insertedId.toHexString();

        // Fire-and-forget — intentionally not awaited.
        // TODO: For files > 5000 rows, move this to a real worker queue
        // (BullMQ on Redis would be a good fit alongside the existing
        // PM2 workers).
        void processImportJob(jobId).catch((err) => {
            console.error('[crm-import] worker crashed for', jobId, err);
        });

        return { ok: true, jobId };
    } catch (e) {
        console.error('[createImportJob] failed:', e);
        return { ok: false, error: (e as Error).message || 'Create failed.' };
    }
}

/* ─── internal worker ─────────────────────────────────────────────── */

async function processImportJob(jobId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const jobs = db.collection(IMPORT_JOBS_COLLECTION);
    let jobObjectId: ObjectId;
    try {
        jobObjectId = new ObjectId(jobId);
    } catch {
        console.error('[processImportJob] invalid jobId:', jobId);
        return;
    }
    const job = await jobs.findOne({ _id: jobObjectId });
    if (!job) {
        console.error('[processImportJob] job not found:', jobId);
        return;
    }

    const schema = getEntitySchema(String(job.entityType));
    if (!schema) {
        await jobs.updateOne(
            { _id: jobObjectId },
            {
                $set: {
                    status: 'failed',
                    updatedAt: new Date(),
                    finishedAt: new Date(),
                },
                $push: {
                    errors: { row: 0, message: `Unknown entity type: ${job.entityType}` },
                },
            } as never,
        );
        return;
    }

    await jobs.updateOne(
        { _id: jobObjectId },
        { $set: { status: 'running', updatedAt: new Date() } },
    );

    try {
        const buf = decodeBase64ToBuffer(String(job.fileBase64 ?? ''));
        const rows = await workbookToRows(buf);
        const mapping = (job.columnMapping ?? {}) as Record<string, string>;
        const userIdStr = String(job.userId);
        const targetCollection = db.collection(schema.collection);

        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        const errors: ImportJobError[] = [];

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const docs: Record<string, unknown>[] = [];
            const batchErrors: ImportJobError[] = [];

            for (let j = 0; j < batch.length; j++) {
                const rowNum = i + j + 2; // +2 to be 1-based + skip header
                const raw = batch[j];
                const built: Record<string, unknown> = {};
                let firstError: string | null = null;

                for (const field of schema.fields) {
                    const header = mapping[field.name];
                    const cell = header ? raw[header] : '';
                    const coerced = coerceCell(cell, field);
                    if (!coerced.ok) {
                        firstError = coerced.error;
                        break;
                    }
                    if (coerced.value !== undefined) {
                        built[field.name] = coerced.value;
                    }
                }
                if (firstError) {
                    batchErrors.push({ row: rowNum, message: firstError });
                    continue;
                }
                if (schema.validate) {
                    const v = schema.validate(built);
                    if (v) {
                        batchErrors.push({ row: rowNum, message: v });
                        continue;
                    }
                }
                const doc = schema.prepareForInsert
                    ? schema.prepareForInsert(built, userIdStr)
                    : {
                          ...built,
                          userId: new ObjectId(userIdStr),
                          createdAt: new Date(),
                          updatedAt: new Date(),
                      };
                docs.push(doc);
            }

            if (docs.length > 0) {
                try {
                    await targetCollection.insertMany(docs, { ordered: false });
                    succeeded += docs.length;
                } catch (insertErr) {
                    // `insertMany` with `ordered: false` may partially
                    // succeed; the driver attaches `result.nInserted`
                    // on a BulkWriteError.
                    const err = insertErr as {
                        result?: { nInserted?: number; insertedCount?: number };
                        writeErrors?: { index: number; errmsg: string }[];
                    };
                    const ok =
                        err.result?.insertedCount ??
                        err.result?.nInserted ??
                        0;
                    succeeded += ok;
                    const writeErrors = err.writeErrors ?? [];
                    for (const we of writeErrors) {
                        // Row number is best-effort — we lost the
                        // batch-local index ↔ source-row mapping.
                        batchErrors.push({
                            row: i + we.index + 2,
                            message: we.errmsg || 'Insert failed',
                        });
                    }
                    failed += writeErrors.length || docs.length - ok;
                }
            }

            failed += batchErrors.length;
            errors.push(...batchErrors);
            processed += batch.length;

            // Trim errors to 500 to keep the doc small.
            const trimmedErrors = errors.slice(0, 500);

            await jobs.updateOne(
                { _id: jobObjectId },
                {
                    $set: {
                        processed,
                        succeeded,
                        failed,
                        errors: trimmedErrors,
                        updatedAt: new Date(),
                    },
                },
            );
        }

        await jobs.updateOne(
            { _id: jobObjectId },
            {
                $set: {
                    status: 'completed',
                    updatedAt: new Date(),
                    finishedAt: new Date(),
                },
                // Drop the cached file once the import is done.
                $unset: { fileBase64: '' },
            },
        );
    } catch (e) {
        console.error('[processImportJob] crashed:', e);
        await jobs.updateOne(
            { _id: jobObjectId },
            {
                $set: {
                    status: 'failed',
                    updatedAt: new Date(),
                    finishedAt: new Date(),
                },
                $push: {
                    errors: {
                        row: 0,
                        message: (e as Error).message || 'Worker crashed',
                    },
                },
            } as never,
        );
    }
}

/* ─── action 3: poll status ───────────────────────────────────────── */

export async function getImportJobStatus(
    jobId: string,
): Promise<ImportJobStatus | null> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        let jobObjectId: ObjectId;
        try {
            jobObjectId = new ObjectId(jobId);
        } catch {
            return null;
        }
        const doc = await db.collection(IMPORT_JOBS_COLLECTION).findOne({
            _id: jobObjectId,
            userId: new ObjectId(userId),
        });
        if (!doc) return null;
        return {
            _id: String(doc._id),
            entityType: String(doc.entityType),
            filename: String(doc.filename),
            totalRows: Number(doc.totalRows ?? 0),
            processed: Number(doc.processed ?? 0),
            succeeded: Number(doc.succeeded ?? 0),
            failed: Number(doc.failed ?? 0),
            errors: Array.isArray(doc.errors) ? (doc.errors as ImportJobError[]) : [],
            status: doc.status as ImportJobStatus['status'],
            createdAt: doc.createdAt as Date,
            updatedAt: doc.updatedAt as Date,
            finishedAt: (doc.finishedAt as Date | null) ?? null,
        };
    } catch (e) {
        console.error('[getImportJobStatus] failed:', e);
        return null;
    }
}

/* ─── action 4: list recent jobs ──────────────────────────────────── */

export async function listImportJobs(): Promise<ImportJobStatus[]> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(IMPORT_JOBS_COLLECTION)
            .find(
                { userId: new ObjectId(userId) },
                {
                    projection: {
                        fileBase64: 0, // never send the cached file back
                    },
                },
            )
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return docs.map((doc) => ({
            _id: String(doc._id),
            entityType: String(doc.entityType),
            filename: String(doc.filename),
            totalRows: Number(doc.totalRows ?? 0),
            processed: Number(doc.processed ?? 0),
            succeeded: Number(doc.succeeded ?? 0),
            failed: Number(doc.failed ?? 0),
            errors: Array.isArray(doc.errors) ? (doc.errors as ImportJobError[]) : [],
            status: doc.status as ImportJobStatus['status'],
            createdAt: doc.createdAt as Date,
            updatedAt: doc.updatedAt as Date,
            finishedAt: (doc.finishedAt as Date | null) ?? null,
        }));
    } catch (e) {
        console.error('[listImportJobs] failed:', e);
        return [];
    }
}

/* ─── action 5: delete job ────────────────────────────────────────── */

export async function deleteImportJob(
    jobId: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        let jobObjectId: ObjectId;
        try {
            jobObjectId = new ObjectId(jobId);
        } catch {
            return { ok: false, error: 'Invalid job id' };
        }
        const doc = await db.collection(IMPORT_JOBS_COLLECTION).findOne({
            _id: jobObjectId,
            userId: new ObjectId(userId),
        });
        if (!doc) return { ok: false, error: 'Job not found' };
        if (doc.status === 'running' || doc.status === 'queued') {
            return { ok: false, error: 'Cannot delete a running job.' };
        }
        await db
            .collection(IMPORT_JOBS_COLLECTION)
            .deleteOne({ _id: jobObjectId, userId: new ObjectId(userId) });
        return { ok: true };
    } catch (e) {
        console.error('[deleteImportJob] failed:', e);
        return { ok: false, error: (e as Error).message || 'Delete failed.' };
    }
}

/* ─── helper: list available entity types (for the UI picker) ─────── */

export async function listImportableEntities(): Promise<
    Array<{ entityType: string; label: string; description: string }>
> {
    return Object.values(ENTITY_SCHEMAS).map((s) => ({
        entityType: s.entityType,
        label: s.label,
        description: s.description,
    }));
}
