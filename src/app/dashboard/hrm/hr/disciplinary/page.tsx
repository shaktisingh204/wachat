import { Gavel } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
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

type AnyCase = {
  _id?: { toString(): string } | string;
  caseNo?: string;
  employeeId?: { toString(): string } | string;
  employeeName?: string;
  severity?: string;
  type?: string;
  raisedById?: { toString(): string } | string;
  raisedByName?: string;
  decision?: string;
  status?: string;
  createdAt?: string | Date;
};

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'won' || s === 'resolved') return 'success';
  if (s === 'draft' || s === 'pending' || s === 'open') return 'ghost';
  if (
    s === 'rejected' ||
    s === 'closed_lost' ||
    s === 'cancelled' ||
    s === 'high' ||
    s === 'critical' ||
    s === 'closed'
  )
    return 'danger';
  return 'warning';
}

export default async function DisciplinaryPage() {
  const session = await getSession();
  let cases: AnyCase[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_disciplinary_cases')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      cases = JSON.parse(JSON.stringify(docs)) as AnyCase[];
    } catch (e) {
      console.error('Failed to load crm_disciplinary_cases:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Disciplinary Cases"
        subtitle="Record warnings, investigations and outcomes of disciplinary action."
        icon={Gavel}
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All cases</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Confidential register of disciplinary cases logged across the company.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Case no.</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Severity</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Raised by</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Decision</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load disciplinary cases. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : cases.length > 0 ? (
                cases.map((c, idx) => {
                  const idStr =
                    typeof c._id === 'string'
                      ? c._id
                      : (c._id as any)?.toString?.() ?? String(idx);
                  const caseNo = c.caseNo || idStr;
                  const employee =
                    (c as any).employeeName ||
                    (typeof c.employeeId === 'string'
                      ? c.employeeId
                      : (c.employeeId as any)?.toString?.()) ||
                    '—';
                  const raisedBy =
                    (c as any).raisedByName ||
                    (typeof c.raisedById === 'string'
                      ? c.raisedById
                      : (c.raisedById as any)?.toString?.()) ||
                    '—';
                  return (
                    <ZoruTableRow key={idStr} className="border-zoru-line">
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {caseNo}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{employee}</ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(c.severity)}>
                          {c.severity || 'minor'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{c.type || '—'}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{raisedBy}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {c.decision || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(c.status)}>
                          {c.status || 'open'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No disciplinary cases yet. Log an incident to start a confidential trail.
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
