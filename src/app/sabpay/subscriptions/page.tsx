import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayCustomers } from '../actions/customers';
import { getSabpayPlans } from '../actions/plans';
import { getSabpaySubscriptions } from '../actions/subscriptions';
import { SubscriptionsClient } from './subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function SabpaySubscriptionsPage() {
  const [merchant, subscriptions, plans, customers] = await Promise.all([
    getSabpaySettings(),
    getSabpaySubscriptions({ limit: 50 }),
    getSabpayPlans({ limit: 100 }),
    getSabpayCustomers({ limit: 100 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Subscriptions' },
      ]}
      title="Subscriptions"
      description={`Recurring billing on your ${merchant.mode === 'live' ? 'live' : 'test'} plans — each cycle charges the customer automatically.`}
      width="wide"
    >
      <SubscriptionsClient
        initialSubscriptions={subscriptions}
        plans={plans}
        customers={customers}
        mode={merchant.mode}
      />
    </SabpayPage>
  );
}
