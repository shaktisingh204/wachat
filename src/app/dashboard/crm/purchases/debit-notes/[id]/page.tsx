import { Button, Card, CardBody, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
 * Debit note detail — `/dashboard/crm/purchases/debit-notes/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component. Lifted onto the canonical `<EntityDetailShell>` —
 * buy-side mirror of the credit-note detail page.
 *
 * Header: back link + eyebrow + status pill + action group
 * (Edit · Apply to bill · Refund · Mark Refunded · Print · Email ·
 * Archive · Activity — see <DebitNoteDetailActions>).
 * Body: header, line items, money summary, refund block, notes.
 * Right rail: money summary · LineageRail (Bill → DN).
 * Audit footer: <EntityAuditTimeline entityKind="debitNote">.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { statusToTone } from '@/components/crm/status-pill';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getDebitNote } from '@/app/actions/crm/debit-notes.actions';
import type { LineageKind } from '@/lib/definitions';

import { DebitNoteDetailActions } from '../_components/debit-note-detail-actions';

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

export default async function DebitNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { debitNote, error } = await getDebitNote(id);

  if (!debitNote) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this debit note — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/debit-notes">
              <ArrowLeft className="h-4 w-4" /> Back to Debit Notes
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const title = debitNote.dnNo || `Debit note ${id.slice(-6)}`;
  const currency = debitNote.currency || 'INR';
  const status = debitNote.status || 'draft';

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`DEBIT NOTE ${debitNote.dnNo ?? id.slice(-6)}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{
        href: '/dashboard/crm/purchases/debit-notes',
        label: 'All debit notes',
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/dashboard/crm/purchases/debit-notes/${id}/activity`}
            >
              <Activity className="h-4 w-4" /> Activity
            </Link>
          </Button>
          <DebitNoteDetailActions id={id} currentStatus={status} />
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button size="sm" asChild>
            <Link href={`/dashboard/crm/purchases/debit-notes/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      }
      rightRail={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Money summary</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Subtotal</span>
                  <span className="text-[var(--st-text)]">
                    {fmtMoney(debitNote.totals?.subTotal, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Overall discount</span>
                  <span>
                    {fmtMoney(debitNote.totals?.discountOverall, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Shipping</span>
                  <span>
                    {fmtMoney(debitNote.totals?.shippingCharge, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Adjustment</span>
                  <span>
                    {fmtMoney(debitNote.totals?.adjustment, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                  <span>Round off</span>
                  <span>{fmtMoney(debitNote.totals?.roundOff, currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-3 text-[14px] font-semibold text-[var(--st-text)]">
                  <span>Total</span>
                  <span>{fmtMoney(debitNote.totals?.total, currency)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <LineageRail
            current={{
              kind: 'debitNote',
              id,
              no: debitNote.dnNo,
              status,
            }}
            lineage={
              (debitNote.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/purchases/debit-notes/${id}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={<EntityAuditTimeline entityKind="debitNote" entityId={id} />}
    >
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Debit note #">{debitNote.dnNo || '—'}</Field>
            <Field label="Date">{fmtDate(debitNote.date)}</Field>
            <Field label="Vendor">
              {debitNote.vendorId ? (
                <EntityPickerChip
                  entity="vendor"
                  id={debitNote.vendorId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Linked bill">
              {debitNote.linkedBillId ? (
                <Link
                  className="text-[var(--st-text)] hover:underline"
                  href={`/dashboard/crm/purchases/expenses/${debitNote.linkedBillId}`}
                >
                  {debitNote.linkedBillId.slice(-8)}
                </Link>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Reason">{debitNote.reason || '—'}</Field>
            <Field label="Currency">{debitNote.currency || '—'}</Field>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--st-border)] p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Line items
          </h3>
        </div>
        <Table>
          <THead>
            <Tr>
              <Th>Item</Th>
              <Th>Description</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Rate</Th>
              <Th className="text-right">Disc %</Th>
              <Th className="text-right">Tax %</Th>
              <Th className="text-right">Line total</Th>
            </Tr>
          </THead>
          <TBody>
            {(debitNote.items ?? []).length === 0 ? (
              <Tr>
                <Td
                  colSpan={7}
                  className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                >
                  No line items.
                </Td>
              </Tr>
            ) : (
              (debitNote.items ?? []).map((item, idx) => (
                <Tr key={idx}>
                  <Td className="text-[12.5px] text-[var(--st-text)]">
                    {item.itemId ? (
                      <EntityPickerChip entity="item" id={item.itemId} />
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {item.description || '—'}
                  </Td>
                  <Td className="text-right tabular-nums text-[12.5px]">
                    {item.qty}
                  </Td>
                  <Td className="text-right tabular-nums text-[12.5px]">
                    {fmtMoney(item.rate, currency)}
                  </Td>
                  <Td className="text-right tabular-nums text-[12.5px]">
                    {item.discountPct != null ? `${item.discountPct}%` : '—'}
                  </Td>
                  <Td className="text-right tabular-nums text-[12.5px]">
                    {item.taxRatePct != null ? `${item.taxRatePct}%` : '—'}
                  </Td>
                  <Td className="text-right tabular-nums text-[12.5px]">
                    {fmtMoney(item.total, currency)}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refund &amp; notes</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Refund mode">{debitNote.refundMode || '—'}</Field>
            <Field label="Refund txn ID">
              {debitNote.refundTxnId || '—'}
            </Field>
            <Field label="Currency">{debitNote.currency || '—'}</Field>
          </div>
          {debitNote.notes ? (
            <div className="mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {debitNote.notes}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="text-[11px] text-[var(--st-text-secondary)]">
        Created {fmtDate(debitNote.createdAt || debitNote.audit?.createdAt)} ·
        Updated {fmtDate(debitNote.updatedAt || debitNote.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
