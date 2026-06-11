# SabPay — REST API Reference (`/api/sabpay/v1/*`)

> **Keep in sync.** This file is the canonical spec for the public API and MUST
> be kept in sync with `src/app/sabpay/docs/_content` (the in-app developer
> reference rendered inside the dashboard). When an endpoint or field changes,
> update both in the same PR.
>
> The public routes are thin authenticated wrappers over the Rust route table
> in `rust/crates/sabpay/src/lib.rs` (mounted at `/v1/sabpay`); response fields
> are derived 1:1 from the Rust `*Out` DTOs, re-cased to snake_case.

Base URL: `https://sabnode.com/api/sabpay/v1`

---

## Authentication

Every request carries a secret key in the `Authorization` header:

```
Authorization: Bearer sk_test_4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e
```

- Keys are minted in the dashboard (**SabPay → Developers**) and shown **once**.
- **The key prefix decides the mode**: `sk_test_…` operates on test data,
  `sk_live_…` on live data. A test key can never create a live charge, and a
  live key can never see test objects.
- `x-api-key: sk_…` is accepted as a fallback header.
- Keys are stored as SHA-256 hashes; revoked keys fail with `401`.

## Idempotency

Mutating requests (POST) may send an `Idempotency-Key` header (any string,
≤ 255 chars):

```
Idempotency-Key: order-7421-attempt-1
```

- The first request with a key runs normally and its response is stored.
- Replays of the same key + same body within **24 hours** return the stored
  response verbatim, without re-running the side effect.
- The same key with a **different body** → `409` `idempotency_key_reused`.
- A replay while the first request is still in flight → `409` ("still being
  processed").

## Pagination

List endpoints are **cursor-paginated, newest first** — never numbered pages:

| Param | Meaning |
| ----- | ------- |
| `?limit=` | Page size, clamped to 1–100 (payments default 25, entity lists default 50) |
| `?before=` | Cursor: the `created_at` of the last item of the previous page (ISO-8601 string). Returns items strictly older. |
| `?status=` | Optional status filter (entities with a lifecycle) |

```bash
curl -s "https://sabnode.com/api/sabpay/v1/payments?limit=25&before=2026-06-10T11:22:33.000Z" \
  -H "Authorization: Bearer sk_test_…"
```

Lists return:

```json
{ "object": "list", "data": [ … ] }
```

## Errors

All errors share one envelope:

```json
{ "error": { "code": "invalid_request", "message": "amount must be an integer in paise, at least 100 (₹1)." } }
```

| HTTP | `code` | When |
| ---- | ------ | ---- |
| 400 | `invalid_json` | Body is not JSON |
| 400 | `invalid_request` | Validation failure (amount bounds, bad currency, unknown linked id, …) |
| 401 | `invalid_api_key` | Missing / invalid / revoked key |
| 404 | `payment_not_found` (etc.) | Unknown id, or an id from the other mode |
| 409 | `invalid_request` | Conflicts (idempotency reuse, already-finished lifecycle, concurrent over-refund) |
| 5xx | `server_error` | Engine failure |

## Shared conventions

- All amounts are **integer paise** (₹499.00 → `49900`). Min `100`, max
  `100000000` (₹10,00,000). Currency is `INR` only.
- `notes` / `metadata` objects: ≤ 20 keys, string values only, key ≤ 40 chars,
  value ≤ 500 chars.
- Timestamps are ISO-8601 strings (`2026-06-11T08:30:00.000Z`).
- Webhook payloads use **camelCase** (the raw engine objects); REST responses
  use **snake_case**. See `docs/sabpay/integration-guide.md`.

---

## Payments

A payment is one checkout session. Lifecycle: `created → succeeded | failed`.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/v1/payments` | Create a payment session → `checkout_url` |
| GET | `/v1/payments` | List payments (`?status=&before=&limit=`) |
| GET | `/v1/payments/{id}` | Fetch one payment (poll after redirect) |
| GET | `/v1/payments/{id}/refunds` | List refunds for a payment |
| POST | `/v1/payments/{id}/refunds` | Create a refund (see Refunds) |

Create accepts: `amount` (required), `currency`, `description`, `customer`
(`{name,email,phone}`), `metadata`, `success_url`, `cancel_url`, `order_id`
(must be a same-mode order you own), `customer_id` (same-mode customer).

```bash
curl -s https://sabnode.com/api/sabpay/v1/payments \
  -H "Authorization: Bearer sk_test_4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-7421-attempt-1" \
  -d '{
    "amount": 49900,
    "currency": "INR",
    "description": "Pro plan — March",
    "customer": { "name": "Asha Verma", "email": "asha@example.com" },
    "metadata": { "order_ref": "ORD-7421" },
    "success_url": "https://merchant.example.com/thanks",
    "cancel_url": "https://merchant.example.com/cart"
  }'
