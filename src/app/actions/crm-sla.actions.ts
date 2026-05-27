'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmSlasApi } from '@/lib/rust-client/crm-slas';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

/**
 * Fetch a single SLA policy by id. Dual-impl: routes through the Rust
 * BFF when `USE_RUST_CRM` is on, falling back to legacy Mongo on error.
 */
export async function getSlaById(
  slaId: string,
): Promise<Record<string, any> | null> {
  if (!slaId || !ObjectId.isValid(slaId)) return null;
  const session = await getSession();
  if (!session?.user?._id) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmSlasApi.getById(slaId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getSlaById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'sla',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_slas').findOne({
      _id: new ObjectId(slaId),
      userId: new ObjectId(session.user._id as string),
    });
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  } catch (e) {
    console.error('Failed to fetch SLA by id:', e);
    return null;
  }
}
import {
  computeFirstResponseDueBy,
  computeResolutionDueBy,
  findApplicableSlaRule,
  DEFAULT_BUSINESS_HOURS,
  type SlaRule,
  type BusinessHours,
  type SlaTicket,
} from '@/lib/sla/engine';

export async function saveSla(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();

    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'SLA name is required.' };

    const firstResponseMinutesRaw = formData.get('firstResponseMinutes') as string | null;
    const resolutionMinutesRaw = formData.get('resolutionMinutes') as string | null;

    const firstResponseMinutes = firstResponseMinutesRaw ? parseInt(firstResponseMinutesRaw, 10) : NaN;
    const resolutionMinutes = resolutionMinutesRaw ? parseInt(resolutionMinutesRaw, 10) : NaN;

    if (isNaN(firstResponseMinutes) || firstResponseMinutes < 1) {
      return { error: 'First response target (minutes) is required.' };
    }
    if (isNaN(resolutionMinutes) || resolutionMinutes < 1) {
      return { error: 'Resolution target (minutes) is required.' };
    }

    const description = (formData.get('description') as string | null)?.trim() || undefined;
    const businessHoursOnly = formData.get('businessHoursOnly') === 'on';
    const priority = (formData.get('priority') as string | null) || 'medium';
    const notes = (formData.get('notes') as string | null)?.trim() || undefined;
    const escalateAfterRaw = formData.get('escalateAfterMinutes') as string | null;
    const escalateAfterMinutes = escalateAfterRaw ? parseInt(escalateAfterRaw, 10) : undefined;
    const escalateTo = (formData.get('escalateTo') as string | null)?.trim() || undefined;

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      name,
      priority,
      firstResponseMinutes,
      resolutionMinutes,
      businessHoursOnly,
      status: 'active',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (description) doc.description = description;
    if (notes) doc.notes = notes;
    if (escalateAfterMinutes && !isNaN(escalateAfterMinutes) && escalateAfterMinutes > 0) {
      doc.escalateAfterMinutes = escalateAfterMinutes;
    }
    if (escalateTo) doc.escalateTo = escalateTo;

    const { insertedId } = await db.collection('crm_slas').insertOne(doc);

    revalidatePath('/dashboard/sabdesk/sla');
    return { message: 'SLA policy created.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('saveSla error:', e);
    return { error: e?.message || 'An unexpected error occurred.' };
  }
}

/* ─── SLA engine integration ────────────────────────────────────── */

