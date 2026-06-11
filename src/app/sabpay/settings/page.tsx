import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SabpaySettingsPage() {
  const merchant = await getSabpaySettings();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Settings' },
      ]}
      title="Settings"
      description="Branding for your hosted checkout, and the test/live mode switch."
      width="narrow"
    >
      <SettingsClient initialMerchant={merchant} />
    </SabpayPage>
  );
}
