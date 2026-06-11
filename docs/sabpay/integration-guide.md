# SabPay — Integration Guide

The merchant's journey from zero to a verified live payment. Endpoint shapes
are documented in `docs/sabpay/api-reference.md`; the system map is in
`docs/sabpay/architecture.md`.

The flow you are building:

```
your server ── POST /v1/payments ──► SabPay ──► checkout_url
your site  ── redirect customer ───► https://sabnode.com/pay/pay_…
customer pays (PayU live / simulator test)
SabPay ── 303 redirect ──► your success_url?sabpay_payment_id=…&sabpay_status=…
SabPay ── signed webhook ──► your endpoint   (the source of truth)
your server ── GET /v1/payments/{id} ──► confirm server-side
```

---

## 1. Create an API key

Dashboard → **SabPay → Developers** → *Create key*. Pick the mode:

- `sk_test_…` — test data, simulator checkout, no real money.
- `sk_live_…` — live data, PayU checkout, real money.

The full secret is shown **once** (the dashboard stores only a SHA-256 hash and
a `sk_test_…abcd` display tail). Store it in your server's secret manager and
send it as `Authorization: Bearer sk_…`. The key prefix decides the mode of
everything you create — there is no separate "mode" switch to get wrong.

## 2. Create an order, then a payment

An order is optional but recommended: it survives retried payment attempts and
gives you `order.paid` exactly once.

```bash
curl -s https://sabnode.com/api/sabpay/v1/orders \
  -H "Authorization: Bearer $SABPAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 49900, "receipt": "ORD-7421" }'
# → { "id": "order_1b2c3d4e5f60718293a4b5c6", "status": "created", … }

curl -s https://sabnode.com/api/sabpay/v1/payments \
  -H "Authorization: Bearer $SABPAY_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ORD-7421-attempt-1" \
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
```

Amounts are integer **paise** (₹499 → `49900`), `INR` only, ₹1 min, ₹10,00,000
cap. Send an `Idempotency-Key` on creates so a network retry can't double-bill.

## 3. Redirect the customer to the hosted checkout

Send the customer's browser to `checkout_url`. SabPay renders the hosted
checkout with your business name, logo, and brand color (Settings page):

- **Live**: the customer enters name/email/phone, SabPay builds a
  SHA-512-signed PayU form and the browser auto-submits to PayU; PayU posts
  back to SabPay's callback, which verifies the reverse hash and finalizes the
  payment exactly once.
- **Test**: a simulator replaces PayU — the checkout offers *Simulate success*
  / *Simulate failure* so you can exercise both paths end-to-end (webhooks
  included).

No SDK or iframe is required; the unguessable `pay_…` id is the only
credential the checkout needs.

## 4. Handle the redirect back

After the payment finishes, the customer is 303-redirected to your
`success_url` (on success) or `cancel_url` (on failure) with two query params
appended:

```
https://merchant.example.com/thanks?sabpay_payment_id=pay_0a1b2c3d4e5f60718293a4b5&sabpay_status=succeeded
```

| Param | Values |
| ----- | ------ |
| `sabpay_payment_id` | The `pay_…` id |
| `sabpay_status` | `succeeded` or `failed` |

**Treat the redirect as UI-only.** Browsers can be closed mid-redirect and
query strings can be replayed. Confirm server-side before fulfilling, either by
the webhook (preferred) or by polling:

```bash
curl -s https://sabnode.com/api/sabpay/v1/payments/pay_0a1b2c3d4e5f60718293a4b5 \
  -H "Authorization: Bearer $SABPAY_KEY"
# → { "status": "succeeded", "paid_at": "…", "provider_payment_id": "…", … }
```

If you omit `success_url`/`cancel_url`, the customer lands on SabPay's hosted
receipt instead.

## 5. Receive and verify webhooks

Dashboard → **SabPay → Webhooks** → *Add endpoint*. Choose the events (e.g.
`payment.succeeded`, `payment.failed`, `order.paid`, `refund.processed`) and
copy the signing secret (`whsec_…`) — it is shown once and can be rotated.

Every delivery is an HTTP POST:

```
POST https://merchant.example.com/webhooks/sabpay
Content-Type: application/json
X-SabNode-Signature: sha256=2f1d0c…   ← HMAC-SHA256 of the RAW body, hex
X-SabNode-Event: payment.succeeded
X-SabNode-Delivery: 8d3b54a90c1e2f4b6a7d8e9f
```

Body envelope (note: the nested object uses the engine's **camelCase** field
names, unlike the snake_case REST responses):

```json
{
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
}
```

The `data` key matches the object type: `data.payment`, `data.order`,
`data.refund`, `data.paymentLink`, `data.invoice`, `data.subscription`,
`data.qrCode`, `data.settlement`, `data.dispute`.

### Verification (Node.js)

Compute HMAC-SHA256 of the **raw, unparsed body** with your endpoint secret and
compare it (constant-time) to the `X-SabNode-Signature` header, which is
formatted `sha256=<hex>`:

```js
const crypto = require('node:crypto');
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
);
```

Delivery semantics to design for:

- Retries: up to **5 attempts** with exponential backoff (0.5 s → 8 s, capped
  30 s) on connection errors and 408/429/5xx. Make handlers idempotent and
  dedupe on the envelope `id`.
