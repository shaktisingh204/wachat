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
import { CopyableId } from '../../_components/copyable-id';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { getSabpayPaymentLinkDetail } from '../../actions/payment-links';
import { PaymentLinkCancelAction } from './payment-link-detail-client';

export const dynamic = 'force-dynamic';

export default async function SabpayPaymentLinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const link = await getSabpayPaymentLinkDetail(id);
  if (!link) notFound();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payment links', href: '/sabpay/payment-links' },
        { label: link.id },
      ]}
      eyebrow={link.mode === 'live' ? 'Live payment link' : 'Test payment link'}
      title={formatSabpayAmount(link.amount, link.currency)}
      description={link.description}
      actions={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <EntityStatusBadge status={link.status} />
          <PaymentLinkCancelAction id={link.id} status={link.status} />
        </span>
      }
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Link</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Link ID" value={<MonoSpan>{link.id}</MonoSpan>} />
          <DetailRow label="Link URL" value={<CopyableId value={link.shortUrl} />} />
          <DetailRow
            label="Reference ID"
            value={link.referenceId ? <MonoSpan>{link.referenceId}</MonoSpan> : '—'}
          />
          <DetailRow label="Created" value={new Date(link.createdAt).toLocaleString()} />
          <DetailRow
            label="Expires"
            value={link.expireBy ? new Date(link.expireBy).toLocaleString() : 'Never'}
          />
          {link.paidAt ? (
            <DetailRow label="Paid" value={new Date(link.paidAt).toLocaleString()} />
          ) : null}
          {link.cancelledAt ? (
            <DetailRow
              label="Cancelled"
              value={new Date(link.cancelledAt).toLocaleString()}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Name" value={link.customerName || '—'} />
          <DetailRow label="Email" value={link.customerEmail || '—'} />
          <DetailRow label="Phone" value={link.customerPhone || '—'} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked payment</CardTitle>
        </CardHeader>
        <CardBody>
          {link.paymentId ? (
            <DetailRow
              label="Payment ID"
              value={
                <Link
                  href={`/sabpay/payments/${link.paymentId}`}
                  style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 }}
                >
                  {link.paymentId}
                </Link>
              }
            />
          ) : (
            <p style={{ margin: 0, color: 'var(--st-text-muted)', fontSize: 14 }}>
              No payment yet — this link hasn&rsquo;t been paid.
            </p>
          )}
        </CardBody>
      </Card>

      {link.notes && Object.keys(link.notes).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.entries(link.notes).map(([k, v]) => (
              <DetailRow key={k} label={k} value={<MonoSpan>{String(v)}</MonoSpan>} />
            ))}
          </CardBody>
        </Card>
      ) : null}
    </SabpayPage>
  );
}
