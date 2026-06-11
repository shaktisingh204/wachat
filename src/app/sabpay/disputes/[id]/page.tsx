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
import { getSabpayDisputeDetail } from '../../actions/disputes';
import { DisputeDetailClient } from './dispute-detail-client';

export const dynamic = 'force-dynamic';

const mono = { fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 } as const;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default async function SabpayDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dispute = await getSabpayDisputeDetail(id);
  if (!dispute) notFound();

  const resolved = dispute.status === 'won' || dispute.status === 'lost';
  const urgent =
    !resolved &&
    new Date(dispute.respondBy).getTime() - Date.now() <= THREE_DAYS_MS;

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Disputes', href: '/sabpay/disputes' },
        { label: dispute.id },
      ]}
      eyebrow={dispute.mode === 'live' ? 'Live dispute' : 'Test dispute'}
      title={formatSabpayAmount(dispute.amount, dispute.currency)}
      description={`Chargeback (${dispute.reasonCode}) on payment ${dispute.paymentId}.`}
      actions={<EntityStatusBadge status={dispute.status} />}
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Dispute</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Dispute ID"
            value={<CopyableId value={dispute.id} />}
          />
          <DetailRow
            label="Payment"
            value={
              <Link href={`/sabpay/payments/${dispute.paymentId}`} style={mono}>
                {dispute.paymentId}
              </Link>
            }
          />
          <DetailRow
            label="Amount"
            value={
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatSabpayAmount(dispute.amount, dispute.currency)}
              </span>
            }
          />
          <DetailRow
            label="Reason code"
            value={<MonoSpan>{dispute.reasonCode}</MonoSpan>}
          />
          <DetailRow label="Phase" value={dispute.phase} />
          <DetailRow
            label="Status"
            value={<EntityStatusBadge status={dispute.status} />}
          />
          <DetailRow
            label="Respond by"
            value={
              <span
                style={
                  urgent
                    ? { color: 'var(--st-danger)', fontWeight: 600 }
                    : undefined
                }
              >
                {new Date(dispute.respondBy).toLocaleString()}
                {urgent ? ' — respond soon' : ''}
              </span>
            }
          />
          <DetailRow
            label="Created"
            value={new Date(dispute.createdAt).toLocaleString()}
          />
          {dispute.evidenceSubmittedAt ? (
            <DetailRow
              label="Evidence submitted"
              value={new Date(dispute.evidenceSubmittedAt).toLocaleString()}
            />
          ) : null}
          {dispute.resolvedAt ? (
            <DetailRow
              label="Resolved"
              value={new Date(dispute.resolvedAt).toLocaleString()}
            />
          ) : null}
        </CardBody>
      </Card>

      {resolved && dispute.evidence ? (
        <Card>
          <CardHeader>
            <CardTitle>Submitted evidence</CardTitle>
          </CardHeader>
          <CardBody>
            <DetailRow label="Summary" value={dispute.evidence.summary} />
            <DetailRow
              label="Documents"
              value={
                dispute.evidence.fileUrls.length === 0 ? (
                  '—'
                ) : (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dispute.evidence.fileUrls.map((url) => (
                      <Link key={url} href={url} target="_blank" style={mono}>
                        {url}
                      </Link>
                    ))}
                  </span>
                )
              }
            />
          </CardBody>
        </Card>
      ) : null}

      {!resolved ? <DisputeDetailClient dispute={dispute} /> : null}
    </SabpayPage>
  );
}
