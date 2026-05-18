'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  use,
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Repeat,
  ArrowLeft,
  Play,
  Pause,
  StopCircle,
  Zap,
  LoaderCircle,
  Trash2,
  } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

import {
  getRecurringInvoiceById,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  stopRecurringInvoice,
  runRecurringInvoiceNow,
  deleteRecurringInvoice,
} from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringInvoice } from '@/lib/worksuite/billing-types';

type Row = WsRecurringInvoice & { _id: string };

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  paused: 'warning',
  stopped: 'danger',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number | undefined, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

export default function RecurringInvoiceDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Row | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();

  const load = useCallback(() => {
    startLoading(async () => {
      const d = await getRecurringInvoiceById(id);
      setDoc(d as unknown as Row | null);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handle = (
    fn: () => Promise<{ message?: string; error?: string; invoiceId?: string }>,
    successTitle: string,
  ) => {
    startMutating(async () => {
      const res = await fn();
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: successTitle,
        description: res.message || 'Done.',
      });
      load();
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this recurring invoice? This cannot be undone.')) return;
    startMutating(async () => {
      const r = await deleteRecurringInvoice(id);
      if (r.success) {
        toast({ title: 'Deleted', description: 'Recurring invoice removed.' });
        router.push('/dashboard/crm/sales/recurring-invoices');
      } else {
        toast({
          title: 'Error',
          description: r.error || 'Failed to delete',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading && !doc) {
    return (
      <div className="flex w-full flex-col gap-6">
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Not found"
          subtitle="The recurring invoice does not exist."
          icon={Repeat}
        />
        <Link href="/dashboard/crm/sales/recurring-invoices">
          <ZoruButton variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Back
          </ZoruButton>
        </Link>
      </div>
    );
  }

  const items = Array.isArray(doc.items) ? doc.items : [];
  const generated = Array.isArray((doc as any).generated_invoice_ids)
    ? ((doc as any).generated_invoice_ids as unknown[])
    : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Recurring — ${doc.client_name || 'Client'}`}
        subtitle={`Every ${doc.frequency_count} ${doc.frequency} · next on ${fmtDate(doc.next_issue_date)}`}
        icon={Repeat}
        actions={
          <>
            <Link href="/dashboard/crm/sales/recurring-invoices">
              <ZoruButton variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </ZoruButton>
            </Link>
            <ZoruButton
              disabled={isMutating || doc.status === 'stopped'}
              onClick={() => handle(() => runRecurringInvoiceNow(id), 'Invoice generated')}
            >
              {isMutating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Run now
            </ZoruButton>
            {doc.status === 'active' ? (
              <ZoruButton
                variant="outline"
                onClick={() => handle(() => pauseRecurringInvoice(id), 'Paused')}
                disabled={isMutating}
              >
                <Pause className="h-4 w-4" />
                Pause
              </ZoruButton>
            ) : doc.status === 'paused' ? (
              <ZoruButton
                variant="outline"
                onClick={() => handle(() => resumeRecurringInvoice(id), 'Resumed')}
                disabled={isMutating}
              >
                <Play className="h-4 w-4" />
                Resume
              </ZoruButton>
            ) : null}
            {doc.status !== 'stopped' ? (
              <ZoruButton
                variant="outline"
                onClick={() => handle(() => stopRecurringInvoice(id), 'Stopped')}
                disabled={isMutating}
              >
                <StopCircle className="h-4 w-4" />
                Stop
              </ZoruButton>
            ) : null}
            <ZoruButton
              variant="outline"
              onClick={handleDelete}
              disabled={isMutating}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </ZoruButton>
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase text-zoru-ink-muted">
              Status
            </p>
            <ZoruBadge variant={STATUS_VARIANTS[doc.status] || 'ghost'}>
              {doc.status}
            </ZoruBadge>
          </div>
          <div>
            <p className="text-[12px] uppercase text-zoru-ink-muted">
              Issued
            </p>
            <p className="text-[15px] text-zoru-ink">
              {doc.issued_count || 0}
              {doc.stop_at_count ? ` / ${doc.stop_at_count}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase text-zoru-ink-muted">
              Last Issued
            </p>
            <p className="text-[15px] text-zoru-ink">
              {fmtDate(doc.last_issued_at)}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase text-zoru-ink-muted">
              Total
            </p>
            <p className="text-[18px] text-zoru-ink">
              {fmtMoney(doc.total, doc.currency)}
            </p>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
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
                  <td
                    colSpan={4}
                    className="p-4 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No items.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx} className="border-b border-zoru-line">
                    <td className="p-3 text-zoru-ink">
                      <div>{it.name || '—'}</div>
                      {it.description ? (
                        <div className="text-[12px] text-zoru-ink-muted">
                          {it.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">{it.quantity}</td>
                    <td className="p-3 text-right">
                      {fmtMoney(it.unit_price, doc.currency)}
                    </td>
                    <td className="p-3 text-right">
                      {fmtMoney(
                        it.total ?? it.quantity * it.unit_price,
                        doc.currency,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-3 text-[15px] text-zoru-ink">
          Generated Invoices
        </h2>
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
      </ZoruCard>
    </div>
  );
}
