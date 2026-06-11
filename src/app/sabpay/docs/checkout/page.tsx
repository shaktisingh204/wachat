import * as React from 'react';
import Link from 'next/link';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';

import { SabpayPage } from '../../_components/sabpay-page';
import { CodeBlock } from '../../_components/code-block';
import { DocsNav } from '../_components/docs-nav';

export const metadata = { title: 'SabPay — Checkout surfaces' };

const mono: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono, monospace)',
  fontSize: 12.5,
};

function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--st-text-muted)' }}>
      {children}
    </p>
  );
}

function Ul({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--st-text-muted)',
      }}
    >
      {children}
    </ul>
  );
}

interface CheckoutSurface {
  surface: string;
  urlShape: string;
  createdFrom: string;
  paidEvents: string;
}

const SURFACES: CheckoutSurface[] = [
  {
    surface: 'Hosted checkout',
    urlShape: '/pay/pay_…',
    createdFrom: 'POST /v1/payments → checkout_url',
    paidEvents: 'payment.succeeded',
  },
  {
    surface: 'Payment link',
    urlShape: '/pay/plink_…',
    createdFrom: 'POST /v1/payment-links → short_url',
    paidEvents: 'payment_link.paid + payment.succeeded',
  },
  {
    surface: 'Payment page',
    urlShape: '/pay/<slug>',
    createdFrom: 'POST /v1/payment-pages → url',
    paidEvents: 'payment.succeeded (with payment_page_id)',
  },
  {
    surface: 'Invoice',
    urlShape: '/pay/inv_…',
    createdFrom: 'POST /v1/invoices/{id}/issue → short_url',
    paidEvents: 'invoice.paid + payment.succeeded',
  },
  {
    surface: 'QR code',
    urlShape: '/pay/qr_…',
    createdFrom: 'POST /v1/qr-codes → payload_url',
    paidEvents: 'qr_code.credited + payment.succeeded',
  },
];

const REDIRECT_EXAMPLE = `https://merchant.example.com/thanks?sabpay_payment_id=pay_0a1b2c3d4e5f60718293a4b5&sabpay_status=succeeded`;