```

`201`:

```json
{
  "id": "pay_0a1b2c3d4e5f60718293a4b5",
  "object": "payment",
  "mode": "test",
  "status": "created",
  "amount": 49900,
  "currency": "INR",
  "description": "Pro plan — March",
  "checkout_url": "https://sabnode.com/pay/pay_0a1b2c3d4e5f60718293a4b5",
  "success_url": "https://merchant.example.com/thanks",
  "cancel_url": "https://merchant.example.com/cart",
  "customer": { "name": "Asha Verma", "email": "asha@example.com", "phone": null },
  "metadata": { "order_ref": "ORD-7421" },
  "provider_payment_id": null,
  "failure_reason": null,
  "created_at": "2026-06-11T08:30:00.000Z",
  "paid_at": null
}
```

`GET /v1/payments/{id}` additionally returns `provider_meta`
(`{ paymentMode, bankRefNum, errorMessage }`). The full payment object (per the
Rust `PaymentOut` DTO) also carries the linkage + ledger fields once relevant:
`order_id`, `customer_id`, `payment_link_id`, `payment_page_id`, `invoice_id`,
`subscription_id`, `qr_code_id`, `amount_refunded`, `refund_status`
(`partial|full`), `fee`, `tax`, `dispute_status`, `settlement_id`, `provider`
(`"payu"`), `provider_txn_id`.

---

## Orders

An order is an intent to collect a fixed amount; payments attach to it via
`order_id`. Lifecycle: `created → attempted → paid` (an order goes `attempted`
when a payment is associated; `paid` fires from the finalize chokepoint with an
`order.paid` webhook). Only `notes` is mutable.

| Method | Path |
| ------ | ---- |
| POST | `/v1/orders` |
| GET | `/v1/orders` (`?status=&before=&limit=`) |
| GET | `/v1/orders/{id}` |
| PATCH | `/v1/orders/{id}` (notes only) |
| GET | `/v1/orders/{id}/payments` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/orders \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 49900, "receipt": "ORD-7421", "notes": { "channel": "web" } }'
```

```json
{
  "id": "order_1b2c3d4e5f60718293a4b5c6",
  "object": "order",
  "mode": "test",
  "amount": 49900,
  "amount_paid": 0,
  "amount_due": 49900,
  "currency": "INR",
  "status": "created",
  "receipt": "ORD-7421",
  "notes": { "channel": "web" },
  "created_at": "2026-06-11T08:30:00.000Z",
  "paid_at": null
}
```

---

## Refunds

Full or partial refunds against a **succeeded** payment. The refundable
remainder is guarded atomically against concurrent over-refunds. A **test**
refund is instantly `processed`; a **live** refund is `pending` until the
settlement cron deducts it from the next settlement and marks it `processed`.
Fires `refund.created` (+ `refund.processed`).

