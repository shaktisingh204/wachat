import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui';
import { formatSabpayAmount } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { getSabpayQrCodeDetail } from '../../actions/qr-codes';
import { QrCodeCloseAction, QrCodePreview } from './qr-code-detail-client';

export const dynamic = 'force-dynamic';

function usageLabel(usage: string): string {
  if (usage === 'single_use') return 'Single use';
  if (usage === 'multiple_use') return 'Multiple use';
  return usage;
}

export default async function SabpayQrCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qr = await getSabpayQrCodeDetail(id);
  if (!qr) notFound();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'QR codes', href: '/sabpay/qr-codes' },
        { label: qr.id },
      ]}
      eyebrow={qr.mode === 'live' ? 'Live QR code' : 'Test QR code'}
      title={qr.name || qr.id}
      description={qr.description}
      actions={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <EntityStatusBadge status={qr.status} />
          <QrCodeCloseAction id={qr.id} status={qr.status} />
        </span>
      }
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Scan to pay</CardTitle>
        </CardHeader>
        <CardBody>
          <QrCodePreview value={qr.payloadUrl} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR code</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="QR ID" value={<MonoSpan>{qr.id}</MonoSpan>} />
          <DetailRow
            label="Amount"
            value={
              qr.fixedAmount && qr.amount != null
                ? formatSabpayAmount(qr.amount)
                : 'Any amount — the customer decides'
            }
          />
          <DetailRow label="Usage" value={usageLabel(qr.usage)} />
          <DetailRow label="Created" value={new Date(qr.createdAt).toLocaleString()} />
          {qr.closedAt ? (
            <DetailRow label="Closed" value={new Date(qr.closedAt).toLocaleString()} />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Captured payments</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Payments received"
            value={
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {qr.paymentsCountReceived}
              </span>
            }
          />
          <DetailRow
            label="Amount received"
            value={
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatSabpayAmount(qr.paymentsAmountReceived)}
              </span>
            }
          />
        </CardBody>
      </Card>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
        Every payment captured by this QR appears in{' '}
        <Link href="/sabpay/payments">Payments</Link> with this QR&rsquo;s id attached.
      </p>
    </SabpayPage>
  );
}
