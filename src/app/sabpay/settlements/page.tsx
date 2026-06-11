import { SabpayPage } from '../_components/sabpay-page';
import {
  getSabpaySettlements,
  getSabpaySettlementSummary,
} from '../actions/settlements';
import { SettlementsClient } from './settlements-client';

export const dynamic = 'force-dynamic';

export default async function SabpaySettlementsPage() {
  const [{ settlements }, summary] = await Promise.all([
    getSabpaySettlements({ limit: 50 }),
    getSabpaySettlementSummary(),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Settlements' },
      ]}
      eyebrow="Live"
      title="Settlements"
      description="Payouts of your captured live payments — gross volume minus fees, tax, refunds and dispute deductions."
      width="wide"
    >
      <SettlementsClient initialSettlements={settlements} summary={summary} />
    </SabpayPage>
  );
}
