import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayPlans } from '../actions/plans';
import { PlansClient } from './plans-client';

export const dynamic = 'force-dynamic';

export default async function SabpayPlansPage() {
  const [merchant, plans] = await Promise.all([
    getSabpaySettings(),
    getSabpayPlans({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Plans' },
      ]}
      title="Plans"
      description={`Reusable billing templates for ${merchant.mode === 'live' ? 'live' : 'test'} subscriptions — amount and interval are fixed once created.`}
      width="wide"
    >
      <PlansClient initialPlans={plans} mode={merchant.mode} />
    </SabpayPage>
  );
}
