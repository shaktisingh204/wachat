import { fmtDate } from '@/lib/utils';
import { Suspense } from 'react';
import { Badge, Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { AwardProgram } from './schema';

export const dynamic = 'force-dynamic';

function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return fmtDate(d);
}

function formatPeriod(start?: string | Date | null, end?: string | Date | null): string {
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

async function AwardsPageContainer() {
  const session = await getSession();
  let programs: AwardProgram[] = [];
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
      programs = JSON.parse(JSON.stringify(docs)) as AwardProgram[];
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
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrm/hr/awards/new">
            <Plus className="h-4 w-4" /> New program
          </Link>
        </Button>
      }
    >

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Total programs
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-text)]">
            {programs.length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Active
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-status-ok)]">
            {activePrograms}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Total nominations
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-text)]">
            {totalNominations}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Total winners
          </div>
          <div className="mt-1 text-[20px] font-semibold leading-tight text-[var(--st-text)]">
            {totalWinners}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Top program
          </div>
          <div className="mt-1 truncate text-[15px] font-semibold leading-tight text-[var(--st-text)]">
            {topProgram.name}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
            {topProgram.count} nominations
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-[var(--st-text)]">All programs</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Recognition cycles you have run, with nomination and winner counts.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Program name</Th>
                <Th className="text-[var(--st-text-secondary)]">Period</Th>
                <Th className="text-[var(--st-text-secondary)]">Total nominations</Th>
                <Th className="text-[var(--st-text-secondary)]">Total winners</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
              </Tr>
            </THead>
            <TBody>
              {loadError ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    Could not load award programs. Please try again.
                  </Td>
                </Tr>
              ) : programs.length > 0 ? (
                programs.map((program, idx) => {
                  const id = program._id ? String(program._id) : String(idx);
                  const nominations = Array.isArray(program.nominations)
                    ? program.nominations.length
                    : 0;
                  const winners = Array.isArray(program.winners)
                    ? program.winners.length
                    : 0;
                  return (
                    <Tr key={id} className="border-[var(--st-border)]">
                      <Td className="text-[var(--st-text)]">
                        <Link
                          href={`/dashboard/hrm/hr/awards/${id}`}
                          className="hover:underline"
                        >
                          {program.name || 'Untitled program'}
                        </Link>
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {formatPeriod(program.periodStart, program.periodEnd)}
                      </Td>
                      <Td className="text-[var(--st-text)]">{nominations}</Td>
                      <Td className="text-[var(--st-text)]">{winners}</Td>
                      <Td>
                        <Badge variant={getStatusVariant(program.status)}>
                          {program.status || 'draft'}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No award programs yet. Define a recognition cycle to start collecting nominations.
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

export default function AwardsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AwardsPageContainer  />
    </Suspense>
  );
}
