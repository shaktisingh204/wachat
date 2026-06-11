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
import { SABPAY_WEBHOOK_EVENTS, type SabpayWebhookEvent } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { CodeBlock } from '../../_components/code-block';
import { DocsNav } from '../_components/docs-nav';

export const metadata = { title: 'SabPay — Webhooks' };

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

/** `payment_link.paid` → `data.paymentLink` (webhook payloads are camelCase). */
const DATA_KEY_BY_PREFIX: Record<string, string> = {
  payment: 'payment',
  order: 'order',
  refund: 'refund',
  payment_link: 'paymentLink',
  invoice: 'invoice',
  subscription: 'subscription',
  qr_code: 'qrCode',
  settlement: 'settlement',
  dispute: 'dispute',
};

function dataKeyFor(event: SabpayWebhookEvent): string {
  const prefix = event.slice(0, event.indexOf('.'));
  return DATA_KEY_BY_PREFIX[prefix] ?? prefix;
}

/** Typed over the full union so a new engine event forces a docs update. */
const EVENT_DESCRIPTIONS: Record<SabpayWebhookEvent, string> = {
  'payment.created': 'A checkout session was created via the API.',
  'payment.succeeded': 'The payment was confirmed (PayU in live, simulator in test). Fulfil here.',
  'payment.failed': 'The payment was declined, cancelled by the customer, or failed in the simulator.',
  'order.paid': 'A payment attached to the order succeeded — fires exactly once per order.',
  'refund.created': 'A refund was accepted (test refunds are instantly processed).',
  'refund.processed': 'The refund completed. Live refunds process with the nightly settlement run.',
  'payment_link.paid': 'The link’s checkout was paid; the link is now closed.',
  'payment_link.cancelled': 'An open (unpaid) link was cancelled.',
  'payment_link.expired': 'The expiry cron closed the link after expire_by passed.',
  'invoice.issued': 'The invoice was issued; its hosted-checkout short_url is live.',
  'invoice.paid': 'The invoice was paid (cycle invoices also fire subscription.charged).',
  'invoice.cancelled': 'An issued, unpaid invoice was cancelled.',
  'invoice.expired': 'The expiry cron expired the invoice after expire_by passed.',
  'subscription.activated': 'The subscription became active.',
  'subscription.pending': 'A cycle invoice is awaiting payment — send the customer its checkout link.',
  'subscription.charged': 'A cycle invoice was paid; paid_count incremented.',
  'subscription.paused': 'The subscription was paused via the API or dashboard.',
  'subscription.resumed': 'A paused subscription was resumed.',
  'subscription.halted': 'Three unpaid cycle invoices accumulated; billing is halted until one is paid.',
  'subscription.cancelled': 'The subscription was cancelled (immediately or at cycle end).',
  'subscription.completed': 'The final cycle was paid; the subscription is complete.',
  'qr_code.credited': 'A payment landed on the QR code (single_use codes auto-close).',
  'qr_code.closed': 'The QR code was closed — on demand, or automatically for single_use.',
  'settlement.processed': 'The daily payout was swept; the UTR is available.',
  'dispute.created': 'A chargeback was opened against a succeeded payment.',
  'dispute.under_review': 'Evidence was submitted; the dispute is under review.',
  'dispute.won': 'The dispute was resolved in your favour.',
  'dispute.lost': 'The dispute was lost (or accepted); the amount is deducted from settlement.',
};

const ENVELOPE_JSON = `{
  "id": "evt_c6d7e8f90a1b2c3d4e5f6071",
  "event": "payment.succeeded",
  "mode": "live",
  "timestamp": "2026-06-11T08:31:02.412Z",
  "data": {
    "payment": {
      "id": "pay_0a1b2c3d4e5f60718293a4b5",
      "status": "succeeded",
      "amount": 49900,
      "currency": "INR",
      "orderId": "order_1b2c3d4e5f60718293a4b5c6",
      "checkoutUrl": "https://sabnode.com/pay/pay_0a1b2c3d4e5f60718293a4b5",
      "paidAt": "2026-06-11T08:31:02.000Z"
    }
  }
}`;

const DELIVERY_HEADERS = `POST https://merchant.example.com/webhooks/sabpay
Content-Type: application/json
X-SabNode-Signature: sha256=2f1d0c…   ← HMAC-SHA256 of the RAW body, hex
X-SabNode-Event: payment.succeeded
X-SabNode-Delivery: 8d3b54a90c1e2f4b6a7d8e9f`;

