import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Loan detail — `/dashboard/crm/loans/[id]`.
 *
 * Per §1D.2: 8 actions, body cards (Overview · Borrower · Schedule ·
 * Payment history · Notes · Tags), right rail with outstanding/next
 * payment, audit footer.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getLoanById } from '@/app/actions/crm-loans.actions';

import { LoanDetailActions } from '../_components/loan-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { LoansRepaymentSchedule } from '../_components/loans-repayment-schedule';

type LoanDoc = {
  _id: string;
  type?: string;
  borrowerName?: string;
  borrowerId?: string;
  principal?: number;
  interestRate?: number;
  tenureMonths?: number;
  emi?: number;
  outstanding?: number;
  npa?: boolean;
  startDate?: string;
  status?: string;
  notes?: string;
  tags?: string[];
  payments?: Array<{
    _id?: string;
    amount?: number;
    date?: string;
    mode?: string;
    txnId?: string;
  }>;
  schedule?: Array<{
    no: number;
    dueDate: string;
    amount: number;
    paid?: boolean;
  }>;
  disbursedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function statusTone(status?: string): EntityStatusTone {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'closed':
      return 'green';
    case 'npa':
      return 'red';
    case 'draft':
      return 'neutral';
    default:
      return 'amber';
  }
}

import { fmtDate, fmtINR as fmtMoney } from '@/lib/utils';

function nextDueRow(loan: LoanDoc): { dueDate?: string; amount?: number } {
  if (!Array.isArray(loan.schedule) || loan.schedule.length === 0) {
    return {};
  }
  const next = loan.schedule.find((r) => !r.paid);
  return next ? { dueDate: next.dueDate, amount: next.amount } : {};
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-[var(--st-border)]/60 py-2 last:border-0">
      <dt className="col-span-1 text-[12.5px] text-[var(--st-text-secondary)]">{label}</dt>
      <dd className="col-span-2 text-[13px] text-[var(--st-text)]">{value ?? '—'}</dd>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LoanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const loan = (await getLoanById(id)) as LoanDoc | null;
  if (!loan) notFound();

  const status = loan.status ?? 'draft';
  const next = nextDueRow(loan);
  const schedule = loan.schedule ?? [];
  const payments = loan.payments ?? [];

  return (
    <EntityDetailShell
      title={loan.borrowerName || 'Loan'}
      eyebrow={`LOAN · ${(loan.type || 'customer_loan').replace(/_/g, ' ').toUpperCase()}`}
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/loans', label: 'Back to loans' }}
      actions={<LoanDetailActions loanId={id} status={status} />}
      audit={<EntityAuditTimeline entityKind="loan" entityId={id} />}
      rightRail={
        <>
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Outstanding principal</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Outstanding</span>
                  <span
                    className={`font-mono tabular-nums ${
                      (loan.outstanding ?? 0) > 0
                        ? 'text-[var(--st-danger)]'
                        : 'text-[var(--st-text)]'
                    }`}
                  >
                    {fmtMoney(loan.outstanding ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Principal</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(loan.principal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2">
                  <span className="text-[var(--st-text-secondary)]">EMI</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(loan.emi)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Borrower</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1 text-[12.5px]">
                <div className="text-[var(--st-text)]">{loan.borrowerName || '—'}</div>
                <div className="text-[var(--st-text-secondary)]">
                  {loan.borrowerId ? `ID ${loan.borrowerId}` : ''}
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Next payment</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Due</span>
                  <span>{fmtDate(next.dueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Amount</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(next.amount)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/sales/receipts?loanId=${id}`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Payment receipts →
                </Link>
                <Link
                  href={`/dashboard/crm/loans/${id}/documents`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Loan documents →
                </Link>
              </div>
            </ZoruCardContent>
          </Card>
        </>
      }
    >
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl>
            <Field
              label="Type"
              value={(loan.type || '—').replace(/_/g, ' ')}
            />
            <Field label="Principal" value={fmtMoney(loan.principal)} />
            <Field
              label="Interest rate"
              value={
                typeof loan.interestRate === 'number'
                  ? `${loan.interestRate}%`
                  : '—'
              }
            />
            <Field label="Tenure (months)" value={loan.tenureMonths ?? '—'} />
            <Field label="EMI" value={fmtMoney(loan.emi)} />
            <Field label="Outstanding" value={fmtMoney(loan.outstanding)} />
            <Field label="NPA" value={loan.npa ? 'Yes' : 'No'} />
            <Field label="Start date" value={fmtDate(loan.startDate)} />
            <Field label="Disbursed at" value={fmtDate(loan.disbursedAt)} />
            <Field label="Status" value={status} />
          </dl>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Borrower</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl>
            <Field label="Name" value={loan.borrowerName || '—'} />
            <Field label="Borrower ID" value={loan.borrowerId || '—'} />
          </dl>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>EMI schedule</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <LoansRepaymentSchedule schedule={schedule} />
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {payments.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No payments recorded yet.
            </p>
          ) : (
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="border-b border-[var(--st-border)]/60 text-left text-[11px] uppercase text-[var(--st-text-secondary)] bg-transparent">
                  <TableHead className="py-2 h-auto">Date</TableHead>
                  <TableHead className="py-2 text-right h-auto">Amount</TableHead>
                  <TableHead className="py-2 h-auto">Mode</TableHead>
                  <TableHead className="py-2 h-auto">Txn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p, idx) => (
                  <TableRow
                    key={p._id ?? `${p.date}-${idx}`}
                    className="border-b border-[var(--st-border)]/40 last:border-0"
                  >
                    <TableCell className="py-2">{fmtDate(p.date)}</TableCell>
                    <TableCell className="py-2 text-right font-mono tabular-nums">
                      {fmtMoney(p.amount)}
                    </TableCell>
                    <TableCell className="py-2">{p.mode || '—'}</TableCell>
                    <TableCell className="py-2 text-[var(--st-text-secondary)]">
                      {p.txnId || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Documents</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {/* TODO 1D.2: loan-document collection not yet implemented */}
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            No documents uploaded yet.{' '}
            <Link
              href={`/dashboard/crm/loans/${id}/documents`}
              className="text-[var(--st-text)] hover:underline"
            >
              Manage documents →
            </Link>
          </p>
        </ZoruCardContent>
      </Card>

      {loan.notes ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {loan.notes}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}

      {Array.isArray(loan.tags) && loan.tags.length > 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Tags</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex flex-wrap gap-2">
              {loan.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
