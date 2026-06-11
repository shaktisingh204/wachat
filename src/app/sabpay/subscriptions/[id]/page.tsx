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
import { getSabpayCustomerDetail } from '../../actions/customers';
import { getSabpayPlanDetail } from '../../actions/plans';
import { getSabpaySubscriptionDetail } from '../../actions/subscriptions';
import { formatPlanInterval } from '../../plans/format-interval';
import { SubscriptionActions } from './subscription-actions';

export const dynamic = 'force-dynamic';

export default async function SabpaySubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscription = await getSabpaySubscriptionDetail(id);
  if (!subscription) notFound();

  const [plan, customer] = await Promise.all([
    getSabpayPlanDetail(subscription.planId),
    subscription.customerId
      ? getSabpayCustomerDetail(subscription.customerId)
      : Promise.resolve(null),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Subscriptions', href: '/sabpay/subscriptions' },
        { label: subscription.id },
      ]}
      eyebrow={subscription.mode === 'live' ? 'Live subscription' : 'Test subscription'}
      title={
        plan
          ? `${formatSabpayAmount(plan.amount, plan.currency)} ${formatPlanInterval(plan.interval, plan.intervalCount)}`
          : subscription.id
      }
      description={
        plan
          ? `${plan.name} — ${subscription.paidCount} of ${subscription.totalCount} cycles charged.`
          : `${subscription.paidCount} of ${subscription.totalCount} cycles charged.`
      }
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <EntityStatusBadge status={subscription.status} />
          <SubscriptionActions subscription={subscription} />
        </div>
      }
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Subscription ID" value={<CopyableId value={subscription.id} />} />
          <DetailRow label="Status" value={<EntityStatusBadge status={subscription.status} />} />
          <DetailRow label="Total cycles" value={subscription.totalCount} />
          <DetailRow label="Cycles charged" value={subscription.paidCount} />
          {subscription.missedCycles > 0 ? (
            <DetailRow label="Missed cycles" value={subscription.missedCycles} />
          ) : null}
          <DetailRow
            label="Next charge"
            value={
              subscription.nextChargeAt
                ? new Date(subscription.nextChargeAt).toLocaleString()
                : '—'
            }
          />
          {subscription.cancelAtCycleEnd ? (
            <DetailRow label="Cancel at cycle end" value="Yes — ends after the current cycle" />
          ) : null}
          <DetailRow label="Created" value={new Date(subscription.createdAt).toLocaleString()} />
          {subscription.pausedAt ? (
            <DetailRow label="Paused" value={new Date(subscription.pausedAt).toLocaleString()} />
          ) : null}
          {subscription.cancelledAt ? (
            <DetailRow label="Cancelled" value={new Date(subscription.cancelledAt).toLocaleString()} />
          ) : null}
          {subscription.endedAt ? (
            <DetailRow label="Ended" value={new Date(subscription.endedAt).toLocaleString()} />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Plan ID"
            value={
              <Link href={`/sabpay/plans/${subscription.planId}`}>
                <MonoSpan>{subscription.planId}</MonoSpan>
              </Link>
            }
          />
          {plan ? (
            <>
              <DetailRow label="Name" value={plan.name} />
              <DetailRow
                label="Amount"
                value={`${formatSabpayAmount(plan.amount, plan.currency)} ${formatPlanInterval(plan.interval, plan.intervalCount)}`}
              />
              {plan.description ? (
                <DetailRow label="Description" value={plan.description} />
              ) : null}
            </>
          ) : (
            <DetailRow label="Name" value="Plan no longer available" />
          )}
        </CardBody>
      </Card>

      {subscription.customerId ? (
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardBody>
            <DetailRow
              label="Customer ID"
              value={
                <Link href={`/sabpay/customers/${subscription.customerId}`}>
                  <MonoSpan>{subscription.customerId}</MonoSpan>
                </Link>
              }
            />
            {customer ? (
              <>
                <DetailRow label="Name" value={customer.name} />
                <DetailRow label="Email" value={customer.email || '—'} />
                <DetailRow label="Phone" value={customer.contact || '—'} />
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
        Each billing cycle issues a subscription-cycle invoice and charges it as a
        payment, both carrying this subscription&apos;s id — find them under{' '}
        <Link href="/sabpay/invoices">Invoices</Link> and{' '}
        <Link href="/sabpay/payments">Payments</Link>.
      </p>
    </SabpayPage>
  );
}
