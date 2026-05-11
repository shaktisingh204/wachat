export const dynamic = 'force-dynamic';

import { Target } from 'lucide-react';
import { ObjectId } from 'mongodb';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import Link from 'next/link';

type AnyBudget = {
  _id?: { toString(): string } | string;
  budgetHead?: string;
  period?: string;
  planAmount?: number;
  actual?: number;
  variance?: number;
  ownerId?: string;
  ownerName?: string;
  approverId?: string;
  approverName?: string;
  scenario?: 'best' | 'base' | 'worst' | string;
  status?: string;
  alertAt?: number;
  createdAt?: string | Date;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value === 0) return '₹0';
  return inr.format(value);
}

function scenarioLabel(s: string | undefined): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusVariant(
  s: string | undefined,
): 'default' | 'secondary' | 'danger' | 'outline' | 'success' {
  if (!s) return 'outline';
  const lower = s.toLowerCase();
  if (lower === 'approved') return 'success';
  if (lower === 'rejected') return 'danger';
  if (lower === 'draft') return 'secondary';
  return 'outline';
}

export default async function BudgetsPage() {
  const session = await getSession();
  let budgets: AnyBudget[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_budgets')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      budgets = JSON.parse(JSON.stringify(docs)) as AnyBudget[];
    } catch (e) {
      console.error('Failed to load crm_budgets:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Budgets & Forecasting"
        subtitle="Track revenue and expense targets against actuals."
        icon={Target}
        actions={
          <Link href="/dashboard/crm/budgets/new">
            <ZoruButton variant="outline" size="sm">
              New budget
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All budgets</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            One row per budget head, with plan, actual and variance.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Budget Head</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Plan Amount</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Actual</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Variance</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Approver</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Scenario</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load budgets.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : budgets.length > 0 ? (
                budgets.map((row, idx) => {
                  const id =
                    typeof row._id === 'string'
                      ? row._id
                      : (row._id as any)?.toString?.() ?? String(idx);
                  const variance = typeof row.variance === 'number' ? row.variance : undefined;
                  const varianceColor =
                    variance === undefined
                      ? ''
                      : variance < 0
                        ? 'text-red-600'
                        : 'text-green-600';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {row.budgetHead || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{row.period || '—'}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney(row.planAmount)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney(row.actual)}
                      </ZoruTableCell>
                      <ZoruTableCell className={`text-zoru-ink ${varianceColor}`}>
                        {formatMoney(variance)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {row.ownerName || row.ownerId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {row.approverName || row.approverId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {scenarioLabel(row.scenario)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={statusVariant(row.status)}>
                          {row.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No budgets yet. Create a budget to start tracking actuals against plan.
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
