'use client';

/**
 * SabCRM Commerce — order detail client (DocDetailPage adopter,
 * spec WI-13).
 *
 * The storefront order on the doc-surface paper: customer as the
 * party, line items + totals as the document body, shipping method /
 * payment ref / addresses in the meta + rail, and the two lifecycle
 * transitions the `crm-store` crate exposes (mark paid / mark
 * fulfilled) plus Cancel in the header actions bar. `linkedInvoiceId`
 * links across to the finance invoice when set. Every action re-runs
 * the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PackageCheck, PackageX } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import {
  DocDetailPage,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  ORDER_FULFILLMENT_LABEL,
  ORDER_FULFILLMENT_TONE,
  ORDER_PAYMENT_FLOW,
  ORDER_PAYMENT_STATUSES,
  ORDERS_PATH,
} from '../orders-config';

import {
  markSabcrmStoreOrderPaid,
  markSabcrmStoreOrderFulfilled,
  cancelSabcrmStoreOrder,
} from '@/app/actions/sabcrm-commerce.actions';
import type { CrmStoreOrderDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmStoreAddress } from '@/lib/rust-client/crm-store';

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function addressLines(addr: CrmStoreAddress | null | undefined): string[] {
  if (!addr) return [];
  return [
    addr.line1,
    addr.line2 || '',
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean);
}

function AddressCard({
  title,
  addr,
}: {
  title: string;
  addr: CrmStoreAddress | null | undefined;
}): React.JSX.Element {
  const lines = addressLines(addr);
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {lines.length ? (
          <address className="not-italic text-sm leading-6">
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </address>
        ) : (
          <span className="text-sm text-[var(--st-text-secondary)]">
            Same as shipping address.
          </span>
        )}
      </CardBody>
    </Card>
  );
}

export interface OrderDetailClientProps {
  order: CrmStoreOrderDoc;
  storefrontLabel: string | null;
}

export function OrderDetailClient({
  order,
  storefrontLabel,
}: OrderDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const canMarkPaid =
    order.paymentStatus === 'pending' || order.paymentStatus === 'failed';
  const canMarkFulfilled =
    order.fulfillmentStatus === 'unfulfilled' ||
    order.fulfillmentStatus === 'partial';
  const canCancel = order.fulfillmentStatus !== 'cancelled';

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ): void => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Something went wrong.');
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  };

  const lines: DocDetailLine[] = order.lineItems.map((li) => ({
    description: li.title,
    itemLabel: li.sku || null,
    qty: li.quantity,
    rate: li.price,
    total: li.total,
  }));

  const currency = order.currency || 'INR';

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Placed', value: order.placedAt.slice(0, 10) },
    { label: 'Storefront', value: storefrontLabel ?? 'Unknown' },
    { label: 'Payment method', value: order.paymentMethod || '—' },
  ];
  if (order.paymentRef) {
    meta.push({ label: 'Payment ref', value: order.paymentRef });
  }
  meta.push({
    label: 'Shipping',
    value: fmtMoney(order.shippingTotal, currency),
  });
  meta.push({
    label: 'Fulfilment',
    value: (
      <Badge tone={ORDER_FULFILLMENT_TONE[order.fulfillmentStatus] ?? 'neutral'} dot>
        {ORDER_FULFILLMENT_LABEL[order.fulfillmentStatus] ?? order.fulfillmentStatus}
      </Badge>
    ),
  });
  if (order.linkedInvoiceId) {
    meta.push({
      label: 'Invoice',
      value: (
        <Link
          href={`/sabcrm/finance/invoices/${encodeURIComponent(order.linkedInvoiceId)}`}
          className="text-[var(--st-accent)] hover:underline"
        >
          View invoice
        </Link>
      ),
    });
  }

  return (
    <DocDetailPage
      backHref={ORDERS_PATH}
      backLabel="Orders"
      docNumber={order.orderNumber}
      entitySingular="Order"
      statuses={ORDER_PAYMENT_STATUSES}
      flow={ORDER_PAYMENT_FLOW}
      status={order.paymentStatus}
      actions={
        <>
          {canMarkPaid ? (
            <Button
              variant="primary"
              iconLeft={CheckCircle2}
              loading={pending}
              onClick={() =>
                run(() => markSabcrmStoreOrderPaid(order._id), 'Order marked paid.')
              }
            >
              Mark paid
            </Button>
          ) : null}
          {canMarkFulfilled ? (
            <Button
              variant="secondary"
              iconLeft={PackageCheck}
              loading={pending}
              onClick={() =>
                run(
                  () => markSabcrmStoreOrderFulfilled(order._id),
                  'Order marked fulfilled.',
                )
              }
            >
              Mark fulfilled
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="ghost"
              iconLeft={PackageX}
              loading={pending}
              onClick={() =>
                run(() => cancelSabcrmStoreOrder(order._id), 'Order cancelled.')
              }
            >
              Cancel
            </Button>
          ) : null}
        </>
      }
      party={{
        label: order.customerName,
        href: null,
        meta: order.customerEmail,
      }}
      meta={meta}
      currency={currency}
      lines={lines}
      totals={{
        subTotal: order.subtotal,
        discountTotal: order.discount ?? undefined,
        taxTotal: order.taxTotal,
        total: order.total,
      }}
      related={[]}
      railExtra={
        <>
          <AddressCard title="Shipping address" addr={order.shippingAddress} />
          <AddressCard title="Billing address" addr={order.billingAddress} />
        </>
      }
    />
  );
}
