/**
 * MSME 45-day delayed-payment cron — §6.10 of CRM_REBUILD_PLAN.md.
 *
 * Runs daily at 06:00 UTC. For each tenant with MSME-flagged vendors:
 *
 *   1. Compute the overdue + at-risk MSME bills via
 *      `computeMsmeOverduebills`.
 *   2. For each bill that *just crossed* the 45-day boundary today
 *      (daysOverdue === 1) — or just entered the 7-day at-risk window
 *      (daysOverdue === -(AT_RISK_WINDOW_DAYS - 1)) — insert an alert
 *      row into `crm_msme_alerts` and emit an audit entry.
 *   3. Stop at 500 tenants per run; the response carries `hasMore`
 *      when there are more tenants left to scan.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel cron default) or
 * `x-cron-secret`. Matches the `/api/cron/sla-breach-check` contract.
 *
 * Query params:
 *   • `?execute=1` — actually write `crm_msme_alerts` + audit rows.
 *     Default is dry-run.
 *   • `?tenant=<userId>` — restrict the sweep to a single tenant
 *     (useful for hand-verifying after the daily run).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId, type Document, type Filter } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    AT_RISK_WINDOW_DAYS,
    computeMsmeOverduebills,
    type MsmeDb,
    type MsmeOverdueRow,
    type RawBill,
    type RawVendor,
} from '@/lib/india-tax/msme-45-day';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TENANT_CAP = 500;

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return { ok: false, status: 503, body: { error: 'CRON_SECRET not configured' } };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

interface AlertWrite {
    tenantUserId: string;
    billId: string;
    vendorId: string;
    kind: 'crossed_45_days' | 'at_risk_7_days';
    daysOverdue: number;
    amountOutstanding: number;
    msmePaymentTermsDays: number;
    recordedAt: Date;
}

/**
 * Decide whether a row deserves an alert *today*. We only emit on the
 * day of the transition — `daysOverdue === 1` (the boundary was crossed
 * yesterday→today) and `daysOverdue === -(AT_RISK_WINDOW_DAYS - 1)`
 * (entering the 7-day window today). Anything further in is already a
 * sticky row on the dashboard.
 */
