import type { Metadata } from 'next';
import Link from 'next/link';

import '../[id]/checkout.css';

/**
 * SabPay hosted checkout — terminal error page. Customers land here only
 * when a PayU callback could not be matched to a payment (tampered hash,
 * unknown txnid, malformed body). There is nothing to retry from our
 * side; the customer goes back to the merchant.
 */

export const metadata: Metadata = {
  title: 'Payment error — SabPay',
  robots: { index: false, follow: false },
};

export default function CheckoutErrorPage() {
  return (
    <main className="sabpay-checkout sabpay-checkout--solo">
      <div className="sabpay-checkout__solo-card" role="alert">
        <span className="sabpay-checkout__status-icon sabpay-checkout__status-icon--failed" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
        <h1>We couldn't verify this payment</h1>
        <p>
          The payment response could not be validated, so nothing was charged
          on this attempt. Please return to the store you were paying and try
          again.
        </p>
        <p className="sabpay-checkout__solo-footer">
          If money was deducted it will be auto-refunded by the bank.{' '}
          <Link href="/">SabPay by SabNode</Link>
        </p>
      </div>
    </main>
  );
}
