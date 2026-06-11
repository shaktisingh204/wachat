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
import { formatSabpayAmount, type SabpayRefund } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { PaymentStatusBadge } from '../../_components/payment-status-badge';
import { getSabpayPaymentDetail } from '../../actions';
import { getSabpayPaymentRefunds } from '../../actions/refunds';
import { CopyCheckoutLink } from './copy-checkout-link';
import { PaymentActions } from './payment-actions';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--st-border)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--st-text-muted)' }}>{label}</span>
      <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

export default async function SabpayPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [payment, refunds] = await Promise.all([
    getSabpayPaymentDetail(id),
    getSabpayPaymentRefunds(id).catch(() => [] as SabpayRefund[]),
  ]);
  if (!payment) notFound();

  const mono = { fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 } as const;

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payments', href: '/sabpay/payments' },
        { label: payment.id },
      ]}
      eyebrow={payment.mode === 'live' ? 'Live payment' : 'Test payment'}
      title={formatSabpayAmount(payment.amount, payment.currency)}
      description={payment.description}
      actions={
        <>
          <PaymentStatusBadge status={payment.status} />
          <PaymentActions
            paymentId={payment.id}
            status={payment.status}
            amount={payment.amount}
            amountRefunded={payment.amountRefunded ?? 0}
            currency={payment.currency}
          />
        </>
      }
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardBody>
          <Row label="Payment ID" value={<span style={mono}>{payment.id}</span>} />
          <Row label="Created" value={new Date(payment.createdAt).toLocaleString()} />
          {payment.paidAt ? (
            <Row label="Paid" value={new Date(payment.paidAt).toLocaleString()} />
          ) : null}
          {payment.status === 'created' ? (
            <Row
              label="Checkout link"
              value={<CopyCheckoutLink url={payment.checkoutUrl} />}
            />
          ) : null}
          {payment.failureReason ? (
            <Row label="Failure reason" value={payment.failureReason} />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardBody>
          <Row label="Name" value={payment.customer.name || '—'} />
          <Row label="Email" value={payment.customer.email || '—'} />
          <Row label="Phone" value={payment.customer.phone || '—'} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gateway</CardTitle>
        </CardHeader>
        <CardBody>
          <Row label="Provider" value="PayU" />
          <Row
            label="Transaction ID"
            value={<span style={mono}>{payment.providerTxnId || '—'}</span>}
          />
          <Row
            label="PayU payment ID"
            value={<span style={mono}>{payment.providerPaymentId || '—'}</span>}
          />
          <Row label="Method" value={payment.providerMeta?.paymentMode || '—'} />
          <Row label="Bank reference" value={payment.providerMeta?.bankRefNum || '—'} />
          {payment.providerMeta?.errorMessage ? (
            <Row label="Gateway message" value={payment.providerMeta.errorMessage} />
          ) : null}
        </CardBody>
      </Card>

      {refunds.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
          </CardHeader>
          <CardBody>
            <Table>
              <THead>
                <Tr>
                  <Th>Refund</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {refunds.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Link
                        href={`/sabpay/refunds/${r.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {r.id}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(r.amount, r.currency)}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={r.status} />
                    </Td>
                    <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            {payment.amountRefunded ? (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--st-text-muted)' }}>
                {formatSabpayAmount(payment.amountRefunded, payment.currency)} of{' '}
                {formatSabpayAmount(payment.amount, payment.currency)} refunded
                {payment.refundStatus ? ` (${payment.refundStatus})` : ''}.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {payment.metadata && Object.keys(payment.metadata).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.entries(payment.metadata).map(([k, v]) => (
              <Row key={k} label={k} value={<span style={mono}>{v}</span>} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
        Redirects: success →{' '}
        {payment.successUrl ? (
          <Link href={payment.successUrl}>{payment.successUrl}</Link>
        ) : (
          'hosted receipt'
        )}
        {' · '}failure →{' '}
        {payment.cancelUrl ? (
          <Link href={payment.cancelUrl}>{payment.cancelUrl}</Link>
        ) : (
          'hosted receipt'
        )}
      </p>
    </SabpayPage>
  );
}
