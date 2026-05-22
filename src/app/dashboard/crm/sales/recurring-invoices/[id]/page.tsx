import { Badge, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Repeat } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getRecurringInvoiceById } from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringInvoice } from '@/lib/worksuite/billing-types';
import { RecurringInvoiceDetailActions } from './_components/recurring-invoice-detail-actions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  active: 'green',
  paused: 'amber',
  stopped: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number | undefined, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

type Row = WsRecurringInvoice & { _id: string };

export default async function RecurringInvoiceDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const raw = await getRecurringInvoiceById(id);
  if (!raw) notFound();

  const doc = raw as unknown as Row;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const generated = Array.isArray((doc as any).generated_invoice_ids)
    ? ((doc as any).generated_invoice_ids as unknown[])
    : [];

  return (
    <EntityDetailShell
      eyebrow="RECURRING INVOICE"
      title={`${doc.client_name || 'Client'} — every ${doc.frequency_count} ${doc.frequency}`}
      status={
        doc.status
          ? { label: doc.status, tone: STATUS_TONE[doc.status] ?? 'neutral' }
          : undefined
      }
      back={{ href: '/dashboard/crm/sales/recurring-invoices', label: 'Recurring invoices' }}
      actions={
        <RecurringInvoiceDetailActions id={id} status={doc.status ?? 'stopped'} />
      }
      rightRail={
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Next issue
              </p>
              <p className="mt-1 text-[13px] text-zoru-ink">{fmtDate(doc.next_issue_date)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Issued
              </p>
              <p className="mt-1 text-[13px] text-zoru-ink">
                {doc.issued_count || 0}
                {doc.stop_at_count ? ` / ${doc.stop_at_count}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Last issued
              </p>
              <p className="mt-1 text-[13px] text-zoru-ink">{fmtDate(doc.last_issued_at)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Total
              </p>
              <p className="mt-1 text-[18px] font-semibold text-zoru-ink">
                {fmtMoney(doc.total, doc.currency)}
              </p>
            </div>
          </div>
        </Card>
      }
    >
      {/* Line items */}
      <Card className="p-6">
        <h2 className="mb-3 text-[15px] text-zoru-ink">Line Items</h2>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-sm">
            <thead className="bg-zoru-surface-2">
              <tr className="border-b border-zoru-line text-left">
                <th className="p-3 text-zoru-ink">Item</th>
                <th className="p-3 text-right text-zoru-ink">Qty</th>
                <th className="p-3 text-right text-zoru-ink">Unit</th>
                <th className="p-3 text-right text-zoru-ink">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-[13px] text-zoru-ink-muted">
                    No items.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx} className="border-b border-zoru-line">
                    <td className="p-3 text-zoru-ink">
                      <div>{it.name || '—'}</div>
                      {it.description ? (
                        <div className="text-[12px] text-zoru-ink-muted">{it.description}</div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">{it.quantity}</td>
                    <td className="p-3 text-right">{fmtMoney(it.unit_price, doc.currency)}</td>
                    <td className="p-3 text-right">
                      {fmtMoney(it.total ?? it.quantity * it.unit_price, doc.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Generated invoices */}
      <Card className="p-6">
        <h2 className="mb-3 text-[15px] text-zoru-ink">Generated Invoices</h2>
        {generated.length === 0 ? (
          <p className="text-[13px] text-zoru-ink-muted">
            No invoices generated yet. Click <em>Run now</em> to create one.
          </p>
        ) : (
          <ul className="space-y-1 text-[13px] text-zoru-ink">
            {generated.map((inv, i) => (
              <li key={i} className="font-mono">
                {String(inv)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </EntityDetailShell>
  );
}
