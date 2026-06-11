import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { formatSabpayAmount } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { CopyableId } from '../../_components/copyable-id';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { InvoiceEditorClient } from '../../_components/invoice-editor-client';
import { getSabpayCustomers } from '../../actions/customers';
import { getSabpayInvoiceDetail } from '../../actions/invoices';
import { InvoiceDetailClient } from './invoice-detail-client';

export const dynamic = 'force-dynamic';

export default async function SabpayInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getSabpayInvoiceDetail(id);
  if (!invoice) notFound();

  const breadcrumb = [
    { label: 'SabNode', href: '/dashboard' },
    { label: 'SabPay', href: '/sabpay' },
    { label: 'Invoices', href: '/sabpay/invoices' },
    { label: invoice.id },
  ];
  const eyebrow = invoice.mode === 'live' ? 'Live invoice' : 'Test invoice';

  /* ── Draft → editable ──────────────────────────────────────────────────── */

  if (invoice.status === 'draft') {
    const customers = await getSabpayCustomers({ limit: 100 });
    return (
      <SabpayPage
        breadcrumb={breadcrumb}
        eyebrow={eyebrow}
        title="Edit invoice"
        description="This invoice is a draft — edit anything below, then issue it to get a payable link."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <EntityStatusBadge status={invoice.status} />
            <InvoiceDetailClient invoice={invoice} />
          </div>
        }
        width="narrow"
      >
        <InvoiceEditorClient mode={invoice.mode} customers={customers} initial={invoice} />
      </SabpayPage>
    );
  }

  /* ── Issued / paid / cancelled / expired → read-only ───────────────────── */

  const customerLabel =
    invoice.customerName || invoice.customerEmail || invoice.customerPhone;

  return (
    <SabpayPage
      breadcrumb={breadcrumb}
      eyebrow={eyebrow}
      title={formatSabpayAmount(invoice.amount, invoice.currency)}
      description={customerLabel ? `Invoice for ${customerLabel}` : 'Invoice'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <EntityStatusBadge status={invoice.status} />
          <InvoiceDetailClient invoice={invoice} />
        </div>
      }
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Invoice ID" value={<CopyableId value={invoice.id} />} />
          <DetailRow
            label="Type"
            value={invoice.type === 'subscription_cycle' ? 'Subscription cycle' : 'Invoice'}
          />
          <DetailRow label="Created" value={new Date(invoice.createdAt).toLocaleString()} />
          {invoice.issuedAt ? (
            <DetailRow label="Issued" value={new Date(invoice.issuedAt).toLocaleString()} />
          ) : null}
          {invoice.expireBy ? (
            <DetailRow label="Due date" value={new Date(invoice.expireBy).toLocaleString()} />
          ) : null}
          {invoice.paidAt ? (
            <DetailRow label="Paid" value={new Date(invoice.paidAt).toLocaleString()} />
          ) : null}
          {invoice.cancelledAt ? (
            <DetailRow
              label="Cancelled"
              value={new Date(invoice.cancelledAt).toLocaleString()}
            />
          ) : null}
          {invoice.shortUrl ? (
            <DetailRow label="Payable link" value={<CopyableId value={invoice.shortUrl} />} />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Name" value={invoice.customerName || '—'} />
          <DetailRow label="Email" value={invoice.customerEmail || '—'} />
          <DetailRow label="Phone" value={invoice.customerPhone || '—'} />
          {invoice.customerId ? (
            <DetailRow
              label="Customer"
              value={
                <Link href={`/sabpay/customers/${invoice.customerId}`}>
                  <MonoSpan>{invoice.customerId}</MonoSpan>
                </Link>
              }
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Description</Th>
                <Th style={{ textAlign: 'right' }}>Qty</Th>
                <Th style={{ textAlign: 'right' }}>Unit amount</Th>
                <Th style={{ textAlign: 'right' }}>Total</Th>
              </Tr>
            </THead>
            <TBody>
              {invoice.lineItems.map((item, i) => (
                <Tr key={i}>
                  <Td>
                    {item.name}
                    {item.description ? (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          color: 'var(--st-text-muted)',
                        }}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {item.quantity}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatSabpayAmount(item.amount, invoice.currency)}
                  </Td>
                  <Td
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                    }}
                  >
                    {formatSabpayAmount(item.amount * item.quantity, invoice.currency)}
                  </Td>
                </Tr>
              ))}
              <Tr>
                <Td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>
                  Total
                </Td>
                <Td
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {formatSabpayAmount(invoice.amount, invoice.currency)}
                </Td>
              </Tr>
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Payment"
            value={
              invoice.paymentId ? (
                <Link href={`/sabpay/payments/${invoice.paymentId}`}>
                  <MonoSpan>{invoice.paymentId}</MonoSpan>
                </Link>
              ) : (
                '—'
              )
            }
          />
          {invoice.subscriptionId ? (
            <DetailRow
              label="Subscription"
              value={
                <Link href={`/sabpay/subscriptions/${invoice.subscriptionId}`}>
                  <MonoSpan>{invoice.subscriptionId}</MonoSpan>
                </Link>
              }
            />
          ) : null}
        </CardBody>
      </Card>

      {invoice.notes && Object.keys(invoice.notes).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.entries(invoice.notes).map(([key, value]) => (
              <DetailRow key={key} label={key} value={<MonoSpan>{String(value)}</MonoSpan>} />
            ))}
          </CardBody>
        </Card>
      ) : null}
    </SabpayPage>
  );
}
