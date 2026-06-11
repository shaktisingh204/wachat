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

import { SabpayPage } from '../_components/sabpay-page';
import { CodeBlock } from '../_components/code-block';
import { DocsNav } from './_components/docs-nav';

export const metadata = { title: 'SabPay — Getting started' };

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

const QUICKSTART_CURL = `# 1. Create an order (optional but recommended — it survives retried
#    payment attempts and gives you order.paid exactly once)
curl -s https://sabnode.com/api/sabpay/v1/orders \\
  -H "Authorization: Bearer $SABPAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 49900, "receipt": "ORD-7421" }'
# → { "id": "order_1b2c3d4e5f60718293a4b5c6", "status": "created", … }

# 2. Create the payment session
curl -s https://sabnode.com/api/sabpay/v1/payments \\
  -H "Authorization: Bearer $SABPAY_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ORD-7421-attempt-1" \\
  -d '{
    "amount": 49900,
    "description": "Pro plan — March",
    "order_id": "order_1b2c3d4e5f60718293a4b5c6",
    "customer": { "name": "Asha Verma", "email": "asha@example.com" },
    "success_url": "https://merchant.example.com/thanks",
    "cancel_url": "https://merchant.example.com/cart"
  }'
# → { "id": "pay_0a1b2c3d4e5f60718293a4b5", "status": "created",
#     "checkout_url": "https://sabnode.com/pay/pay_0a1b2c3d4e5f60718293a4b5", … }

# 3. Redirect the customer's browser to checkout_url. After payment they
#    land on your success_url / cancel_url with
#    ?sabpay_payment_id=pay_…&sabpay_status=succeeded|failed appended.

# 4. Confirm server-side before fulfilling (webhook preferred, or poll):
curl -s https://sabnode.com/api/sabpay/v1/payments/pay_0a1b2c3d4e5f60718293a4b5 \\
  -H "Authorization: Bearer $SABPAY_KEY"
# → { "status": "succeeded", "paid_at": "…", "provider_payment_id": "…", … }`;

