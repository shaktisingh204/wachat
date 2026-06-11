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
import { formatSabpayAmount, type SabpayPayment } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { getSabpayOrderDetail, getSabpayOrderPayments } from '../../actions/orders';

export const dynamic = 'force-dynamic';

export default async function SabpayOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, payments] = await Promise.all([
    getSabpayOrderDetail(id),
    getSabpayOrderPayments(id).catch(() => [] as SabpayPayment[]),
  ]);
  if (!order) notFound();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Orders', href: '/sabpay/orders' },
        { label: order.id },
      ]}
      eyebrow={order.mode === 'live' ? 'Live order' : 'Test order'}
      title={formatSabpayAmount(order.amount, order.currency)}
      description={order.receipt ? `Receipt ${order.receipt}` : undefined}
      actions={<EntityStatusBadge status={order.status} />}
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Order ID" value={<MonoSpan>{order.id}</MonoSpan>} />
          <DetailRow label="Amount" value={formatSabpayAmount(order.amount, order.currency)} />
          <DetailRow
            label="Amount paid"
            value={formatSabpayAmount(order.amountPaid, order.currency)}
          />
          <DetailRow
            label="Amount due"
            value={formatSabpayAmount(order.amountDue, order.currency)}
          />
          <DetailRow label="Currency" value={order.currency} />
          <DetailRow label="Receipt" value={order.receipt || '—'} />
          <DetailRow label="Created" value={new Date(order.createdAt).toLocaleString()} />
          {order.paidAt ? (
            <DetailRow label="Paid" value={new Date(order.paidAt).toLocaleString()} />
          ) : null}
        </CardBody>
      </Card>

      {order.notes && Object.keys(order.notes).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.entries(order.notes).map(([k, v]) => (
              <DetailRow key={k} label={k} value={<MonoSpan>{String(v)}</MonoSpan>} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardBody>
          {payments.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No payments against this order yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Payment</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/sabpay/payments/${p.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {p.id}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(p.amount, p.currency)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={p.status} />
                    </Td>
                    <Td>{new Date(p.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </SabpayPage>
  );
}
