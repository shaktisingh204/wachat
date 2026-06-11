import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayDisputes } from '../actions/disputes';
import { DisputesClient } from './disputes-client';

export const dynamic = 'force-dynamic';

export default async function SabpayDisputesPage() {
  const [{ disputes }, merchant] = await Promise.all([
    getSabpayDisputes({ limit: 50 }),
    getSabpaySettings(),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Disputes' },
      ]}
      eyebrow={merchant.mode === 'live' ? 'Live' : 'Test'}
      title="Disputes"
      description="Chargebacks raised against your payments — respond with evidence before the deadline or the funds are forfeited."
      width="wide"
    >
      <DisputesClient initialDisputes={disputes} mode={merchant.mode} />
    </SabpayPage>
  );
}
