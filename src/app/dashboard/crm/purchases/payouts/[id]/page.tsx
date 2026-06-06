import { Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import {
  Pencil,
  ArrowLeft,
  Activity,
  Printer,
  Mail,
  ClipboardList,
  } from 'lucide-react';

/**
 * Payout detail — `/dashboard/crm/purchases/payouts/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component. Lifted onto the canonical `<EntityDetailShell>` so
 * the header / body / right-rail / audit-footer composition matches the
 * Invoices template. Buy-side mirror of the receipt detail page.
 *
 * Header: back link + eyebrow + status pill + action group
 * (Edit / Mark cleared / Mark failed / Reverse / Print / Email — see
 * <PayoutDetailActions>).
 * Body: header card, applied-bill rows, deductions, notes.
 * Right rail: LineageRail (PO→GRN→bill→payout) · money summary
 * (Paid / Settled / TDS / Advance) · activity link.
 * Audit footer: <EntityAuditTimeline entityKind="payout">.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { statusToTone } from '@/components/crm/status-pill';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getPayout } from '@/app/actions/crm/payouts.actions';
import type { LineageKind } from '@/lib/definitions';

import { PayoutDetailActions } from '../_components/payout-detail-actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value: number | undefined, currency?: string): string {
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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  neft: 'NEFT',
  rtgs: 'RTGS',
  imps: 'IMPS',
  card: 'Card',
  wallet: 'Wallet',
};

function modeLabel(mode: string | undefined): string {
  if (!mode) return '—';
  return PAYMENT_MODE_LABELS[mode] ?? mode;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this payout — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/payouts">
              <ArrowLeft className="h-4 w-4" /> Back to Payouts
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const title = payout.paymentNo || `Payout ${id.slice(-6)}`;
  const currency = payout.currency || 'INR';
  const status = payout.status || 'sent';
  const totalSettled = (payout.applyTo ?? []).reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );
  const advance = Math.max(0, (Number(payout.amount) || 0) - totalSettled);

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`PAYOUT ${payout.paymentNo ?? id.slice(-6)}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{ href: '/dashboard/crm/purchases/payouts', label: 'All payouts' }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/purchases/payouts/${id}/activity`}>
              <Activity className="h-4 w-4" /> Activity
            </Link>
          </Button>
          <PayoutDetailActions id={id} currentStatus={status} />
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button size="sm" asChild>
            <Link href={`/dashboard/crm/purchases/payouts/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      }
      rightRail={
        <>
          <LineageRail
            current={{
              kind: 'payout',
              id,
              no: payout.paymentNo,
              status,
            }}
            lineage={
              (payout.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>Money summary</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Paid</span>
                  <span className="text-[var(--st-text)]">
                    {fmtMoney(payout.amount, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Settled</span>
                  <span>{fmtMoney(totalSettled, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>TDS</span>
                  <span>{fmtMoney(payout.tdsDeducted, currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-3 text-[14px] font-semibold text-[var(--st-text)]">
                  <span>Advance</span>
                  <span>{fmtMoney(advance, currency)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link href={`/dashboard/crm/purchases/payouts/${id}/activity`}>
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={<EntityAuditTimeline entityKind="payout" entityId={id} />}
    >
      {/* Header card */}
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Payment #">{payout.paymentNo || '—'}</Field>
            <Field label="Date">{fmtDate(payout.date)}</Field>
            <Field label="Vendor">
              {payout.vendorId ? (
                <EntityPickerChip entity="vendor" id={payout.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Mode">{modeLabel(payout.mode)}</Field>
            <Field label="Bank account">
              {payout.bankAccountId ? (
                <EntityPickerChip
                  entity="bankAccount"
                  id={payout.bankAccountId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Cheque #">{payout.chequeNo || '—'}</Field>
            <Field label="Cheque date">{fmtDate(payout.chequeDate)}</Field>
            <Field label="Transaction ID">{payout.txnId || '—'}</Field>
            <Field label="Reference">{payout.reference || '—'}</Field>
          </div>
        </CardBody>
      </Card>

      {/* Applied bills */}
      <Card>
        <CardHeader>
          <CardTitle>
            Applied to bills ({payout.applyTo?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {payout.applyTo && payout.applyTo.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {payout.applyTo.map((row, idx) => (
                <li
                  key={`${row.billId}-${idx}`}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
                >
                  <Link
                    href={`/dashboard/crm/purchases/expenses/${row.billId}`}
                    className="text-[13px] font-medium text-[var(--st-text)] hover:underline"
                  >
                    {row.billId.slice(-8)}
                  </Link>
                  <span className="text-[13px] tabular-nums text-[var(--st-text)]">
                    {fmtMoney(row.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
              No bills applied — this payout records an advance.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Deductions + notes */}
      <Card>
        <CardHeader>
          <CardTitle>Deductions &amp; notes</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="TDS deducted">
              {fmtMoney(payout.tdsDeducted, currency)}
            </Field>
            <Field label="Excess as advance">
              {payout.excessAsAdvance ? 'Yes' : 'No'}
            </Field>
            <Field label="Exchange rate">
              {payout.exchangeRate != null
                ? payout.exchangeRate.toFixed(4)
                : '—'}
            </Field>
            <Field label="Currency">{payout.currency || '—'}</Field>
          </div>
          {payout.notes ? (
            <div className="mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {payout.notes}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="text-[11px] text-[var(--st-text-secondary)]">
        Created {fmtDate(payout.createdAt || payout.audit?.createdAt)} ·
        Updated {fmtDate(payout.updatedAt || payout.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
