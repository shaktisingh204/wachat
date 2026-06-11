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
import { getSabpayRefundDetail } from '../../actions/refunds';

export const dynamic = 'force-dynamic';

export default async function SabpayRefundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const refund = await getSabpayRefundDetail(id);
  if (!refund) notFound();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Refunds', href: '/sabpay/refunds' },
        { label: refund.id },
      ]}
      eyebrow={refund.mode === 'live' ? 'Live refund' : 'Test refund'}
      title={formatSabpayAmount(refund.amount, refund.currency)}
      description={refund.reason}
      actions={<EntityStatusBadge status={refund.status} />}
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Refund</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Refund ID" value={<CopyableId value={refund.id} />} />
          <DetailRow
            label="Payment"
            value={
              <Link
                href={`/sabpay/payments/${refund.paymentId}`}
                style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 }}
              >
                {refund.paymentId}
              </Link>
            }
          />
          <DetailRow
            label="Amount"
            value={formatSabpayAmount(refund.amount, refund.currency)}
          />
          <DetailRow label="Status" value={<EntityStatusBadge status={refund.status} />} />
          <DetailRow label="Reason" value={refund.reason || '—'} />
          <DetailRow
            label="Settlement"
            value={
              refund.settlementId ? (
                <Link href={`/sabpay/settlements/${refund.settlementId}`}>
                  <MonoSpan>{refund.settlementId}</MonoSpan>
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DetailRow label="Created" value={new Date(refund.createdAt).toLocaleString()} />
          {refund.processedAt ? (
            <DetailRow
              label="Processed"
              value={new Date(refund.processedAt).toLocaleString()}
            />
          ) : null}
        </CardBody>
      </Card>

      {refund.notes && Object.keys(refund.notes).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            {Object.entries(refund.notes).map(([k, v]) => (
              <DetailRow key={k} label={k} value={<MonoSpan>{String(v)}</MonoSpan>} />
            ))}
          </CardBody>
        </Card>
      ) : null}
    </SabpayPage>
  );
}
