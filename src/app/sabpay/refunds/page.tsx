import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayRefunds } from '../actions/refunds';
import { RefundsClient } from './refunds-client';

export const dynamic = 'force-dynamic';

export default async function SabpayRefundsPage() {
  const [merchant, refunds] = await Promise.all([
    getSabpaySettings(),
    getSabpayRefunds({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Refunds' },
      ]}
      title="Refunds"
      description={`Every ${merchant.mode === 'live' ? 'live' : 'test'} refund issued against your payments. Refunds are created from a payment's detail page.`}
      width="wide"
    >
      <RefundsClient initialRefunds={refunds} mode={merchant.mode} />
    </SabpayPage>
  );
}
