import { HandCoins, Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

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

type AnyLoan = {
  _id?: { toString(): string } | string;
  type?: string;
  borrowerId?: { toString(): string } | string;
  borrowerName?: string;
  principal?: number;
  interestRate?: number;
  tenureMonths?: number;
  emi?: number;
  outstanding?: number;
  npa?: boolean;
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

function formatNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return String(value);
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value}%`;
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'npa' || s === 'cancelled' || s === 'expired' || s === 'lost') return 'danger';
  return 'warning';
}

function formatType(type?: string): string {
  if (!type) return '—';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function LoansPage() {
  const session = await getSession();
  let loans: AnyLoan[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_loans')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      loans = JSON.parse(JSON.stringify(docs)) as AnyLoan[];
    } catch (e) {
      console.error('Failed to load crm_loans:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Loans & Advances"
        subtitle="Employee advances, customer and vendor loans with EMI and NPA tracking."
        icon={HandCoins}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/loans/new">
              <Plus className="h-4 w-4" /> New loan
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All loans</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Principal, EMI schedule and outstanding balance per borrower.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Borrower</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Principal</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Interest %</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Tenure (months)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">EMI</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Outstanding</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">NPA</ZoruTableHead>
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
                    Could not load loans. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : loans.length > 0 ? (
                loans.map((loan, idx) => {
                  const id =
                    typeof loan._id === 'string'
                      ? loan._id
                      : (loan._id as any)?.toString?.() ?? String(idx);
                  const borrower =
                    (loan as any).borrowerName ||
                    (typeof loan.borrowerId === 'string'
                      ? loan.borrowerId
                      : (loan.borrowerId as any)?.toString?.()) ||
                    '—';
                  const isNpa = Boolean((loan as any).npa);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {formatType(loan.type)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{borrower}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((loan as any).principal)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatPercent((loan as any).interestRate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber((loan as any).tenureMonths)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((loan as any).emi)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney((loan as any).outstanding)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {isNpa ? (
                          <ZoruBadge variant="danger">Yes</ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">No</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(loan.status)}>
                          {loan.status || 'draft'}
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
                    No loans yet. Disburse a new loan to start tracking EMIs.
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
