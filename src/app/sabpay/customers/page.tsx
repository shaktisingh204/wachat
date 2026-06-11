import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayCustomers } from '../actions/customers';
import { CustomersClient } from './customers-client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function SabpayCustomersPage() {
  const [merchant, customers] = await Promise.all([
    getSabpaySettings(),
    getSabpayCustomers({ limit: PAGE_SIZE }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Customers' },
      ]}
      eyebrow={merchant.mode === 'live' ? 'Live' : 'Test'}
      title="Customers"
      description={`Every ${merchant.mode === 'live' ? 'live' : 'test'} customer created through your API keys or the dashboard.`}
      width="wide"
    >
      <CustomersClient
        initialCustomers={customers}
        mode={merchant.mode}
        pageSize={PAGE_SIZE}
      />
    </SabpayPage>
  );
}
