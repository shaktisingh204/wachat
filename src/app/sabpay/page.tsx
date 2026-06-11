import { SabpayPage } from './_components/sabpay-page';
import { OverviewClient } from './_components/overview-client';
import { getSabpayOverview } from './actions';

export const dynamic = 'force-dynamic';

export default async function SabpayOverviewPage() {
  const data = await getSabpayOverview();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay' },
      ]}
      title="Overview"
      description="Accept payments on any website or app through SabNode's PayU rail."
      width="wide"
    >
      <OverviewClient data={data} />
    </SabpayPage>
  );
}
