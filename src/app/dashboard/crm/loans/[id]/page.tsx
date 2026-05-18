import { ZoruBadge, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
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

function fmtMoney(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
    <div className="grid grid-cols-3 gap-3 border-b border-zoru-line/60 py-2 last:border-0">
      <dt className="col-span-1 text-[12.5px] text-zoru-ink-muted">{label}</dt>
      <dd className="col-span-2 text-[13px] text-zoru-ink">{value ?? '—'}</dd>
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
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Outstanding principal</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Outstanding</span>
                  <span
                    className={`font-mono tabular-nums ${
                      (loan.outstanding ?? 0) > 0
                        ? 'text-zoru-danger-ink'
                        : 'text-zoru-ink'
                    }`}
                  >
                    {fmtMoney(loan.outstanding ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Principal</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(loan.principal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">EMI</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(loan.emi)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Borrower</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1 text-[12.5px]">
                <div className="text-zoru-ink">{loan.borrowerName || '—'}</div>
                <div className="text-zoru-ink-muted">
                  {loan.borrowerId ? `ID ${loan.borrowerId}` : ''}
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Next payment</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Due</span>
                  <span>{fmtDate(next.dueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Amount</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(next.amount)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/sales/receipts?loanId=${id}`}
                  className="text-zoru-primary hover:underline"
                >
                  Payment receipts →
                </Link>
                <Link
                  href={`/dashboard/crm/loans/${id}/documents`}
                  className="text-zoru-primary hover:underline"
                >
                  Loan documents →
                </Link>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      }
    >
      <ZoruCard>
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
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Borrower</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl>
            <Field label="Name" value={loan.borrowerName || '—'} />
            <Field label="Borrower ID" value={loan.borrowerId || '—'} />
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>EMI schedule</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {schedule.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No schedule generated yet. Use{' '}
              <strong>Generate EMI schedule</strong> in the header.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">#</th>
                  <th className="py-2">Due date</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr
                    key={row.no}
                    className="border-b border-zoru-line/40 last:border-0"
                  >
                    <td className="py-2 text-zoru-ink-muted">{row.no}</td>
                    <td className="py-2">{fmtDate(row.dueDate)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {fmtMoney(row.amount)}
                    </td>
                    <td className="py-2 text-right">
                      <ZoruBadge variant={row.paid ? 'success' : 'outline'}>
                        {row.paid ? 'Paid' : 'Pending'}
                      </ZoruBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {payments.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No payments recorded yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Mode</th>
                  <th className="py-2">Txn</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr
                    key={p._id ?? `${p.date}-${idx}`}
                    className="border-b border-zoru-line/40 last:border-0"
                  >
                    <td className="py-2">{fmtDate(p.date)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {fmtMoney(p.amount)}
                    </td>
                    <td className="py-2">{p.mode || '—'}</td>
                    <td className="py-2 text-zoru-ink-muted">
                      {p.txnId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Documents</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {/* TODO 1D.2: loan-document collection not yet implemented */}
          <p className="text-[13px] text-zoru-ink-muted">
            No documents uploaded yet.{' '}
            <Link
              href={`/dashboard/crm/loans/${id}/documents`}
              className="text-zoru-primary hover:underline"
            >
              Manage documents →
            </Link>
          </p>
        </ZoruCardContent>
      </ZoruCard>

      {loan.notes ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {loan.notes}
            </p>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {Array.isArray(loan.tags) && loan.tags.length > 0 ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Tags</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex flex-wrap gap-2">
              {loan.tags.map((t) => (
                <ZoruBadge key={t} variant="outline">
                  {t}
                </ZoruBadge>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}
    </EntityDetailShell>
  );
}
