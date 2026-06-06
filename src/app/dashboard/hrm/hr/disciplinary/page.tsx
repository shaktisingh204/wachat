import { Suspense } from 'react';
import { Badge, Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  Gavel,
  Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

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

async function DisciplinaryPageContainer() {
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

  // §1D.1 KPI strip
  const open = cases.filter(
    (c) => String(c.status || '').toLowerCase() === 'open',
  ).length;
  const closed = cases.filter((c) => {
    const s = String(c.status || '').toLowerCase();
    return s === 'resolved' || s === 'dismissed' || s === 'closed';
  }).length;
  const critical = cases.filter(
    (c) =>
      String(c.severity || '').toLowerCase() === 'critical' ||
      String(c.severity || '').toLowerCase() === 'high',
  ).length;
  const underReview = cases.filter(
    (c) => String(c.status || '').toLowerCase() === 'under_review',
  ).length;

  // Avg resolution days
  const resolvedWithDates = cases.filter((c) => {
    const s = String(c.status || '').toLowerCase();
    return (s === 'resolved' || s === 'dismissed') && c.createdAt && (c as any).resolvedAt;
  });
  const avgResolutionDays = (() => {
    if (resolvedWithDates.length === 0) return '—';
    const total = resolvedWithDates.reduce((acc, c) => {
      const start = new Date(c.createdAt as any).getTime();
      const end = new Date((c as any).resolvedAt as any).getTime();
      return acc + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(total / resolvedWithDates.length);
  })();

  return (
    <EntityListShell
      title="Disciplinary Cases"
      subtitle="Record warnings, investigations and outcomes of disciplinary action."
      primaryAction={
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrm/hr/disciplinary/new">
            <Plus className="h-4 w-4" /> New case
          </Link>
        </Button>
      }
    >

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Open
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-warn)]">
            {open}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Under review
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-text)]">
            {underReview}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Closed
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-status-ok)]">
            {closed}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Critical / high
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-danger)]">
            {critical}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Avg resolution
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-text)]">
            {avgResolutionDays === '—' ? '—' : `${avgResolutionDays}d`}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-[var(--st-text)]">All cases</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Confidential register of disciplinary cases logged across the company.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Case no.</Th>
                <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                <Th className="text-[var(--st-text-secondary)]">Severity</Th>
                <Th className="text-[var(--st-text-secondary)]">Type</Th>
                <Th className="text-[var(--st-text-secondary)]">Raised by</Th>
                <Th className="text-[var(--st-text-secondary)]">Decision</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
              </Tr>
            </THead>
            <TBody>
              {loadError ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    Could not load disciplinary cases. Please try again.
                  </Td>
                </Tr>
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
                    <Tr key={idStr} className="border-[var(--st-border)]">
                      <Td className="font-mono text-[12px] text-[var(--st-text)]">
                        <Link
                          href={`/dashboard/hrm/hr/disciplinary/${idStr}`}
                          className="hover:underline"
                        >
                          {caseNo}
                        </Link>
                      </Td>
                      <Td className="text-[var(--st-text)]">{employee}</Td>
                      <Td>
                        <Badge variant={getStatusVariant(c.severity)}>
                          {c.severity || 'minor'}
                        </Badge>
                      </Td>
                      <Td className="text-[var(--st-text)]">{c.type || '—'}</Td>
                      <Td className="text-[var(--st-text)]">{raisedBy}</Td>
                      <Td className="text-[var(--st-text)]">
                        {c.decision || '—'}
                      </Td>
                      <Td>
                        <Badge variant={getStatusVariant(c.status)}>
                          {c.status || 'open'}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No disciplinary cases yet. Log an incident to start a confidential trail.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}

export default function DisciplinaryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DisciplinaryPageContainer  />
    </Suspense>
  );
}