| Method | Path |
| ------ | ---- |
| POST | `/v1/payments/{id}/refunds` (omit `amount` for a full refund of the remainder) |
| GET | `/v1/payments/{id}/refunds` |
| GET | `/v1/refunds` (`?status=&before=&limit=`) |
| GET | `/v1/refunds/{id}` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/payments/pay_0a1b2c3d4e5f60718293a4b5/refunds \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 10000, "reason": "requested_by_customer" }'
```

```json
{
  "id": "rfnd_2c3d4e5f60718293a4b5c6d7",
  "object": "refund",
  "mode": "test",
  "payment_id": "pay_0a1b2c3d4e5f60718293a4b5",
  "amount": 10000,
  "currency": "INR",
  "status": "processed",
  "reason": "requested_by_customer",
  "notes": null,
  "settlement_id": null,
  "created_at": "2026-06-11T09:00:00.000Z",
  "processed_at": "2026-06-11T09:00:00.000Z"
}
```

---

## Customers

Reusable customer records referenced by payments, subscriptions, and invoices
(`customer_id`). Hard delete leaves dangling references (Razorpay-like).

| Method | Path |
| ------ | ---- |
| POST | `/v1/customers` |
| GET | `/v1/customers` (`?search=&before=&limit=` — search matches name/email/contact) |
| GET | `/v1/customers/{id}` |
| PATCH | `/v1/customers/{id}` |
| DELETE | `/v1/customers/{id}` |
| GET | `/v1/customers/{id}/payments` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/customers \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Asha Verma", "email": "asha@example.com", "contact": "9876543210", "gstin": "29ABCDE1234F1Z5" }'
```

```json
{
  "id": "cust_3d4e5f60718293a4b5c6d7e8",
  "object": "customer",
  "mode": "test",
  "name": "Asha Verma",
  "email": "asha@example.com",
  "contact": "9876543210",
  "gstin": "29ABCDE1234F1Z5",
  "notes": null,
  "created_at": "2026-06-11T08:30:00.000Z"
}
```

---

## Payment Links

A shareable, fixed-amount collection request. The payer opens `short_url`
(`https://sabnode.com/pay/<plink_id>`); the dispatcher resolves a `pay_…`
session linked back to the link. Lifecycle: `created → paid | cancelled |
expired`. Only an open (`created`) link can be edited or cancelled. The
`created → paid` flip and `payment_link.paid` fire from the finalize
chokepoint; the expiry cron stamps `expired`.

| Method | Path |
| ------ | ---- |
| POST | `/v1/payment-links` |
| GET | `/v1/payment-links` (`?status=&before=&limit=`) |
| GET | `/v1/payment-links/{id}` |
| PATCH | `/v1/payment-links/{id}` (open links only) |
| POST | `/v1/payment-links/{id}/cancel` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/payment-links \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150000,
    "description": "Invoice #88 balance",
    "reference_id": "INV-88",
    "customer_email": "asha@example.com",
    "expire_by": "2026-06-30T23:59:59.000Z"
  }'
```

```json
{
  "id": "plink_4e5f60718293a4b5c6d7e8f9",
  "object": "payment_link",
  "mode": "test",
  "amount": 150000,
  "currency": "INR",
  "status": "created",
  "description": "Invoice #88 balance",
  "reference_id": "INV-88",
  "customer_name": null,
  "customer_email": "asha@example.com",
  "customer_phone": null,
  "notes": null,
  "short_url": "https://sabnode.com/pay/plink_4e5f60718293a4b5c6d7e8f9",
  "expire_by": "2026-06-30T23:59:59.000Z",
  "payment_id": null,
  "created_at": "2026-06-11T08:30:00.000Z",
  "paid_at": null,
  "cancelled_at": null
}
```

---

## Payment Pages

A no-code hosted form published at `https://sabnode.com/pay/<slug>`. Amount is
`fixed` or `customer_decided` (with optional `min_amount`); up to **10** custom
fields (types `text | email | phone | number`); submissions become a regular
`pay_…` session linked via `payment_page_id`, with field values stored as
payment `metadata`. Slugs are `^[a-z0-9-]{3,60}$`, **globally unique**, and
immutable after create (see `docs/sabpay/checkout-surfaces.md` for the
collision policy with SabCheckout).

