import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { PageBuilderClient } from '../../_components/page-builder-client';
import { SabpayPage } from '../../_components/sabpay-page';
import { getSabpayPaymentPageDetail } from '../../actions/payment-pages';

export const dynamic = 'force-dynamic';

export default async function SabpayPaymentPageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await getSabpayPaymentPageDetail(id);
  if (!page) notFound();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payment Pages', href: '/sabpay/payment-pages' },
        { label: page.title },
      ]}
      eyebrow={page.mode === 'live' ? 'Live payment page' : 'Test payment page'}
      title={page.title}
      description={page.description}
      actions={<EntityStatusBadge status={page.active ? 'active' : 'deactivated'} />}
      width="wide"
    >
      <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
        Payments collected through this page appear in{' '}
        <Link href="/sabpay/payments">Payments</Link> like any other payment.
      </p>
      <PageBuilderClient initial={page} mode={page.mode} />
    </SabpayPage>
  );
}
