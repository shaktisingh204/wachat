'use client';

import { use, useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ArrowLeft,
  FileText,
  LoaderCircle,
  Trash2,
} from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getOrderById,
  convertOrderToInvoice,
  deleteOrder,
} from '@/app/actions/worksuite/billing.actions';
import type { WsOrder } from '@/lib/worksuite/billing-types';

type OrderRow = WsOrder & { _id: string };

const STATUS_TONES: Record<
  string,
  'neutral' | 'amber' | 'green' | 'red' | 'blue'
> = {
  pending: 'neutral',
  confirmed: 'blue',
  shipped: 'amber',
  delivered: 'green',
  cancelled: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

function fmtAddress(addr: unknown): string {
  if (!addr) return '—';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, string | undefined>;
    return (
      [a.line1, a.line2, a.city, a.state, a.postalCode, a.country]
        .filter(Boolean)
        .join(', ') || '—'
    );
  }
  return '—';
}

export default function OrderDetailPage(props: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(props.params);
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isConverting, startConverting] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const load = useCallback(() => {
    startLoading(async () => {
      const doc = await getOrderById(orderId);
      setOrder(doc as unknown as OrderRow | null);
    });
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConvert = () => {
    startConverting(async () => {
      const res = await convertOrderToInvoice(orderId);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Invoice created',
        description: 'Order converted to invoice successfully.',
      });
      if (res.invoiceId) {
        router.push(`/dashboard/crm/sales/invoices`);
      } else {
        load();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    startDeleting(async () => {
      const r = await deleteOrder(orderId);
      if (r.success) {
        toast({ title: 'Deleted', description: 'Order removed.' });
        router.push('/dashboard/crm/sales/orders');
      } else {
        toast({
          title: 'Error',
          description: r.error || 'Failed to delete',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading && !order) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Order not found"
          subtitle="The requested order does not exist."
          icon={ShoppingCart}
        />
        <Link href="/dashboard/crm/sales/orders">
          <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
            Back to orders
          </ClayButton>
        </Link>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const tone = STATUS_TONES[order.status] || 'neutral';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={order.order_number || 'Order'}
        subtitle={`Placed on ${fmtDate(order.order_date)}`}
        icon={ShoppingCart}
        actions={
          <>
            <Link href="/dashboard/crm/sales/orders">
              <ClayButton
                variant="pill"
                leading={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </ClayButton>
            </Link>
            {!order.invoice_id ? (
              <ClayButton
                variant="obsidian"
                onClick={handleConvert}
                disabled={isConverting}
                leading={
                  isConverting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )
                }
              >
                Convert to Invoice
              </ClayButton>
            ) : (
              <ClayBadge tone="green" dot>
                Converted
              </ClayBadge>
            )}
            <ClayButton
              variant="pill"
              onClick={handleDelete}
              disabled={isDeleting}
              leading={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </ClayButton>
          </>
        }
      />

      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
              Client
            </p>
            <p className="text-[15px] font-medium text-foreground">
              {order.client_name || '—'}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <ClayBadge tone={tone} dot>
              {order.status}
            </ClayBadge>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="text-[18px] font-semibold text-foreground">
              {fmtMoney(order.total, order.currency)}
            </p>
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">
          Line Items
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-foreground">Item</th>
                <th className="p-3 text-right font-medium text-foreground">Qty</th>
                <th className="p-3 text-right font-medium text-foreground">
                  Unit price
                </th>
                <th className="p-3 text-right font-medium text-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-[13px] text-muted-foreground"
                  >
                    No line items on this order.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="p-3 text-foreground">
                      <div className="font-medium">{it.name || '—'}</div>
                      {it.description ? (
                        <div className="text-[12px] text-muted-foreground">
                          {it.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">{it.quantity}</td>
                    <td className="p-3 text-right">
                      {fmtMoney(it.unit_price, order.currency)}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {fmtMoney(it.total ?? it.quantity * it.unit_price, order.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-secondary">
                <td colSpan={3} className="p-3 text-right text-muted-foreground">
                  Subtotal
                </td>
                <td className="p-3 text-right font-medium">
                  {fmtMoney(order.subtotal, order.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="p-3 text-right text-muted-foreground">
                  Tax
                </td>
                <td className="p-3 text-right font-medium">
                  {fmtMoney(order.tax, order.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="p-3 text-right text-muted-foreground">
                  Discount
                </td>
                <td className="p-3 text-right font-medium">
                  -{fmtMoney(order.discount, order.currency)}
                </td>
              </tr>
              <tr className="bg-secondary">
                <td colSpan={3} className="p-3 text-right font-semibold text-foreground">
                  Total
                </td>
                <td className="p-3 text-right font-semibold text-foreground">
                  {fmtMoney(order.total, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-foreground">
              Shipping Address
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {fmtAddress(order.shipping_address)}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-foreground">
              Billing Address
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {fmtAddress(order.billing_address)}
            </p>
          </div>
          {order.payment_terms ? (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                Payment Terms
              </h3>
              <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
                {order.payment_terms}
              </p>
            </div>
          ) : null}
          {order.notes ? (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
                {order.notes}
              </p>
            </div>
          ) : null}
        </div>
      </ClayCard>
    </div>
  );
}
