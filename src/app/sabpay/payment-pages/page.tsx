import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayPaymentPages } from '../actions/payment-pages';
import { PaymentPagesClient } from './payment-pages-client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function SabpayPaymentPagesPage() {
  const [merchant, pages] = await Promise.all([
    getSabpaySettings(),
    getSabpayPaymentPages({ limit: PAGE_SIZE }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payment Pages' },
      ]}
      eyebrow={merchant.mode === 'live' ? 'Live mode' : 'Test mode'}
      title="Payment Pages"
      description={`No-code hosted pages that collect ${
        merchant.mode === 'live' ? 'live' : 'test'
      } payments at a URL you share — no checkout integration needed.`}
      width="wide"
    >
      <PaymentPagesClient initialPages={pages} mode={merchant.mode} pageSize={PAGE_SIZE} />
    </SabpayPage>
  );
}