| Method | Path |
| ------ | ---- |
| POST | `/v1/payment-pages` |
| GET | `/v1/payment-pages` (`?before=&limit=`) |
| GET | `/v1/payment-pages/slug-available?slug=…` |
| GET | `/v1/payment-pages/{id}` |
| PATCH | `/v1/payment-pages/{id}` (title, description, amount, fields, branding, `active`) |
| DELETE | `/v1/payment-pages/{id}` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/payment-pages \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Workshop registration",
    "slug": "workshop-2026",
    "amount_type": "fixed",
    "amount": 99900,
    "fields": [
      { "key": "college", "label": "College name", "type": "text", "required": true },
      { "key": "roll_no", "label": "Roll number", "type": "number", "required": false }
    ]
  }'
```

```json
{
  "id": "page_5f60718293a4b5c6d7e8f90a",
  "object": "payment_page",
  "mode": "test",
  "title": "Workshop registration",
  "description": null,
  "slug": "workshop-2026",
  "amount_type": "fixed",
  "amount": 99900,
  "min_amount": null,
  "fields": [
    { "key": "college", "label": "College name", "type": "text", "required": true },
    { "key": "roll_no", "label": "Roll number", "type": "number", "required": false }
  ],
  "branding_image_url": null,
  "active": true,
  "url": "https://sabnode.com/pay/workshop-2026",
  "created_at": "2026-06-11T08:30:00.000Z"
}
```

---

## Plans

An **immutable** billing template (amount + interval) that subscriptions
reference. Razorpay parity: no update endpoint — to change pricing, create a
new plan and migrate. Deletion is refused while any subscription references it.

| Method | Path |
| ------ | ---- |
| POST | `/v1/plans` |
| GET | `/v1/plans` (`?before=&limit=`) |
| GET | `/v1/plans/{id}` |
| DELETE | `/v1/plans/{id}` (409 while referenced) |

`interval` ∈ `daily | weekly | monthly | yearly`; `interval_count` ≥ 1.

```bash
curl -s https://sabnode.com/api/sabpay/v1/plans \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Pro monthly", "amount": 49900, "interval": "monthly", "interval_count": 1 }'
```

```json
{
  "id": "plan_60718293a4b5c6d7e8f90a1b",
  "object": "plan",
  "mode": "test",
  "name": "Pro monthly",
  "amount": 49900,
  "currency": "INR",
  "interval": "monthly",
  "interval_count": 1,
  "description": null,
  "notes": null,
  "created_at": "2026-06-11T08:30:00.000Z"
}
```

---

## Subscriptions

Binds a `plan_id` to an optional `customer_id` and a `total_count` of cycles.
Lifecycle: `created → active → (paused | halted) → cancelled | completed`.
The cron generates one **payable cycle invoice** per period (`next_charge_at`);
**there is no card auto-debit rail** — live cycles emit `subscription.pending`
with the invoice's checkout link, and paying it credits the cycle
(`subscription.charged`). Three unpaid cycle invoices halt the subscription.
`total_count` may only be **increased**.

| Method | Path |
| ------ | ---- |
| POST | `/v1/subscriptions` |
| GET | `/v1/subscriptions` (`?status=&before=&limit=`) |
| GET | `/v1/subscriptions/{id}` |
| PATCH | `/v1/subscriptions/{id}` (`notes`, increase `total_count`) |
| POST | `/v1/subscriptions/{id}/cancel` (`?at_cycle_end=1` to stop after the running cycle) |
| POST | `/v1/subscriptions/{id}/pause` (active only) |
| POST | `/v1/subscriptions/{id}/resume` (paused only) |

```bash
curl -s https://sabnode.com/api/sabpay/v1/subscriptions \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan_60718293a4b5c6d7e8f90a1b",
    "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
    "total_count": 12,
    "start_at": "2026-07-01T00:00:00.000Z"
  }'
