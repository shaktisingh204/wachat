'use client';

/**
 * SabCRM Commerce — order detail-lite client, 20ui.
 *
 * Renders one storefront order (line items, customer, addresses,
 * totals) with the two lifecycle actions the Rust crate exposes:
 * mark paid (`POST .../mark-paid`) and mark fulfilled
 * (`POST .../mark-fulfilled`). Cancel lives on the list page. Every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import {
  markSabcrmStoreOrderPaid,
  markSabcrmStoreOrderFulfilled,
} from '@/app/actions/sabcrm-commerce.actions';
import type { CrmStoreOrderDoc } from '@/lib/rust-client/sabcrm-commerce';

import '@/components/sabcrm/20ui/surface-crm-base.css';

const PAYMENT_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

const FULFILLMENT_TONE: Record<string, BadgeTone> = {
  unfulfilled: 'warning',
  partial: 'info',
  fulfilled: 'success',
  cancelled: 'danger',
};

function formatAmount(amount: number, currency: string): string {
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

function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
}

function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: CrmStoreOrderDoc['shippingAddress'] | null | undefined;
}): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {address ? (
          <address className="not-italic text-sm leading-6">
            {address.line1}
            <br />
            {address.line2 ? (
              <>
                {address.line2}
                <br />
              </>
            ) : null}
            {address.city}, {address.state} {address.postalCode}
            <br />
            {address.country}
          </address>
        ) : (
          <p className="text-sm">Same as shipping address.</p>
        )}
      </CardBody>
    </Card>
  );
}

export interface OrderDetailClientProps {
  order: CrmStoreOrderDoc;
}

export function OrderDetailClient({
  order,
}: OrderDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const canMarkPaid =
    order.paymentStatus === 'pending' || order.paymentStatus === 'failed';
  const canMarkFulfilled =
    order.fulfillmentStatus === 'unfulfilled' ||
    order.fulfillmentStatus === 'partial';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>): void => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" iconLeft={ArrowLeft} asChild>
          <Link href="/sabcrm/commerce/orders">Orders</Link>
        </Button>
      </div>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{order.orderNumber}</PageTitle>
          <PageDescription>
            Placed {formatDate(order.placedAt)} by {order.customerName} (
            {order.customerEmail}) — part of the SabCRM Commerce suite.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          {canMarkPaid ? (
            <Button
              variant="primary"
              iconLeft={CheckCircle2}
              loading={pending}
              onClick={() => run(() => markSabcrmStoreOrderPaid(order._id))}
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
                run(() => markSabcrmStoreOrderFulfilled(order._id))
              }
            >
              Mark fulfilled
            </Button>
          ) : null}
        </PageActions>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={PAYMENT_TONE[order.paymentStatus] ?? 'neutral'} dot>
          Payment: {order.paymentStatus}
        </Badge>
        <Badge
          tone={FULFILLMENT_TONE[order.fulfillmentStatus] ?? 'neutral'}
          dot
        >
          Fulfilment: {order.fulfillmentStatus}
        </Badge>
        <Badge tone="neutral">{order.paymentMethod}</Badge>
        {order.paymentRef ? (
          <Badge tone="neutral">Ref: {order.paymentRef}</Badge>
        ) : null}
      </div>

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="mt-4">
        <Table hover>
          <THead>
            <Tr>
              <Th>Item</Th>
              <Th>SKU</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Price</Th>
              <Th align="right">Total</Th>
            </Tr>
          </THead>
          <TBody>
            {order.lineItems.map((li, idx) => (
              <Tr key={`${li.productId}-${idx}`}>
                <Td>{li.title}</Td>
                <Td>{li.sku}</Td>
                <Td align="right">{li.quantity}</Td>
                <Td align="right">{formatAmount(li.price, order.currency)}</Td>
                <Td align="right">{formatAmount(li.total, order.currency)}</Td>
              </Tr>
            ))}
            <Tr>
              <Td>Subtotal</Td>
              <Td />
              <Td />
              <Td />
              <Td align="right">
                {formatAmount(order.subtotal, order.currency)}
              </Td>
            </Tr>
            {order.discount ? (
              <Tr>
                <Td>Discount</Td>
                <Td />
                <Td />
                <Td />
                <Td align="right">
                  −{formatAmount(order.discount, order.currency)}
                </Td>
              </Tr>
            ) : null}
            <Tr>
              <Td>Shipping</Td>
              <Td />
              <Td />
              <Td />
              <Td align="right">
                {formatAmount(order.shippingTotal, order.currency)}
              </Td>
            </Tr>
            <Tr>
              <Td>Tax</Td>
              <Td />
              <Td />
              <Td />
              <Td align="right">
                {formatAmount(order.taxTotal, order.currency)}
              </Td>
            </Tr>
            <Tr>
              <Td>
                <strong>Total</strong>
              </Td>
              <Td />
              <Td />
              <Td />
              <Td align="right">
                <strong>{formatAmount(order.total, order.currency)}</strong>
              </Td>
            </Tr>
          </TBody>
        </Table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <AddressBlock title="Shipping address" address={order.shippingAddress} />
        <AddressBlock title="Billing address" address={order.billingAddress} />
      </div>
    </div>
  );
}
