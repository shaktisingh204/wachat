import { SabpayPage } from '../_components/sabpay-page';
import { getSabpayKeys } from '../actions';
import { DevelopersClient } from './developers-client';

export const dynamic = 'force-dynamic';

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
).replace(/\/$/, '');

export default async function SabpayDevelopersPage() {
  const keys = await getSabpayKeys();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Developers' },
      ]}
      title="Developers"
      description="Secret keys, the payments API, and everything you need to take SabPay live on your site or app."
    >
      <DevelopersClient initialKeys={keys} apiBase={`${APP_URL}/api/sabpay/v1`} />
    </SabpayPage>
  );
}
