import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayInvoices } from '../actions/invoices';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export default async function SabpayInvoicesPage() {
  const [merchant, invoices] = await Promise.all([
    getSabpaySettings(),
    getSabpayInvoices({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Invoices' },
      ]}
      title="Invoices"
      description={`Bills you raise on customers in ${merchant.mode === 'live' ? 'live' : 'test'} mode — draft them, issue a payable link, and track payment.`}
      width="wide"
    >
      <InvoicesClient initialInvoices={invoices} mode={merchant.mode} />
    </SabpayPage>
  );
}