```

```json
{
  "id": "sub_718293a4b5c6d7e8f90a1b2c",
  "object": "subscription",
  "mode": "test",
  "plan_id": "plan_60718293a4b5c6d7e8f90a1b",
  "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
  "total_count": 12,
  "paid_count": 0,
  "missed_cycles": 0,
  "status": "created",
  "next_charge_at": "2026-07-01T00:00:00.000Z",
  "cancel_at_cycle_end": null,
  "notes": null,
  "created_at": "2026-06-11T08:30:00.000Z",
  "paused_at": null,
  "cancelled_at": null,
  "ended_at": null
}
```

---

## Invoices

A merchant-issued bill with line items (≤ 25; `amount` is per-unit paise ×
`quantity`, totals validated against the shared cap). `type` is `invoice`
(one-off) or `subscription_cycle` (cron-generated). Lifecycle:
`draft → issued → paid | cancelled | expired`. Issuing spins a hosted-checkout
payment session and stamps `short_url`; `invoice.paid` fires from the finalize
chokepoint. Drafts are the only editable/deletable state; only issued, unpaid
invoices can be cancelled. Passing `customer_id` snapshots the saved customer
(same mode) onto the invoice.

| Method | Path |
| ------ | ---- |
| POST | `/v1/invoices` |
| GET | `/v1/invoices` (`?status=&before=&limit=`) |
| GET | `/v1/invoices/{id}` |
| PATCH | `/v1/invoices/{id}` (drafts only; replacing `line_items` recomputes `amount`) |
| DELETE | `/v1/invoices/{id}` (drafts only) |
| POST | `/v1/invoices/{id}/issue` |
| POST | `/v1/invoices/{id}/cancel` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/invoices \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
    "line_items": [
      { "name": "Consulting (June)", "amount": 250000, "quantity": 2 },
      { "name": "Travel", "amount": 40000, "quantity": 1 }
    ],
    "expire_by": "2026-06-30T23:59:59.000Z"
  }'
```

```json
{
  "id": "inv_8293a4b5c6d7e8f90a1b2c3d",
  "object": "invoice",
  "mode": "test",
  "type": "invoice",
  "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
  "customer_name": "Asha Verma",
  "customer_email": "asha@example.com",
  "customer_phone": "9876543210",
  "line_items": [
    { "name": "Consulting (June)", "description": null, "amount": 250000, "quantity": 2 },
    { "name": "Travel", "description": null, "amount": 40000, "quantity": 1 }
  ],
  "amount": 540000,
  "currency": "INR",
  "notes": null,
  "expire_by": "2026-06-30T23:59:59.000Z",
  "status": "draft",
  "payment_id": null,
  "subscription_id": null,
  "short_url": null,
  "created_at": "2026-06-11T08:30:00.000Z",
  "issued_at": null,
  "paid_at": null,
  "cancelled_at": null
}
```

---

## QR Codes

A stable, shareable collect code (`payload_url = https://sabnode.com/pay/<qr_id>`).
`usage` is `single_use` (auto-closes on the first successful payment) or
`multiple_use` (accumulates). `fixed_amount: true` pins the amount; otherwise
the payer enters it. Crediting (`qr_code.credited`) happens in the finalize
chokepoint; `POST …/close` closes on demand (`qr_code.closed`).

| Method | Path |
| ------ | ---- |
| POST | `/v1/qr-codes` |
| GET | `/v1/qr-codes` (`?status=&before=&limit=`) |
| GET | `/v1/qr-codes/{id}` |
| POST | `/v1/qr-codes/{id}/close` |

```bash
curl -s https://sabnode.com/api/sabpay/v1/qr-codes \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Counter 1", "usage": "multiple_use", "fixed_amount": false, "description": "Front desk collections" }'
```

```json
{
  "id": "qr_93a4b5c6d7e8f90a1b2c3d4e",
  "object": "qr_code",
  "mode": "test",
  "name": "Counter 1",
  "usage": "multiple_use",
  "fixed_amount": false,
  "amount": null,
  "description": "Front desk collections",
  "status": "active",
  "payload_url": "https://sabnode.com/pay/qr_93a4b5c6d7e8f90a1b2c3d4e",
  "payments_count_received": 0,
  "payments_amount_received": 0,
  "closed_at": null,
  "created_at": "2026-06-11T08:30:00.000Z"
}
```

---

## Settlements

**Read-only, always live-mode.** The daily settlement cron sweeps eligible
live payments (succeeded, T+2, unsettled, not open-disputed), nets out
fee + GST + refunds + lost disputes, and pays out `amount`. Test payments are
never settled.

