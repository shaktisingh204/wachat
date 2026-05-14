/**
 * SLA breach detection cron — §6.4 of CRM_REBUILD_PLAN.md.
 *
 * Runs every 5 minutes on Vercel Cron. For each tenant, loads open
 * tickets (not resolved/closed, not yet escalated within this sweep
 * window), resolves the applicable SLA rule from `crm_slas`, computes
 * first-response and resolution due-by, and flags breaches:
 *
 *   • Mark ticket with `escalatedAt`, push to `escalations[]`.
 *   • Write `crm_audit_log` row with `action: 'sla_breached'`.
 *   • Best-effort notification template send (deferred — no template
 *     dispatcher exists yet in `actions/`; we leave the hook in place
 *     and log the intent).
 *
 * Idempotency: the per-ticket `lastSlaBreachCheckAt` field gates
 * re-escalation within a 5-minute window so a slow sweep that
 * overlaps with the next one can't double-fire. Operators can clear
 * this via `acknowledgeSlaBreach()`.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel cron's default).
 *
 * Query params:
 *   • `?dryRun=true` — enumerate and report but skip writes /
 *     notifications. Used by the verification harness.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    findApplicableSlaRule,
    isBreached,
    DEFAULT_BUSINESS_HOURS,
    type BusinessHours,
    type SlaRule,
    type SlaTicket,
} from '@/lib/sla/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function authorize(request: NextRequest): { ok: true } | { ok: false; status: number; body: unknown } {
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

function toRule(doc: Record<string, any>): SlaRule {
    return {
        _id: doc._id ? String(doc._id) : undefined,
        name: typeof doc.name === 'string' ? doc.name : undefined,
        priority: (doc.priority ?? 'medium') as SlaRule['priority'],
        severity: doc.severity as SlaRule['severity'],
        channel: typeof doc.channel === 'string' ? doc.channel : undefined,
        firstResponseMinutes: Number(
            doc.firstResponseMinutes ?? doc.firstResponseMins ?? doc.firstResponseTargetMins ?? 60,
        ),
        resolutionMinutes: Number(
            doc.resolutionMinutes ?? doc.resolutionMins ?? doc.resolutionTargetMins ?? 480,
        ),
        businessHoursOnly: Boolean(doc.businessHoursOnly ?? true),
        escalateTo: typeof doc.escalateTo === 'string' ? doc.escalateTo : undefined,
        escalateAfterMinutes:
            typeof doc.escalateAfterMinutes === 'number' ? doc.escalateAfterMinutes : undefined,
        escalationGroupId:
            typeof doc.escalationGroupId === 'string' ? doc.escalationGroupId : undefined,
    };
}

function toBusinessHours(raw: unknown): BusinessHours {
    if (raw && typeof raw === 'object') {
        const o = raw as Record<string, any>;
        return {
            timezone: typeof o.timezone === 'string' ? o.timezone : DEFAULT_BUSINESS_HOURS.timezone,
            workDays: Array.isArray(o.workDays)
                ? (o.workDays as number[]).filter(
                      (n) => Number.isInteger(n) && n >= 0 && n <= 6,
                  )
                : DEFAULT_BUSINESS_HOURS.workDays,
            startHour: Number.isFinite(Number(o.startHour))
                ? Number(o.startHour)
                : DEFAULT_BUSINESS_HOURS.startHour,
            endHour: Number.isFinite(Number(o.endHour))
                ? Number(o.endHour)
                : DEFAULT_BUSINESS_HOURS.endHour,
            holidays: Array.isArray(o.holidays)
                ? (o.holidays as unknown[]).map((s) => String(s))
                : DEFAULT_BUSINESS_HOURS.holidays,
        };
    }
    return DEFAULT_BUSINESS_HOURS;
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    const now = new Date();
    const scanStartMs = Date.now();

    let scanned = 0;
    let breached = 0;
    let escalated = 0;
    const errors: string[] = [];

    try {
        const { db } = await connectToDatabase();

        // Open tickets: not resolved/closed and not freshly escalated.
        const openTickets = await db
            .collection('crm_tickets')
            .find({
                status: { $nin: ['resolved', 'closed'] },
                $or: [
                    { escalatedAt: { $exists: false } },
                    { escalatedAt: null },
                ],
            } as any)
            .limit(5000)
            .toArray();

        // Pre-load SLA rules + tenant settings, keyed by tenant `userId`,
        // so we don't re-query Mongo per ticket.
        const tenantIds = new Set<string>();
        for (const t of openTickets) {
            const uid = (t as any).userId;
            if (uid) tenantIds.add(String(uid));
        }
        const tenantIdArr = [...tenantIds]
            .filter((s) => ObjectId.isValid(s))
            .map((s) => new ObjectId(s));

        const [slaDocs, settingsDocs] = await Promise.all([
            tenantIdArr.length
                ? db
                      .collection('crm_slas')
                      .find({
                          userId: { $in: tenantIdArr },
                          $or: [{ active: true }, { status: 'active' }],
                      } as any)
                      .toArray()
                : Promise.resolve([] as Record<string, any>[]),
            tenantIdArr.length
                ? db
                      .collection('crm_settings')
                      .find({ userId: { $in: tenantIdArr } } as any)
                      .toArray()
                : Promise.resolve([] as Record<string, any>[]),
        ]);

        const rulesByTenant = new Map<string, SlaRule[]>();
        const ruleDocById = new Map<string, Record<string, any>>();
        for (const d of slaDocs) {
            const tid = String((d as any).userId);
            const r = toRule(d as Record<string, any>);
            if (r._id) ruleDocById.set(r._id, d as Record<string, any>);
            const arr = rulesByTenant.get(tid) ?? [];
            arr.push(r);
            rulesByTenant.set(tid, arr);
        }
        const bhByTenant = new Map<string, BusinessHours>();
        for (const s of settingsDocs) {
            bhByTenant.set(String((s as any).userId), toBusinessHours((s as any).businessHours));
        }

        for (const t of openTickets) {
            scanned++;

            const last = (t as any).lastSlaBreachCheckAt;
            if (last instanceof Date && now.getTime() - last.getTime() < DEDUPE_WINDOW_MS) {
                continue;
            }

            const tid = String((t as any).userId ?? '');
            const rules = rulesByTenant.get(tid) ?? [];
            const ticket: SlaTicket = {
                _id: String((t as any)._id),
                createdAt: (t as any).createdAt ?? (t as any)?.audit?.createdAt,
                firstResponseAt: (t as any).firstResponseAt,
                resolvedAt: (t as any).resolvedAt,
                status: (t as any).status,
                priority: (t as any).priority,
                severity: (t as any).severity,
                channel: (t as any).channel,
                escalatedAt: (t as any).escalatedAt,
                lastSlaBreachCheckAt: last,
                acknowledgedAt: (t as any).acknowledgedAt,
            };

            const rule = findApplicableSlaRule(ticket, rules);
            if (!rule) continue;

            const perRuleBh =
                rule._id && ruleDocById.get(rule._id)?.businessHours
                    ? toBusinessHours(ruleDocById.get(rule._id)?.businessHours)
                    : null;
            const bh = perRuleBh ?? bhByTenant.get(tid) ?? DEFAULT_BUSINESS_HOURS;

            const verdict = isBreached(ticket, rule, bh, now);
            if (!verdict.breached || !verdict.type) {
                if (!dryRun) {
                    await db
                        .collection('crm_tickets')
                        .updateOne(
                            { _id: (t as any)._id } as any,
                            { $set: { lastSlaBreachCheckAt: now } },
                        );
                }
                continue;
            }

            breached++;

            if (dryRun) continue;

            try {
                const escalationEntry = {
                    type: verdict.type,
                    minutesOverdue: verdict.minutesOverdue,
                    ruleId: rule._id ?? null,
                    ruleName: rule.name ?? null,
                    escalatedTo: rule.escalateTo ?? rule.escalationGroupId ?? null,
                    at: now,
                };

                await db.collection('crm_tickets').updateOne(
                    { _id: (t as any)._id } as any,
                    {
                        $set: {
                            escalatedAt: now,
                            lastSlaBreachCheckAt: now,
                            updatedAt: now,
                        },
                        $push: { escalations: escalationEntry } as any,
                    },
                );

                await writeAuditEntry({
                    tenantUserId: tid,
                    actorId: tid,
                    action: 'sla_breached',
                    entityKind: 'ticket',
                    entityId: String((t as any)._id),
                    reason: `${verdict.type === 'first_response' ? 'First response' : 'Resolution'} exceeded by ${verdict.minutesOverdue} minutes`,
                    diff: {
                        sla: {
                            before: null,
                            after: {
                                type: verdict.type,
                                minutesOverdue: verdict.minutesOverdue,
                                ruleId: rule._id ?? null,
                            },
                        },
                    },
                });

                // Notification template dispatch — deferred. No
                // generalised `templates.actions.ts` exists yet, and the
                // Wachat template-actions API is wachat-specific. We
                // structure this branch so a future caller can wire in
                // `dispatchSlaBreachNotification(...)` without changing
                // the cron's contract.
                try {
                    // Intentionally a no-op stub. The audit row already
                    // surfaces in the §5.3 Notifications hub.
                } catch (notifyErr) {
                    console.error('[sla-breach-check] notify failed:', notifyErr);
                }

                escalated++;
            } catch (writeErr) {
                const m = writeErr instanceof Error ? writeErr.message : String(writeErr);
                errors.push(`ticket ${(t as any)._id}: ${m}`);
            }
        }

        return NextResponse.json({
            ok: true,
            dryRun,
            scanned,
            breached,
            escalated,
            durationMs: Date.now() - scanStartMs,
            errors,
        });
    } catch (e: any) {
        console.error('[sla-breach-check] fatal:', e);
        return NextResponse.json(
            {
                ok: false,
                error: e?.message || 'Internal error',
                scanned,
                breached,
                escalated,
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
