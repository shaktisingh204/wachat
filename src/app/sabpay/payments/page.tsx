import { SabpayPage } from '../_components/sabpay-page';
import { getSabpayPayments, getSabpayStats } from '../actions';
import { PaymentsClient } from './payments-client';

export const dynamic = 'force-dynamic';

export default async function SabpayPaymentsPage() {
  const [{ merchant, payments }, stats] = await Promise.all([
    getSabpayPayments({ limit: 50 }),
    getSabpayStats(),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payments' },
      ]}
      title="Payments"
      description={`Every ${merchant.mode === 'live' ? 'live' : 'test'} payment created through your API keys or the dashboard.`}
      width="wide"
    >
      <PaymentsClient initialPayments={payments} mode={merchant.mode} stats={stats} />
    </SabpayPage>
  );
}
