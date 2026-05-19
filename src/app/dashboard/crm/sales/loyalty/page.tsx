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
import {
  ObjectId } from 'mongodb';
import { Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyLoyaltyProgram = {
  _id?: { toString(): string } | string;
  name?: string;
  tiers?: unknown[];
  pointsPerCurrencyUnit?: number;
  expiryDays?: number;
  status?: string;
  createdAt?: string | Date;
};

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'redeemed' || s === 'won') return 'success';
  if (s === 'draft' || s === 'pending' || s === 'issued') return 'ghost';
  if (s === 'expired' || s === 'cancelled' || s === 'voided') return 'danger';
  return 'warning';
}

function formatPointsRate(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function formatExpiryRule(days: number | undefined | null): string {
  if (typeof days !== 'number' || Number.isNaN(days)) return '—';
  if (days <= 0) return 'Never expires';
  return `${days.toLocaleString()} days`;
}

export default async function SalesLoyaltyPage() {
  let programs: AnyLoyaltyProgram[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_loyalty_programs')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      programs = JSON.parse(JSON.stringify(docs)) as AnyLoyaltyProgram[];
    } catch (e) {
      console.error('Failed to load CRM loyalty programs:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Loyalty"
      subtitle="Reward repeat customers with tiered points programs and expiry rules."
      primaryAction={
        <Link href="/dashboard/crm/sales/loyalty/new">
          <ZoruButton variant="outline">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New program
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All loyalty programs</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Tiered membership programs, points accrual rates and expiry policies.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Program name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Tiers</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Points/₹</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expiry rule</ZoruTableHead>
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
                    Could not load loyalty programs. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : programs.length > 0 ? (
                programs.map((p, idx) => {
                  const id =
                    typeof p._id === 'string'
                      ? p._id
                      : (p._id as any)?.toString?.() ?? String(idx);
                  const tiers = (p as any).tiers;
                  const tiersCount = Array.isArray(tiers) ? tiers.length : 0;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <EntityRowLink
                          href={`/dashboard/crm/sales/loyalty/${id}`}
                          label={(p as any).name || 'Untitled program'}
                          subtitle={tiersCount ? `${tiersCount} tier${tiersCount === 1 ? '' : 's'}` : undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {tiersCount}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatPointsRate((p as any).pointsPerCurrencyUnit)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatExpiryRule((p as any).expiryDays)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(p.status)}>
                          {p.status || 'draft'}
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
                    No loyalty programs yet. Launch your first program to reward
                    repeat customers.
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
