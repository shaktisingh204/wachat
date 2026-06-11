import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayOrders } from '../actions/orders';
import { OrdersClient } from './orders-client';

export const dynamic = 'force-dynamic';

export default async function SabpayOrdersPage() {
  const [merchant, orders] = await Promise.all([
    getSabpaySettings(),
    getSabpayOrders({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Orders' },
      ]}
      title="Orders"
      description={`Every ${merchant.mode === 'live' ? 'live' : 'test'} order created through your API keys or the dashboard, with the payments collected against it.`}
      width="wide"
    >
      <OrdersClient initialOrders={orders} mode={merchant.mode} />
    </SabpayPage>
  );
}
