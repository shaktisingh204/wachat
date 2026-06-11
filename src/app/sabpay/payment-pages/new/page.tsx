import { PageBuilderClient } from '../../_components/page-builder-client';
import { SabpayPage } from '../../_components/sabpay-page';
import { getSabpaySettings } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function SabpayNewPaymentPagePage() {
  const merchant = await getSabpaySettings();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payment Pages', href: '/sabpay/payment-pages' },
        { label: 'New' },
      ]}
      eyebrow={merchant.mode === 'live' ? 'Live mode' : 'Test mode'}
      title="Create payment page"
      description="Build a hosted page that collects payments at a URL you share — no code needed."
      width="wide"
    >
      <PageBuilderClient mode={merchant.mode} />
    </SabpayPage>
  );
}
