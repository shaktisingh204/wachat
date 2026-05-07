import { Wallet } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
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

type AnyFloat = {
  _id?: { toString(): string } | string;
  branchId?: { toString(): string } | string;
  branchName?: string;
  custodianId?: { toString(): string } | string;
  custodianName?: string;
  openingBalance?: number;
  totalTopUps?: number;
  totalSpent?: number;
  balance?: number;
  lastReconciledAt?: string | Date;
  status?: string;
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

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default async function PettyCashPage() {
  const session = await getSession();
  let floats: AnyFloat[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_petty_cash_floats')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      floats = JSON.parse(JSON.stringify(docs)) as AnyFloat[];
    } catch (e) {
      console.error('Failed to load crm_petty_cash_floats:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Petty Cash"
        subtitle="Branch and employee cash floats with top-ups, spends and reconciliation."
        icon={Wallet}
        actions={
          <ZoruButton variant="outline" size="sm">
            New float
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All petty cash floats</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            One row per branch or employee float, with running balance.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Branch / Custodian</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Opening</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Top-ups</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Spent</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Balance</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last reconciled</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load petty cash floats. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : floats.length > 0 ? (
                floats.map((row, idx) => {
                  const id =
                    typeof row._id === 'string'
                      ? row._id
                      : (row._id as any)?.toString?.() ?? String(idx);
                  const branch =
                    (row as any).branchName ||
                    (typeof row.branchId === 'string'
                      ? row.branchId
                      : (row.branchId as any)?.toString?.()) ||
                    '—';
                  const custodian = (row as any).custodianName || '';
                  const label = custodian ? `${branch} · ${custodian}` : branch;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{label}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((row as any).openingBalance)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((row as any).totalTopUps)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((row as any).totalSpent)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((row as any).balance)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((row as any).lastReconciledAt)}
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
                    No petty cash floats yet. Open a branch or employee float to start tracking.
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
