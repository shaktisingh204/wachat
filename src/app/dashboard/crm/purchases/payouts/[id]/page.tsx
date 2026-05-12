/**
 * Payout detail — `/dashboard/crm/purchases/payouts/[id]`.
 *
 * Server component: hydrates the payout via the Rust client, resolves
 * relational fields (vendor, bank account, currency) through
 * `<EntityPickerChip>`, and renders the allocation summary. Edit and
 * Delete actions live on this page; the delete dialog is on the list
 * page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wallet, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruButton, ZoruCard, ZoruBadge } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getPayout } from '@/app/actions/crm/payouts.actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { payout, error } = await getPayout(id);

  if (!payout) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this payout — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/payouts">
              <ArrowLeft className="h-4 w-4" /> Back to Payouts
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const title = payout.paymentNo || String(payout._id);
  const applied = payout.applyTo ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={`Payout · ${fmtMoney(payout.amount, payout.currency)}`}
        icon={Wallet}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/payouts">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/payouts/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Payout #">{payout.paymentNo || '—'}</Field>
            <Field label="Date">{fmtDate(payout.date)}</Field>
            <Field label="Vendor">
              {payout.vendorId ? (
                <EntityPickerChip entity="vendor" id={payout.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Payment method">
              <ZoruBadge variant="outline">{payout.mode}</ZoruBadge>
            </Field>
            <Field label="Bank account">
              {payout.bankAccountId ? (
                <EntityPickerChip entity="bankAccount" id={payout.bankAccountId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Status">
              {payout.status ? (
                <ZoruBadge variant="outline">{payout.status}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Mode details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cheque #">{payout.chequeNo || '—'}</Field>
            <Field label="Cheque date">{fmtDate(payout.chequeDate)}</Field>
            <Field label="Transaction ID">
              {payout.txnId ? (
                <span className="font-mono text-[12.5px]">{payout.txnId}</span>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Reference">{payout.reference || '—'}</Field>
          </div>

          {payout.notes ? (
            <>
              <h3 className="mb-2 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {payout.notes}
              </p>
            </>
          ) : null}
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Amount
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Amount">{fmtMoney(payout.amount, payout.currency)}</Field>
            <Field label="Currency">{payout.currency || '—'}</Field>
            <Field label="TDS deducted">
              {fmtMoney(payout.tdsDeducted, payout.currency)}
            </Field>
            <Field label="Excess as advance">
              {payout.excessAsAdvance ? 'Yes' : 'No'}
            </Field>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Allocation
        </h3>
        {applied.length === 0 ? (
          <p className="text-[13px] text-zoru-ink-muted">
            No bill allocations on this payout.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {applied.map((row, idx) => (
              <div
                key={`${row.billId}-${idx}`}
                className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[13px]"
              >
                <span className="font-mono text-[12px] text-zoru-ink">
                  {row.billId}
                </span>
                <span className="tabular-nums text-zoru-ink">
                  {fmtMoney(row.amount, payout.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ZoruCard>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(payout.createdAt || payout.audit?.createdAt)} · Updated{' '}
        {fmtDate(payout.updatedAt || payout.audit?.updatedAt)}
      </div>
    </div>
  );
}