export default function SabpayDocsGettingStartedPage(): React.JSX.Element {
  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Docs' },
      ]}
      eyebrow="Developers"
      title="Getting started"
      description="Authenticate with a secret key, create a payment, redirect to the hosted checkout, and confirm server-side."
      width="wide"
    >
      <DocsNav active="/sabpay/docs" />

      <Card>
        <CardHeader>
          <CardTitle>Base URL &amp; authentication</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              All endpoints live under <span style={mono}>https://sabnode.com/api/sabpay/v1</span>.
              Every request carries a secret key in the <span style={mono}>Authorization</span>{' '}
              header (<span style={mono}>x-api-key: sk_…</span> is accepted as a fallback):
            </P>
            <CodeBlock
              language="bash"
              code={`Authorization: Bearer sk_test_4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e`}
            />
            <Ul>
              <li>
                Keys are minted in{' '}
                <Link href="/sabpay/developers">SabPay → Developers</Link> and the full secret is
                shown <strong>once</strong> — only a SHA-256 hash and a display tail are stored.
              </li>
              <li>Revoked keys fail with <span style={mono}>401 invalid_api_key</span>.</li>
            </Ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test vs live — the key prefix decides the mode</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              There is no separate mode switch to get wrong: everything you create inherits the
              mode of the key that created it.
            </P>
            <Ul>
              <li>
                <span style={mono}>sk_test_…</span> — test data, simulator checkout (Simulate
                success / Simulate failure), no real money. Webhooks fire end-to-end.
              </li>
              <li>
                <span style={mono}>sk_live_…</span> — live data, PayU checkout, real money,
                T+2 settlements.
              </li>
              <li>
                A test key can never create a live charge, and a live key can never see test
                objects — fetching an id from the other mode returns <span style={mono}>404</span>.
              </li>
            </Ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Idempotency</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Mutating requests (POST) may send an <span style={mono}>Idempotency-Key</span> header
              (any string, ≤ 255 chars) so a network retry can&rsquo;t double-bill:
            </P>
            <CodeBlock language="bash" code={`Idempotency-Key: order-7421-attempt-1`} />
            <Ul>
              <li>
                The first request with a key runs normally and its response is stored. Replays of
                the same key + same body within <strong>24 hours</strong> return the stored
                response verbatim, without re-running the side effect.
              </li>
              <li>
                The same key with a <strong>different body</strong> →{' '}
                <span style={mono}>409 idempotency_key_reused</span>.
              </li>
              <li>A replay while the first request is still in flight → <span style={mono}>409</span>.</li>
            </Ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errors</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>All errors share one envelope:</P>
            <CodeBlock
              language="json"
              code={`{ "error": { "code": "invalid_request", "message": "amount must be an integer in paise, at least 100 (₹1)." } }`}
            />
            <Table>
              <THead>
                <Tr>
                  <Th>HTTP</Th>
                  <Th>code</Th>
                  <Th>When</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td>400</Td>
                  <Td style={mono}>invalid_json</Td>
                  <Td>Body is not JSON</Td>
                </Tr>
                <Tr>
                  <Td>400</Td>
                  <Td style={mono}>invalid_request</Td>
                  <Td>Validation failure (amount bounds, bad currency, unknown linked id, …)</Td>
                </Tr>
                <Tr>
                  <Td>401</Td>
                  <Td style={mono}>invalid_api_key</Td>
                  <Td>Missing / invalid / revoked key</Td>
                </Tr>
                <Tr>
                  <Td>404</Td>
                  <Td style={mono}>payment_not_found (etc.)</Td>
                  <Td>Unknown id, or an id from the other mode</Td>
                </Tr>
                <Tr>
                  <Td>409</Td>
                  <Td style={mono}>invalid_request</Td>
                  <Td>Conflicts (idempotency reuse, already-finished lifecycle, concurrent over-refund)</Td>
                </Tr>
                <Tr>
                  <Td>5xx</Td>
                  <Td style={mono}>server_error</Td>
                  <Td>Engine failure</Td>
                </Tr>
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagination</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>List endpoints are cursor-paginated, newest first — never numbered pages:</P>
            <Table>
              <THead>
                <Tr>
                  <Th>Param</Th>
                  <Th>Meaning</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td style={mono}>?limit=</Td>
                  <Td>Page size, clamped to 1–100 (payments default 25, entity lists default 50)</Td>
                </Tr>
                <Tr>
                  <Td style={mono}>?before=</Td>
                  <Td>
                    Cursor: the created_at of the last item of the previous page (ISO-8601 string).
                    Returns items strictly older.
                  </Td>
                </Tr>
                <Tr>
                  <Td style={mono}>?status=</Td>
                  <Td>Optional status filter (entities with a lifecycle)</Td>
                </Tr>
              </TBody>
            </Table>
            <CodeBlock
              language="bash"
              code={`curl -s "https://sabnode.com/api/sabpay/v1/payments?limit=25&before=2026-06-10T11:22:33.000Z" \\
  -H "Authorization: Bearer sk_test_…"`}
            />
            <P>Lists return:</P>
            <CodeBlock language="json" code={`{ "object": "list", "data": [ … ] }`} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quickstart — order → payment → checkout</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <P>
              Amounts are integer <strong>paise</strong> (₹499 → <span style={mono}>49900</span>),
              INR only, ₹1 minimum, ₹10,00,000 cap. Treat the redirect as UI-only — fulfil from the
              webhook (preferred) or a server-side fetch, never from the query params alone.
            </P>
            <CodeBlock language="bash" code={QUICKSTART_CURL} />
            <P>
              Next: the full endpoint catalog in the{' '}
              <Link href="/sabpay/docs/api">API reference</Link>, signed event delivery in{' '}
              <Link href="/sabpay/docs/webhooks">Webhooks</Link>, and every hosted payment surface
              in <Link href="/sabpay/docs/checkout">Checkout surfaces</Link>.
            </P>
          </div>
        </CardBody>
      </Card>
    </SabpayPage>
  );
}
