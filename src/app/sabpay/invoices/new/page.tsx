import { SabpayPage } from '../../_components/sabpay-page';
import { InvoiceEditorClient } from '../../_components/invoice-editor-client';
import { getSabpaySettings } from '../../actions';
import { getSabpayCustomers } from '../../actions/customers';

export const dynamic = 'force-dynamic';

export default async function SabpayNewInvoicePage() {
  const [merchant, customers] = await Promise.all([
    getSabpaySettings(),
    getSabpayCustomers({ limit: 100 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Invoices', href: '/sabpay/invoices' },
        { label: 'New invoice' },
      ]}
      eyebrow={merchant.mode === 'live' ? 'Live invoice' : 'Test invoice'}
      title="New invoice"
      description="Bill a customer with line items — save it as a draft, or issue it right away to get a payable link."
      width="narrow"
    >
      <InvoiceEditorClient mode={merchant.mode} customers={customers} />
    </SabpayPage>
  );
}