export default function SabpayDocsCheckoutPage(): React.JSX.Element {
  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Docs', href: '/sabpay/docs' },
        { label: 'Checkout surfaces' },
      ]}
      eyebrow="Developers"
      title="Checkout surfaces"
      description="Every public collect-money URL SabPay publishes, and how customers come back to you."
      width="wide"
    >
      <DocsNav active="/sabpay/docs/checkout" />

      <Card>
        <CardHeader>
          <CardTitle>One URL family: /pay/…</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Every public, unauthenticated payment URL lives at{' '}
              <span style={mono}>https://sabnode.com/pay/&lt;segment&gt;</span>. The unguessable id
              is the only credential a payer needs — no SDK, no iframe, no API key in the browser.
              Links, pages, QR codes, and invoices never collect money themselves: each one
              resolves or creates a regular <span style={mono}>pay_…</span> session and hands off
              to the hosted checkout, so your <span style={mono}>payment.succeeded</span> handler
              works unchanged for every surface.
            </P>
            <Table>
              <THead>
                <Tr>
                  <Th>Surface</Th>
                  <Th>URL shape</Th>
                  <Th>Created from</Th>
                  <Th>Webhooks on payment</Th>
                </Tr>
              </THead>
              <TBody>
                {SURFACES.map((s) => (
                  <Tr key={s.surface}>
                    <Td style={{ fontWeight: 600 }}>{s.surface}</Td>
                    <Td style={{ ...mono, whiteSpace: 'nowrap' }}>{s.urlShape}</Td>
                    <Td style={mono}>{s.createdFrom}</Td>
                    <Td style={mono}>{s.paidEvents}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hosted checkout — /pay/pay_…</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              The page every payment funnels into. It renders with your business name, logo, and
              brand color (set in <Link href="/sabpay/settings">Settings</Link>):
            </P>
            <Ul>
              <li>
                <strong>Live</strong> — the customer enters name/email/phone, SabPay builds a
                SHA-512-signed PayU form and the browser auto-submits to PayU. PayU posts back to
                SabPay&rsquo;s callback, which verifies the reverse hash and finalizes the payment
                exactly once.
              </li>
              <li>
                <strong>Test</strong> — a simulator replaces PayU: the checkout offers{' '}
                <em>Simulate success</em> / <em>Simulate failure</em> so you can exercise both
                paths end-to-end, webhooks included.
              </li>
            </Ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment links — /pay/plink_…</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              A shareable, fixed-amount request — share <span style={mono}>short_url</span> over
              WhatsApp or email. Opening it resolves a payment session linked back to the link
              (an already-paid link returns its existing payment) and redirects to the hosted
              checkout. Lifecycle: <span style={mono}>created → paid | cancelled | expired</span> —
              cancelled or expired links render a closed state, and the expiry cron fires{' '}
              <span style={mono}>payment_link.expired</span> past{' '}
              <span style={mono}>expire_by</span>.
            </P>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment pages — /pay/&lt;slug&gt;</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              A no-code hosted form at a human slug (
              <span style={mono}>{'^[a-z0-9-]{3,60}$'}</span>, globally unique, immutable after
              create). The amount is <span style={mono}>fixed</span> or{' '}
              <span style={mono}>customer_decided</span> (with an optional minimum), plus up to 10
              custom fields. Each submission becomes a normal payment linked via{' '}
              <span style={mono}>payment_page_id</span>, with the field values stored in its{' '}
              <span style={mono}>metadata</span>. Brand it with a{' '}
              <span style={mono}>branding_image_url</span> — picked from SabFiles in the dashboard.
            </P>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices — /pay/inv_…</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Issuing an invoice spins up a hosted-checkout session and stamps{' '}
              <span style={mono}>short_url</span>. The <span style={mono}>inv_…</span> URL renders
              the payable view — line items, customer snapshot, status — with a <em>Pay</em> action
              that follows the linked payment session. Paid, cancelled, or expired invoices render
              their terminal state instead.
            </P>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR codes — /pay/qr_…</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              A stable collect code (<span style={mono}>payload_url</span>) you can print or embed.
              Fixed-amount codes show the amount; open codes prompt the payer to enter one. Paying
              creates a session linked via <span style={mono}>qr_code_id</span>;{' '}
              <span style={mono}>single_use</span> codes auto-close on the first successful
              payment, <span style={mono}>multiple_use</span> codes accumulate until you close them
              (<span style={mono}>POST /v1/qr-codes/{'{id}'}/close</span>).
            </P>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The redirect back: sabpay_payment_id + sabpay_status</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              After the payment finishes, the customer is 303-redirected to your{' '}
              <span style={mono}>success_url</span> (on success) or{' '}
              <span style={mono}>cancel_url</span> (on failure) with two query params appended — if
              you omit them, the customer lands on SabPay&rsquo;s hosted receipt instead:
            </P>
            <CodeBlock language="text" code={REDIRECT_EXAMPLE} />
            <Table>
              <THead>
                <Tr>
                  <Th>Param</Th>
                  <Th>Values</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td style={mono}>sabpay_payment_id</Td>
                  <Td>
                    The <span style={mono}>pay_…</span> id
                  </Td>
                </Tr>
                <Tr>
                  <Td style={mono}>sabpay_status</Td>
                  <Td>
                    <span style={mono}>succeeded</span> or <span style={mono}>failed</span>
                  </Td>
                </Tr>
              </TBody>
            </Table>
            <P>
              <strong>Treat the redirect as UI-only.</strong> Browsers can be closed mid-redirect
              and query strings can be replayed. Confirm server-side before fulfilling — by{' '}
              <Link href="/sabpay/docs/webhooks">webhook</Link> (preferred) or by polling{' '}
              <span style={mono}>GET /v1/payments/{'{id}'}</span>.
            </P>
          </div>
        </CardBody>
      </Card>
    </SabpayPage>
  );
}
