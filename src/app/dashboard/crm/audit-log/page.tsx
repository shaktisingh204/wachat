import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { AuditLogBrowser, type AuditLogRow } from './_components/audit-log-browser';

interface RawAuditDoc {
  _id?: { toString(): string } | string;
  createdAt?: string | Date;
  actorId?: { toString(): string } | string;
  actorName?: string;
  action?: string;
  entityKind?: string;
  entityId?: { toString(): string } | string;
  reason?: string | null;
  diff?: Record<string, { before?: unknown; after?: unknown }> | null;
  ip?: string;
}

function toStr(v: { toString(): string } | string | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === 'string' ? v : v.toString();
}

export default async function AuditLogPage() {
  const session = await getSession();
  let rows: AuditLogRow[] = [];

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = (await db
        .collection('crm_audit_log')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray()) as RawAuditDoc[];

      rows = docs.map((d, idx) => ({
        _id: toStr(d._id) ?? String(idx),
        createdAt:
          d.createdAt instanceof Date
            ? d.createdAt.toISOString()
            : typeof d.createdAt === 'string'
              ? d.createdAt
              : undefined,
        actorId: toStr(d.actorId),
        actorName: d.actorName,
        action: d.action,
        entityKind: d.entityKind,
        entityId: toStr(d.entityId),
        reason: d.reason ?? null,
        diff: d.diff ?? null,
        ip: d.ip,
      }));
    } catch (e) {
      console.error('Failed to load crm_audit_log:', e);
    }
  }

  return <AuditLogBrowser entries={rows} />;
}
