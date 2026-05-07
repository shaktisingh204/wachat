import { ScrollText } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyAuditEntry = {
  _id?: { toString(): string } | string;
  createdAt?: string | Date;
  actorId?: { toString(): string } | string;
  actorName?: string;
  action?: string;
  entityKind?: string;
  entityId?: { toString(): string } | string;
  reason?: string;
};

function formatDateTime(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export default async function AuditLogPage() {
  const session = await getSession();
  let entries: AnyAuditEntry[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_audit_log')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      entries = JSON.parse(JSON.stringify(docs)) as AnyAuditEntry[];
    } catch (e) {
      console.error('Failed to load crm_audit_log:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Audit Log"
        subtitle="Immutable record of every create, update and delete across the CRM."
        icon={ScrollText}
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">Latest activity</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Showing the most recent 100 audit entries, newest first.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">When</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Actor</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Action</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Entity</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Entity id</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load audit log. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : entries.length > 0 ? (
                entries.map((entry, idx) => {
                  const id =
                    typeof entry._id === 'string'
                      ? entry._id
                      : (entry._id as any)?.toString?.() ?? String(idx);
                  const actor =
                    (entry as any).actorName ||
                    (typeof entry.actorId === 'string'
                      ? entry.actorId
                      : (entry.actorId as any)?.toString?.()) ||
                    '—';
                  const entityId =
                    typeof entry.entityId === 'string'
                      ? entry.entityId
                      : (entry.entityId as any)?.toString?.() ?? '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime(entry.createdAt)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{actor}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {entry.action || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {entry.entityKind || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {entityId}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {entry.reason || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No audit entries yet. Mutations across the CRM will appear here.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
