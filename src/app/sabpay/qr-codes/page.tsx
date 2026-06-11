import { SabpayPage } from '../_components/sabpay-page';
import { getSabpaySettings } from '../actions';
import { getSabpayQrCodes } from '../actions/qr-codes';
import { QrCodesClient } from './qr-codes-client';

export const dynamic = 'force-dynamic';

export default async function SabpayQrCodesPage() {
  const [merchant, qrCodes] = await Promise.all([
    getSabpaySettings(),
    getSabpayQrCodes({ limit: 50 }),
  ]);

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'QR codes' },
      ]}
      title="QR codes"
      description={`Printable ${merchant.mode === 'live' ? 'live' : 'test'} collect codes — customers scan to pay a fixed or open amount.`}
      width="wide"
    >
      <QrCodesClient initialQrCodes={qrCodes} mode={merchant.mode} />
    </SabpayPage>
  );
}
