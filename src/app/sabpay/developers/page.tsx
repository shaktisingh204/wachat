import { SabpayPage } from '../_components/sabpay-page';
import { getSabpayKeys } from '../actions';
import { sabpayAppUrl } from '@/lib/sabpay/db.server';
import { DevelopersClient } from './developers-client';

export const dynamic = 'force-dynamic';

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
      <DevelopersClient initialKeys={keys} apiBase={`${sabpayAppUrl()}/api/sabpay/v1`} />
    </SabpayPage>
  );
}