| Method | Path |
| ------ | ---- |
| GET | `/v1/settlements` (`?before=&limit=`) |
| GET | `/v1/settlements/summary` (projected next payout) |
| GET | `/v1/settlements/{id}` (detail with covered payments + refunds) |

```bash
curl -s https://sabnode.com/api/sabpay/v1/settlements/setl_a4b5c6d7e8f90a1b2c3d4e5f \
  -H "Authorization: Bearer sk_live_…"
```

```json
{
  "settlement": {
    "id": "setl_a4b5c6d7e8f90a1b2c3d4e5f",
    "object": "settlement",
    "mode": "live",
    "status": "processed",
    "gross_amount": 1250000,
    "fees_total": 25000,
    "tax_total": 4500,
    "refunds_total": 10000,
    "disputes_deducted": 0,
    "amount": 1210500,
    "payment_count": 18,
    "refund_count": 1,
    "utr": "SABP9f3a1b2c4d5e6f70",
    "period_end": "2026-06-11",
    "settled_at": "2026-06-11T01:30:05.000Z",
    "created_at": "2026-06-11T01:30:05.000Z"
  },
  "payments": [ { "id": "pay_…", "…": "full payment objects" } ],
  "refunds": [ { "id": "rfnd_…", "amount": 10000, "payment_id": "pay_…" } ]
}
```

`GET /v1/settlements/summary`:

```json
{ "next_amount": 322500, "eligible_count": 4, "last_settled_at": "2026-06-11T01:30:05.000Z" }
```

---

## Disputes

Chargebacks against succeeded payments. Lifecycle:
`open → under_review → won | lost`. Real disputes are platform-seeded; in
**test mode** you can simulate one to exercise webhooks end-to-end. The linked
payment's `dispute_status` is kept in lock-step, and an open dispute excludes
the payment from settlement.

| Method | Path |
| ------ | ---- |
| GET | `/v1/disputes` (`?status=&before=&limit=`) |
| GET | `/v1/disputes/{id}` |
| POST | `/v1/disputes/{id}/accept` (concede → `lost`) |
| POST | `/v1/disputes/{id}/contest` (submit evidence → `under_review`) |
| POST | `/v1/test/disputes` (test mode only; optional immediate `outcome: "won"|"lost"`) |

Contest body: `{ "summary": "…", "file_urls": ["https://…"] }` (summary
≤ 2000 chars, ≤ 20 http(s) URLs — in the dashboard, evidence files come from
SabFiles).

```bash
curl -s https://sabnode.com/api/sabpay/v1/test/disputes \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "payment_id": "pay_0a1b2c3d4e5f60718293a4b5", "reason_code": "product_not_received" }'
```

```json
{
  "id": "disp_b5c6d7e8f90a1b2c3d4e5f60",
  "object": "dispute",
  "mode": "test",
  "payment_id": "pay_0a1b2c3d4e5f60718293a4b5",
  "amount": 49900,
  "currency": "INR",
  "reason_code": "product_not_received",
  "phase": "chargeback",
  "status": "open",
  "respond_by": "2026-06-18T08:30:00.000Z",
  "evidence": null,
  "evidence_submitted_at": null,
  "created_at": "2026-06-11T08:30:00.000Z",
  "resolved_at": null
}
```

---

## Webhook event catalog

These are the values accepted when subscribing an endpoint (the engine's
`WEBHOOK_EVENTS` list in `rust/crates/sabpay/src/store.rs`):

```
payment.created          payment.succeeded        payment.failed
order.paid
refund.created           refund.processed
payment_link.paid        payment_link.cancelled   payment_link.expired
invoice.issued           invoice.paid             invoice.cancelled         invoice.expired
subscription.activated   subscription.pending     subscription.charged
subscription.paused      subscription.resumed     subscription.halted
subscription.cancelled   subscription.completed
qr_code.credited         qr_code.closed
settlement.processed
dispute.created          dispute.under_review     dispute.won               dispute.lost
```

Delivery format, signature verification, and retry semantics:
`docs/sabpay/integration-guide.md`.