function alertKindForRow(row: MsmeOverdueRow): AlertWrite['kind'] | null {
    if (row.daysOverdue === 1) return 'crossed_45_days';
    if (row.daysOverdue === -(AT_RISK_WINDOW_DAYS - 1)) return 'at_risk_7_days';
    return null;
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    const execute = request.nextUrl.searchParams.get('execute') === '1';
    const tenantFilter = request.nextUrl.searchParams.get('tenant');
    const now = new Date();
    const startMs = Date.now();

    let tenantsScanned = 0;
    let billsScanned = 0;
    let alertsWritten = 0;
    let auditWritten = 0;
    const errors: string[] = [];

    try {
        const { db } = await connectToDatabase();

        // Find tenants who have at least one MSME-flagged vendor.
        const vendorMatch: Filter<Document> = {
            isMsme: true,
        };
        if (tenantFilter && ObjectId.isValid(tenantFilter)) {
            vendorMatch.userId = new ObjectId(tenantFilter);
        }

        const tenantIds = (await db
            .collection('crm_vendors')
            .aggregate([
                { $match: vendorMatch },
                { $group: { _id: '$userId' } },
                { $limit: TENANT_CAP + 1 },
            ])
            .toArray()) as Array<{ _id: ObjectId }>;

        const hasMore = tenantIds.length > TENANT_CAP;
        const scanList = tenantIds.slice(0, TENANT_CAP);

        for (const t of scanList) {
            const tenantUserId = String(t._id);
            tenantsScanned += 1;

            const tenantDb: MsmeDb = {
                async findMsmeVendors(uid: string): Promise<RawVendor[]> {
                    if (!ObjectId.isValid(uid)) return [];
                    return (await db
                        .collection('crm_vendors')
                        .find({ userId: new ObjectId(uid), isMsme: true } as Filter<Document>)
                        .project({
                            _id: 1,
                            name: 1,
                            isMsme: 1,
                            udyamRegistrationNumber: 1,
                            msmeCategory: 1,
                            msmePaymentTermsDays: 1,
                        })
                        .toArray()) as unknown as RawVendor[];
                },
                async findOpenBillsForVendors(
                    uid: string,
                    vendorIds: string[],
                ): Promise<RawBill[]> {
                    if (!ObjectId.isValid(uid) || vendorIds.length === 0) return [];
                    const vendorOids = vendorIds
                        .filter((v) => ObjectId.isValid(v))
                        .map((v) => new ObjectId(v));
                    // Vendor refs may be stored either as ObjectId or as
                    // a hex-string — match both shapes to be safe.
                    const vendorIn = [...vendorIds, ...vendorOids];
                    return (await db
                        .collection('crm_bills')
                        .find({
                            userId: new ObjectId(uid),
                            vendorId: { $in: vendorIn },
                            status: { $nin: ['paid', 'cancelled'] },
                        } as Filter<Document>)
                        .project({
                            _id: 1,
                            userId: 1,
                            vendorId: 1,
                            billNo: 1,
                            billDate: 1,
                            dueDate: 1,
                            status: 1,
                            paidAt: 1,
                            amountPaid: 1,
                            balance: 1,
                            totals: 1,
                        })
                        .limit(5000)
                        .toArray()) as unknown as RawBill[];
                },
            };

            try {
                const result = await computeMsmeOverduebills(tenantUserId, tenantDb, now);
                billsScanned += result.bills.length;

                for (const row of result.bills) {
                    const kind = alertKindForRow(row);
                    if (!kind) continue;

                    const writeRow: AlertWrite = {
                        tenantUserId,
                        billId: row.billId,
                        vendorId: row.vendorId,
                        kind,
                        daysOverdue: row.daysOverdue,
                        amountOutstanding: row.amountOutstanding,
                        msmePaymentTermsDays: row.msmePaymentTermsDays,
                        recordedAt: now,
                    };

                    if (!execute) {
                        alertsWritten += 1; // dry-run counter
                        continue;
                    }

                    try {
                        // Idempotency: don't re-emit the same kind for
                        // the same (tenant, bill) twice within a day.
                        const dayStart = new Date(now);
                        dayStart.setUTCHours(0, 0, 0, 0);
                        const existing = await db
                            .collection('crm_msme_alerts')
                            .findOne({
                                userId: new ObjectId(tenantUserId),
                                billId: row.billId,
                                kind,
                                recordedAt: { $gte: dayStart },
                            } as Filter<Document>);
                        if (existing) continue;

                        await db.collection('crm_msme_alerts').insertOne({
                            userId: new ObjectId(tenantUserId),
                            billId: row.billId,
                            vendorId: row.vendorId,
                            kind,
                            daysOverdue: row.daysOverdue,
                            amountOutstanding: row.amountOutstanding,
                            msmePaymentTermsDays: row.msmePaymentTermsDays,
                            dismissed: false,
                            recordedAt: now,
                            createdAt: now,
                            updatedAt: now,
                        });
                        alertsWritten += 1;

                        await writeAuditEntry({
                            tenantUserId,
                            actorId: tenantUserId,
                            action: 'msme_45_day_breach',
                            entityKind: 'bill',
                            entityId: row.billId,
                            reason: `MSME ${kind === 'crossed_45_days' ? 'breach' : 'at-risk'} (${row.daysOverdue}d vs ${row.msmePaymentTermsDays}d)`,
                            diff: {
                                msme: {
                                    after: {
                                        vendorId: row.vendorId,
                                        daysOverdue: row.daysOverdue,
                                        msmePaymentTermsDays: row.msmePaymentTermsDays,
                                        amountOutstanding: row.amountOutstanding,
                                        kind,
                                    },
                                },
                            },
                        });
                        auditWritten += 1;
                    } catch (e) {
                        const m = e instanceof Error ? e.message : String(e);
                        errors.push(
                            `tenant ${tenantUserId} bill ${row.billId}: ${m}`,
                        );
                    }
                }

                // Structured log line for observability (email/SMS wiring
                // is a deferred follow-up — for now we just emit a
                // stable JSON shape that log aggregators can pick up).
                console.log(
                    JSON.stringify({
                        at: 'msme-45-day-check',
                        tenantUserId,
                        overdueCount: result.summary.totalOverdueCount,
                        atRiskCount: result.summary.totalAtRiskCount,
                        overdueAmount: result.summary.totalOverdueAmount,
                        atRiskAmount: result.summary.totalAtRiskAmount,
                        execute,
                    }),
                );
            } catch (e) {
                const m = e instanceof Error ? e.message : String(e);
                errors.push(`tenant ${tenantUserId}: ${m}`);
            }
        }

        return NextResponse.json({
            ok: true,
            execute,
            tenantsScanned,
            billsScanned,
            alertsWritten,
            auditWritten,
            hasMore,
            durationMs: Date.now() - startMs,
            errors,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Internal error';
        console.error('[msme-45-day-check] fatal:', e);
        return NextResponse.json(
            {
                ok: false,
                error: msg,
                tenantsScanned,
                billsScanned,
                alertsWritten,
            },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