function toSlaRuleDoc(doc: Record<string, any>): SlaRule {
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

function toBusinessHoursDoc(raw: unknown): BusinessHours {
  // Business hours can live either as a string (legacy free-text) or a
  // structured object on the SLA / tenant settings record. We accept
  // both and fall back to the platform default.
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, any>;
    return {
      timezone: typeof o.timezone === 'string' ? o.timezone : DEFAULT_BUSINESS_HOURS.timezone,
      workDays: Array.isArray(o.workDays)
        ? (o.workDays as number[]).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
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

/**
 * Look up the applicable SLA rule for a given ticket id and compute
 * live due-by timestamps. Used by `<TicketSlaBadge>` to drive the
 * countdown.
 */
export async function getApplicableSlaRule(ticketId: string): Promise<{
  rule: SlaRule | null;
  firstResponseDueBy?: string;
  resolutionDueBy?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  status?: string;
  createdAt?: string;
  error?: string;
}> {
  if (!ticketId) return { rule: null, error: 'Missing ticket id.' };
  const session = await getSession();
  if (!session?.user?._id) return { rule: null, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const tenantId = new ObjectId(session.user._id as string);

    let ticketDoc: Record<string, any> | null = null;
    if (ObjectId.isValid(ticketId)) {
      ticketDoc = await db
        .collection('crm_tickets')
        .findOne({ _id: new ObjectId(ticketId) } as any);
    }
    if (!ticketDoc) return { rule: null, error: 'Ticket not found.' };

    const ruleDocs = await db
      .collection('crm_slas')
      .find({ userId: tenantId, $or: [{ active: true }, { status: 'active' }] } as any)
      .toArray();
    const rules = ruleDocs.map(toSlaRuleDoc);

    const ticket: SlaTicket = {
      _id: String(ticketDoc._id),
      createdAt: ticketDoc.createdAt ?? ticketDoc?.audit?.createdAt,
      firstResponseAt: ticketDoc.firstResponseAt,
      resolvedAt: ticketDoc.resolvedAt,
      status: ticketDoc.status,
      priority: ticketDoc.priority,
      severity: ticketDoc.severity,
      channel: ticketDoc.channel,
    };

    const rule = findApplicableSlaRule(ticket, rules);
    if (!rule) {
      return {
        rule: null,
        status: ticket.status,
        createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined,
        firstResponseAt: ticket.firstResponseAt
          ? new Date(ticket.firstResponseAt).toISOString()
          : undefined,
        resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toISOString() : undefined,
      };
    }

    // Business-hours config: per-tenant `crm_settings.businessHours`
    // overrides the platform default. Per-rule overrides live in the
    // optional `businessHours` field.
    const tenantSettings = await db
      .collection('crm_settings')
      .findOne({ userId: tenantId } as any);
    const ruleBh = ruleDocs.find((d) => String(d._id) === rule._id)?.businessHours;
    const bh = toBusinessHoursDoc(ruleBh ?? tenantSettings?.businessHours);

    const firstResponseDueBy = computeFirstResponseDueBy(ticket, rule, bh);
    const resolutionDueBy = computeResolutionDueBy(ticket, rule, bh);

    return {
      rule,
      firstResponseDueBy: firstResponseDueBy.toISOString(),
      resolutionDueBy: resolutionDueBy.toISOString(),
      firstResponseAt: ticket.firstResponseAt
        ? new Date(ticket.firstResponseAt).toISOString()
        : undefined,
      resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toISOString() : undefined,
      status: ticket.status,
      createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined,
    };
  } catch (e: any) {
    console.error('[getApplicableSlaRule]', e);
    return { rule: null, error: e?.message || 'Failed to load SLA rule.' };
  }
}

/**
 * Operator-driven breach acknowledgement.
 *
 * Clears the auto-escalation flag for the next sweep, leaving the
 * historical `escalations[]` array intact. The cron's idempotency
 * field (`lastSlaBreachCheckAt`) is also reset so the next run can
 * re-trigger if the ticket is still over the line.
 */
/* ── List SLA policies ──────────────────────────────────────────── */

export async function getSlaPolicies(): Promise<Record<string, unknown>[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_slas')
      .find({ userId: new ObjectId(session.user._id as string) })
      .sort({ createdAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(docs));
  } catch (e) {
    console.error('[getSlaPolicies]', e);
    return [];
  }
}

/* ── Delete single SLA policy ──────────────────────────────────── */

export async function deleteSlaPolicy(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_slas').deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'delete',
      entityKind: 'sla',
      entityId: id,
    });
    revalidatePath('/dashboard/sabdesk/sla');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Delete failed.' };
  }
}

/* ── Bulk activate / deactivate / delete ────────────────────────── */

export async function bulkUpdateSlas(
  ids: string[],
  op: 'activate' | 'deactivate' | 'delete',
): Promise<{ updated: number; failed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { updated: 0, failed: ids.length, error: 'Access denied.' };
  const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  if (oids.length === 0) return { updated: 0, failed: ids.length, error: 'No valid IDs.' };

  try {
    const { db } = await connectToDatabase();
    const filter = {
      _id: { $in: oids },
      userId: new ObjectId(session.user._id as string),
    };
    let count = 0;
    if (op === 'delete') {
      const r = await db.collection('crm_slas').deleteMany(filter);
      count = r.deletedCount ?? 0;
    } else {
      const r = await db.collection('crm_slas').updateMany(filter, {
        $set: {
          active: op === 'activate',
          status: op === 'activate' ? 'active' : 'archived',
          updatedAt: new Date(),
        },
      });
      count = r.modifiedCount ?? 0;
    }
    revalidatePath('/dashboard/sabdesk/sla');
    return { updated: count, failed: Math.max(0, ids.length - count) };
  } catch (e: any) {
    return { updated: 0, failed: ids.length, error: e?.message || 'Bulk op failed.' };
  }
}

/* ── SaveSlaState type (re-export for form components) ───────────── */

type SaveSlaState = { message?: string; error?: string; id?: string };

export async function acknowledgeSlaBreach(
  ticketId: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { ok: false, error: 'Invalid ticket id.' };
  }
  const session = await getSession();
  if (!session?.user?._id) return { ok: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const res = await db.collection('crm_tickets').updateOne(
      { _id: new ObjectId(ticketId) } as any,
      {
        $set: {
          acknowledgedAt: now,
          escalatedAt: null,
          lastSlaBreachCheckAt: null,
          updatedAt: now,
        },
      },
    );

    if (res.matchedCount === 0) return { ok: false, error: 'Ticket not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'sla_acknowledged',
      entityKind: 'ticket',
      entityId: ticketId,
      reason: note?.trim() || 'SLA breach acknowledged by operator',
    });

    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    return { ok: true };
  } catch (e: any) {
    console.error('[acknowledgeSlaBreach]', e);
    return { ok: false, error: e?.message || 'Failed to acknowledge breach.' };
  }
}
