import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
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
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/purchases/payouts/${id}/activity`}>
              <Activity className="h-4 w-4" /> Activity
            </Link>
          </ZoruButton>
          <PayoutDetailActions id={id} currentStatus={status} />
          <ZoruButton variant="outline" size="sm" disabled title="Coming soon">
            <Printer className="h-4 w-4" /> Print
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" disabled title="Coming soon">
            <Mail className="h-4 w-4" /> Email
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href={`/dashboard/crm/purchases/payouts/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </ZoruButton>
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

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Money summary</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                <div className="flex items-center justify-between text-zoru-ink-muted">
                  <span>Paid</span>
                  <span className="text-zoru-ink">
                    {fmtMoney(payout.amount, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zoru-ink-muted">
                  <span>Settled</span>
                  <span>{fmtMoney(totalSettled, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-zoru-ink-muted">
                  <span>TDS</span>
                  <span>{fmtMoney(payout.tdsDeducted, currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-3 text-[14px] font-semibold text-zoru-ink">
                  <span>Advance</span>
                  <span>{fmtMoney(advance, currency)}</span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruButton size="sm" variant="ghost" asChild className="w-full">
            <Link href={`/dashboard/crm/purchases/payouts/${id}/activity`}>
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </ZoruButton>
        </>
      }
      audit={<EntityAuditTimeline entityKind="payout" entityId={id} />}
    >
      {/* Header card */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Header</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
        </ZoruCardContent>
      </ZoruCard>

      {/* Applied bills */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>
            Applied to bills ({payout.applyTo?.length ?? 0})
          </ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {payout.applyTo && payout.applyTo.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {payout.applyTo.map((row, idx) => (
                <li
                  key={`${row.billId}-${idx}`}
                  className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                >
                  <Link
                    href={`/dashboard/crm/purchases/expenses/${row.billId}`}
                    className="text-[13px] font-medium text-zoru-ink hover:underline"
                  >
                    {row.billId.slice(-8)}
                  </Link>
                  <span className="text-[13px] tabular-nums text-zoru-ink">
                    {fmtMoney(row.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-zoru-ink-muted">
              No bills applied — this payout records an advance.
            </p>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Deductions + notes */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Deductions &amp; notes</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
              <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Notes
              </div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                {payout.notes}
              </div>
            </div>
          ) : null}
        </ZoruCardContent>
      </ZoruCard>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(payout.createdAt || payout.audit?.createdAt)} ·
        Updated {fmtDate(payout.updatedAt || payout.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
