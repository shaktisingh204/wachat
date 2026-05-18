import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyAwardProgram = {
  _id?: { toString(): string } | string;
  name?: string;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  nominations?: unknown[];
  winners?: unknown[];
  status?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatPeriod(start?: string | Date, end?: string | Date): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s === '—' && e === '—') return '—';
  return `${s} – ${e}`;
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'won' || s === 'published') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
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

export default async function AwardsPage() {
  const session = await getSession();
  let programs: AnyAwardProgram[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_award_programs')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      programs = JSON.parse(JSON.stringify(docs)) as AnyAwardProgram[];
    } catch (e) {
      console.error('Failed to load crm_award_programs:', e);
      loadError = true;
    }
  }

  // §1D.1 KPI strip
  const totalNominations = programs.reduce(
    (a, p) => a + (Array.isArray(p.nominations) ? p.nominations.length : 0),
    0,
  );
  const totalWinners = programs.reduce(
    (a, p) => a + (Array.isArray(p.winners) ? p.winners.length : 0),
    0,
  );
  const activePrograms = programs.filter(
    (p) => String(p.status || '').toLowerCase() === 'active',
  ).length;
  // Top program by nomination count.
  const topProgram = programs.reduce<{ name: string; count: number }>(
    (acc, p) => {
      const c = Array.isArray(p.nominations) ? p.nominations.length : 0;
      return c > acc.count ? { name: p.name || 'Untitled', count: c } : acc;
    },
    { name: '—', count: 0 },
  );

  return (
    <EntityListShell
      title="Awards & Recognition Programs"
      subtitle="Celebrate top performers with structured awards and peer nominations."
      primaryAction={
        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrm/hr/awards/new">
            <Plus className="h-4 w-4" /> New program
          </Link>
        </ZoruButton>
      }
    >

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ZoruCard className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Total programs
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-zoru-ink">
            {programs.length}
          </div>
        </ZoruCard>
        <ZoruCard className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Active
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-zoru-success-ink">
            {activePrograms}
          </div>
        </ZoruCard>
        <ZoruCard className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Total nominations
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-zoru-ink">
            {totalNominations}
          </div>
        </ZoruCard>
        <ZoruCard className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Total winners
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-zoru-ink">
            {totalWinners}
          </div>
        </ZoruCard>
        <ZoruCard className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Top program
          </div>
          <div className="mt-1 truncate text-[15px] font-semibold leading-tight text-zoru-ink">
            {topProgram.name}
          </div>
          <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
            {topProgram.count} nominations
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All programs</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Recognition cycles you have run, with nomination and winner counts.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Program name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Total nominations</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Total winners</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load award programs. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : programs.length > 0 ? (
                programs.map((program, idx) => {
                  const id =
                    typeof program._id === 'string'
                      ? program._id
                      : (program._id as any)?.toString?.() ?? String(idx);
                  const nominations = Array.isArray(program.nominations)
                    ? program.nominations.length
                    : 0;
                  const winners = Array.isArray(program.winners)
                    ? program.winners.length
                    : 0;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/hrm/hr/awards/${id}`}
                          className="hover:underline"
                        >
                          {program.name || 'Untitled program'}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatPeriod(program.periodStart, program.periodEnd)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{nominations}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{winners}</ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(program.status)}>
                          {program.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No award programs yet. Define a recognition cycle to start collecting nominations.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