- Timeout: 15 s per attempt — return 2xx quickly.
- An endpoint auto-disables after **10 consecutive failures** (re-enable in the
  dashboard; the failure counter resets).
- Mode is stamped on every envelope — ignore `"mode": "test"` events in your
  production handler if you point both modes at one URL.
- The dashboard's Webhooks page shows the full delivery log and can redeliver
  any event.

## 6. Issue a refund

```bash
curl -s https://sabnode.com/api/sabpay/v1/payments/pay_0a1b2c3d4e5f60718293a4b5/refunds \
  -H "Authorization: Bearer $SABPAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 10000, "reason": "requested_by_customer" }'
```

- Omit `amount` to refund the full remaining amount. Partial refunds may be
  repeated until the payment is fully refunded; concurrent over-refunds are
  rejected atomically.
- Test refunds are instantly `processed` (you get `refund.created` +
  `refund.processed`). Live refunds start `pending` and are `processed` by the
  nightly settlement run, deducted from your next payout.
- The payment's `amount_refunded` and `refund_status` (`partial`/`full`) update
  immediately.

---

## Recipes

### Payment link (no code on your site)

```bash
curl -s https://sabnode.com/api/sabpay/v1/payment-links \
  -H "Authorization: Bearer $SABPAY_KEY" -H "Content-Type: application/json" \
  -d '{ "amount": 150000, "description": "Invoice #88 balance", "expire_by": "2026-06-30T23:59:59.000Z" }'
```

Share `short_url` (`https://sabnode.com/pay/plink_…`) over WhatsApp/email. When
the payer completes checkout you receive `payment_link.paid` (plus the
underlying `payment.succeeded`). Cancel an unpaid link with
`POST /v1/payment-links/{id}/cancel`; the expiry cron fires
`payment_link.expired` past `expire_by`.

### Payment page (no-code form)

Create a page with a globally-unique slug, a `fixed` or `customer_decided`
amount, and up to 10 custom fields. Publish
`https://sabnode.com/pay/<slug>`. Each submission becomes a normal payment with
the field values in its `metadata`, linked via `payment_page_id` — so your
`payment.succeeded` handler works unchanged. Brand it with a
`branding_image_url` (in the dashboard this is picked from SabFiles).

### Subscriptions (invoice-based recurring)

```bash
# 1. plan (immutable template)
curl -s …/v1/plans -d '{ "name": "Pro monthly", "amount": 49900, "interval": "monthly" }' …
# 2. subscription
curl -s …/v1/subscriptions -d '{ "plan_id": "plan_…", "customer_id": "cust_…", "total_count": 12 }' …
```

How billing actually works — **live subscriptions generate a payable cycle
invoice each period; there is no card auto-debit rail**:

1. When `next_charge_at` arrives, the subscription cron creates a
   `subscription_cycle` invoice with a hosted checkout link (`short_url`).
2. Live mode fires `subscription.pending` — send the customer the link (the
   invoice also carries their snapshot). Test mode auto-pays the cycle so you
   can watch the full lifecycle.
3. Payment of the invoice fires `invoice.paid` + `subscription.charged`
   (`paid_count` increments); after the final cycle, `subscription.completed`.
4. Three unpaid cycle invoices → `subscription.halted`. A payment on any
   outstanding invoice reactivates (`status` back to `active`,
   `missed_cycles` reset).
5. Manage with `/pause`, `/resume`, `/cancel` (`?at_cycle_end=1` to finish the
   running cycle first).

Subscribe to `subscription.pending` + `subscription.charged` +
`subscription.halted` at minimum.

---

## Go-live checklist

1. **Switch the key**: mint an `sk_live_…` key in Developers and deploy it in
   place of `sk_test_…`. (Optionally flip the dashboard's merchant mode to
   `live` in Settings so dashboard lists show live data.)
2. **Webhook endpoint**: add your production URL, subscribe the events you
   handle, store the new `whsec_…` secret, and verify a test delivery
   end-to-end before launch.
3. **PayU platform credentials** (engine environment): `PAYU_MERCHANT_KEY`,
   `PAYU_MERCHANT_SALT`, and `PAYU_MODE=production`. Without them, live
   checkouts return "Payments are temporarily unavailable" — test mode is
   unaffected.
4. **`CRON_SECRET`** must be set (shared by the Next.js cron proxies and the
   Rust runners) so the settlement / subscription-cycle / expiry crons run:
   `/api/cron/sabpay-settlements` (daily 01:30), `/api/cron/sabpay-subscriptions`
   (daily 03:00), `/api/cron/sabpay-expiries` (every 30 min). The runners are
   dry-run unless invoked with `?execute=1`. Without them, live refunds stay
   `pending` and no settlements are produced.
5. **`NEXT_PUBLIC_APP_URL`** must be the public origin — it is baked into every
   `checkout_url` / `short_url` / `payload_url` and the PayU callback URL.
6. Re-verify the money math: platform fee defaults to 2 % + 18 % GST on the fee
   (`SABPAY_FEE_BPS` / `SABPAY_FEE_TAX_BPS`, per-merchant `feeBps` override);
   settlements are T+2 and live-only.
7. Confirm your fulfilment path trusts **webhooks or a server-side
   `GET /v1/payments/{id}`**, never the redirect query params alone.