const VERIFY_SNIPPET = `const crypto = require('node:crypto');
const express = require('express');

const app = express();

function verifySabpaySignature(rawBody, signatureHeader, secret) {
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// IMPORTANT: use the raw body — a re-serialized JSON.parse/stringify
// round-trip will NOT produce the same bytes that were signed.
app.post(
  '/webhooks/sabpay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const ok = verifySabpaySignature(
      req.body, // Buffer
      req.header('X-SabNode-Signature'),
      process.env.SABPAY_WEBHOOK_SECRET, // whsec_…
    );
    if (!ok) return res.status(400).send('invalid signature');

    const evt = JSON.parse(req.body);
    // Deduplicate on evt.id — retries and manual redeliveries reuse it.
    switch (evt.event) {
      case 'payment.succeeded':
        // fulfil evt.data.payment
        break;
      case 'payment.failed':
      case 'refund.processed':
      case 'order.paid':
        break;
    }
    res.status(200).send('ok'); // respond 2xx fast; do slow work async
  },
);`;

export default function SabpayDocsWebhooksPage(): React.JSX.Element {
  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Docs', href: '/sabpay/docs' },
        { label: 'Webhooks' },
      ]}
      eyebrow="Developers"
      title="Webhooks"
      description="Signed HTTP POSTs for every lifecycle event — the source of truth for fulfilment."
      width="wide"
    >
      <DocsNav active="/sabpay/docs/webhooks" />

      <Card>
        <CardHeader>
          <CardTitle>Delivery format</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Add an endpoint in <Link href="/sabpay/webhooks">SabPay → Webhooks</Link>, choose the
              events, and copy the signing secret (<span style={mono}>whsec_…</span>) — it is shown
              once and can be rotated. Every delivery is an HTTP POST:
            </P>
            <CodeBlock language="http" code={DELIVERY_HEADERS} />
            <P>
              The body is one envelope —{' '}
              <span style={mono}>{'{ id, event, mode, timestamp, data }'}</span>. Note that the
              nested object uses the engine&rsquo;s <strong>camelCase</strong> field names, unlike
              the snake_case REST responses:
            </P>
            <CodeBlock language="json" code={ENVELOPE_JSON} />
            <P>
              The <span style={mono}>data</span> key matches the object type:{' '}
              <span style={mono}>data.payment</span>, <span style={mono}>data.order</span>,{' '}
              <span style={mono}>data.refund</span>, <span style={mono}>data.paymentLink</span>,{' '}
              <span style={mono}>data.invoice</span>, <span style={mono}>data.subscription</span>,{' '}
              <span style={mono}>data.qrCode</span>, <span style={mono}>data.settlement</span>,{' '}
              <span style={mono}>data.dispute</span>. Mode is stamped on every envelope — ignore{' '}
              <span style={mono}>&quot;mode&quot;: &quot;test&quot;</span> events in your production
              handler if you point both modes at one URL.
            </P>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verifying the signature (Node.js)</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Compute HMAC-SHA256 of the <strong>raw, unparsed body</strong> with your endpoint
              secret and compare it (constant-time) to the{' '}
              <span style={mono}>X-SabNode-Signature</span> header, which is formatted{' '}
              <span style={mono}>sha256=&lt;hex&gt;</span>:
            </P>
            <CodeBlock language="js" code={VERIFY_SNIPPET} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retries &amp; redelivery</CardTitle>
        </CardHeader>
        <CardBody>
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
            <li>
              Up to <strong>5 attempts</strong> with exponential backoff (0.5 s → 8 s, capped 30 s)
              on connection errors and 408/429/5xx responses. Make handlers idempotent and dedupe
              on the envelope <span style={mono}>id</span>.
            </li>
            <li>Timeout is 15 s per attempt — return 2xx quickly and do slow work async.</li>
            <li>
              An endpoint auto-disables after <strong>10 consecutive failures</strong>; re-enable
              it in the dashboard (the failure counter resets).
            </li>
            <li>
              The <Link href="/sabpay/webhooks">Webhooks page</Link> shows the full delivery log
              and can <strong>redeliver</strong> any event — redeliveries reuse the original event{' '}
              <span style={mono}>id</span>, so your dedupe logic treats them as the same event.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event catalog</CardTitle>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Event</Th>
                <Th>Payload key</Th>
                <Th>Fires when</Th>
              </Tr>
            </THead>
            <TBody>
              {SABPAY_WEBHOOK_EVENTS.map((event) => (
                <Tr key={event}>
                  <Td style={{ ...mono, whiteSpace: 'nowrap' }}>{event}</Td>
                  <Td style={{ ...mono, whiteSpace: 'nowrap' }}>{`data.${dataKeyFor(event)}`}</Td>
                  <Td>{EVENT_DESCRIPTIONS[event]}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </SabpayPage>
  );
}
