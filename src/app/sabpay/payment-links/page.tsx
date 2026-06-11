import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayPaymentLinks } from '../actions/payment-links';
import { PaymentLinksClient } from './payment-links-client';

export const dynamic = 'force-dynamic';

export default async function SabpayPaymentLinksPage() {
  const [merchant, paymentLinks] = await Promise.all([
    getSabpaySettings(),
    getSabpayPaymentLinks({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Payment links' },
      ]}
      title="Payment links"
      description={`Shareable ${merchant.mode === 'live' ? 'live' : 'test'} checkout links — send one over WhatsApp, email or SMS and get paid without writing code.`}
      width="wide"
    >
      <PaymentLinksClient initialLinks={paymentLinks} mode={merchant.mode} />
    </SabpayPage>
  );
}
