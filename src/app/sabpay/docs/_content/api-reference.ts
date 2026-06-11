/**
 * SabPay in-app API reference content — rendered by `/sabpay/docs/api`.
 *
 * KEEP IN SYNC with `docs/sabpay/api-reference.md` (the canonical spec for
 * the public API). When an endpoint or field changes, update both in the
 * same PR. The public routes wrap the Rust route table in
 * `rust/crates/sabpay/src/lib.rs`; responses are snake_case re-casings of
 * the Rust `*Out` DTOs.
 */

export type SabpayDocMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface SabpayDocEndpoint {
  method: SabpayDocMethod;
  path: string;
  summary: string;
  /** Representative request, rendered as a bash CodeBlock when present. */
  curl?: string;
  /** The matching response body, rendered as a json CodeBlock when present. */
  response?: string;
}

export interface SabpayDocEntitySection {
  /** Anchor id used by the in-page nav (e.g. `#payments`). */
  id: string;
  entity: string;
  description: string;
  endpoints: SabpayDocEndpoint[];
}

export const SABPAY_API_REFERENCE: SabpayDocEntitySection[] = [
  {
    id: 'payments',
    entity: 'Payments',
    description:
      'A payment is one checkout session. Lifecycle: created → succeeded | failed. Creating one returns a checkout_url — redirect the customer there. Create accepts amount (required, paise), currency, description, customer {name,email,phone}, metadata, success_url, cancel_url, order_id (a same-mode order you own) and customer_id (same-mode customer). Fetching one payment additionally returns provider_meta plus linkage and ledger fields (order_id, amount_refunded, refund_status, fee, tax, dispute_status, settlement_id, …).',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/payments',
        summary: 'Create a payment session → checkout_url',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/payments \\
  -H "Authorization: Bearer sk_test_4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-7421-attempt-1" \\
  -d '{
    "amount": 49900,
    "currency": "INR",
    "description": "Pro plan — March",
    "customer": { "name": "Asha Verma", "email": "asha@example.com" },
    "metadata": { "order_ref": "ORD-7421" },
    "success_url": "https://merchant.example.com/thanks",
    "cancel_url": "https://merchant.example.com/cart"
  }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/payments',
        summary: 'List payments (?status=&before=&limit=, default 25)',
      },
      {
        method: 'GET',
        path: '/v1/payments/{id}',
        summary: 'Fetch one payment (poll after the redirect; includes provider_meta)',
      },
      {
        method: 'GET',
        path: '/v1/payments/{id}/refunds',
        summary: 'List refunds for a payment',
      },
      {
        method: 'POST',
        path: '/v1/payments/{id}/refunds',
        summary: 'Create a refund (see Refunds)',
      },
    ],
  },
  {
    id: 'orders',
    entity: 'Orders',
    description:
      'An order is an intent to collect a fixed amount; payments attach to it via order_id. Lifecycle: created → attempted → paid (attempted when a payment is associated; paid fires from the finalize chokepoint with an order.paid webhook). Only notes is mutable.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/orders',
        summary: 'Create an order',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/orders \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 49900, "receipt": "ORD-7421", "notes": { "channel": "web" } }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/orders',
        summary: 'List orders (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/orders/{id}', summary: 'Fetch one order' },
      {
        method: 'PATCH',
        path: '/v1/orders/{id}',
        summary: 'Update an order (notes only)',
      },
      {
        method: 'GET',
        path: '/v1/orders/{id}/payments',
        summary: 'List payments attached to an order',
      },
    ],
  },
  {
    id: 'refunds',
    entity: 'Refunds',
    description:
      'Full or partial refunds against a succeeded payment. Omit amount for a full refund of the remainder; the refundable remainder is guarded atomically against concurrent over-refunds. A test refund is instantly processed; a live refund is pending until the settlement cron deducts it from the next settlement and marks it processed. Fires refund.created (+ refund.processed).',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/payments/{id}/refunds',
        summary: 'Create a refund (omit amount for a full refund of the remainder)',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/payments/pay_0a1b2c3d4e5f60718293a4b5/refunds \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 10000, "reason": "requested_by_customer" }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/payments/{id}/refunds',
        summary: 'List refunds for one payment',
      },
      {
        method: 'GET',
        path: '/v1/refunds',
        summary: 'List all refunds (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/refunds/{id}', summary: 'Fetch one refund' },
    ],
  },
  {
    id: 'customers',
    entity: 'Customers',
    description:
      'Reusable customer records referenced by payments, subscriptions, and invoices via customer_id. Delete is a hard delete and leaves dangling references (Razorpay-like).',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/customers',
        summary: 'Create a customer',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/customers \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Asha Verma", "email": "asha@example.com", "contact": "9876543210", "gstin": "29ABCDE1234F1Z5" }'`,
        response: `{
  "id": "cust_3d4e5f60718293a4b5c6d7e8",
  "object": "customer",
  "mode": "test",
  "name": "Asha Verma",
  "email": "asha@example.com",
  "contact": "9876543210",
  "gstin": "29ABCDE1234F1Z5",
  "notes": null,
  "created_at": "2026-06-11T08:30:00.000Z"
}`,
      },
      {
        method: 'GET',
        path: '/v1/customers',
        summary: 'List customers (?search=&before=&limit= — search matches name/email/contact)',
      },
      { method: 'GET', path: '/v1/customers/{id}', summary: 'Fetch one customer' },
      { method: 'PATCH', path: '/v1/customers/{id}', summary: 'Update a customer' },
      {
        method: 'DELETE',
        path: '/v1/customers/{id}',
        summary: 'Hard-delete a customer (references stay dangling)',
      },
      {
        method: 'GET',
        path: '/v1/customers/{id}/payments',
        summary: "List a customer's payments",
      },
    ],
  },
  {
    id: 'payment-links',
    entity: 'Payment Links',
    description:
      'A shareable, fixed-amount collection request. The payer opens short_url (https://sabnode.com/pay/<plink_id>); the dispatcher resolves a pay_… session linked back to the link. Lifecycle: created → paid | cancelled | expired. Only an open (created) link can be edited or cancelled; the expiry cron stamps expired and payment_link.paid fires from the finalize chokepoint.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/payment-links',
        summary: 'Create a payment link → short_url',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/payment-links \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 150000,
    "description": "Invoice #88 balance",
    "reference_id": "INV-88",
    "customer_email": "asha@example.com",
    "expire_by": "2026-06-30T23:59:59.000Z"
  }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/payment-links',
        summary: 'List payment links (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/payment-links/{id}', summary: 'Fetch one payment link' },
      {
        method: 'PATCH',
        path: '/v1/payment-links/{id}',
        summary: 'Update an open link (status "created" only)',
      },
      {
        method: 'POST',
        path: '/v1/payment-links/{id}/cancel',
        summary: 'Cancel an open, unpaid link',
      },
    ],
  },
  {
    id: 'payment-pages',
    entity: 'Payment Pages',
    description:
      'A no-code hosted form published at https://sabnode.com/pay/<slug>. Amount is fixed or customer_decided (with optional min_amount); up to 10 custom fields (text | email | phone | number). Submissions become a regular pay_… session linked via payment_page_id, with field values stored as payment metadata. Slugs are ^[a-z0-9-]{3,60}$, globally unique, and immutable after create.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/payment-pages',
        summary: 'Create a payment page',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/payment-pages \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Workshop registration",
    "slug": "workshop-2026",
    "amount_type": "fixed",
    "amount": 99900,
    "fields": [
      { "key": "college", "label": "College name", "type": "text", "required": true },
      { "key": "roll_no", "label": "Roll number", "type": "number", "required": false }
    ]
  }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/payment-pages',
        summary: 'List payment pages (?before=&limit=)',
      },
      {
        method: 'GET',
        path: '/v1/payment-pages/slug-available?slug=…',
        summary: 'Pre-flight slug availability check (used by the dashboard create form)',
      },
      { method: 'GET', path: '/v1/payment-pages/{id}', summary: 'Fetch one payment page' },
      {
        method: 'PATCH',
        path: '/v1/payment-pages/{id}',
        summary: 'Update title, description, amount, fields, branding, active (slug is immutable)',
      },
      { method: 'DELETE', path: '/v1/payment-pages/{id}', summary: 'Delete a payment page' },
    ],
  },
  {
    id: 'plans',
    entity: 'Plans',
    description:
      'An immutable billing template (amount + interval) that subscriptions reference. Razorpay parity: no update endpoint — to change pricing, create a new plan and migrate. interval ∈ daily | weekly | monthly | yearly; interval_count ≥ 1. Deletion is refused while any subscription references the plan.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/plans',
        summary: 'Create a plan (immutable once created)',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/plans \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Pro monthly", "amount": 49900, "interval": "monthly", "interval_count": 1 }'`,
        response: `{
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
}`,
      },
      { method: 'GET', path: '/v1/plans', summary: 'List plans (?before=&limit=)' },
      { method: 'GET', path: '/v1/plans/{id}', summary: 'Fetch one plan' },
      {
        method: 'DELETE',
        path: '/v1/plans/{id}',
        summary: 'Delete a plan (409 while any subscription references it)',
      },
    ],
  },
  {
    id: 'subscriptions',
    entity: 'Subscriptions',
    description:
      'Binds a plan_id to an optional customer_id and a total_count of cycles. Lifecycle: created → active → (paused | halted) → cancelled | completed. The cron generates one payable cycle invoice per period (next_charge_at) — there is no card auto-debit rail: live cycles emit subscription.pending with the invoice checkout link, and paying it credits the cycle (subscription.charged). Three unpaid cycle invoices halt the subscription. total_count may only be increased.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/subscriptions',
        summary: 'Create a subscription',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/subscriptions \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plan_id": "plan_60718293a4b5c6d7e8f90a1b",
    "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
    "total_count": 12,
    "start_at": "2026-07-01T00:00:00.000Z"
  }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/subscriptions',
        summary: 'List subscriptions (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/subscriptions/{id}', summary: 'Fetch one subscription' },
      {
        method: 'PATCH',
        path: '/v1/subscriptions/{id}',
        summary: 'Update notes; increase total_count (decrease is rejected)',
      },
      {
        method: 'POST',
        path: '/v1/subscriptions/{id}/cancel',
        summary: 'Cancel (?at_cycle_end=1 to stop after the running cycle)',
      },
      {
        method: 'POST',
        path: '/v1/subscriptions/{id}/pause',
        summary: 'Pause an active subscription',
      },
      {
        method: 'POST',
        path: '/v1/subscriptions/{id}/resume',
        summary: 'Resume a paused subscription',
      },
    ],
  },
  {
    id: 'invoices',
    entity: 'Invoices',
    description:
      'A merchant-issued bill with line items (≤ 25; amount is per-unit paise × quantity). type is invoice (one-off) or subscription_cycle (cron-generated). Lifecycle: draft → issued → paid | cancelled | expired. Issuing spins a hosted-checkout payment session and stamps short_url; invoice.paid fires from the finalize chokepoint. Drafts are the only editable/deletable state; only issued, unpaid invoices can be cancelled. Passing customer_id snapshots the saved customer (same mode) onto the invoice.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/invoices',
        summary: 'Create a draft invoice',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/invoices \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "cust_3d4e5f60718293a4b5c6d7e8",
    "line_items": [
      { "name": "Consulting (June)", "amount": 250000, "quantity": 2 },
      { "name": "Travel", "amount": 40000, "quantity": 1 }
    ],
    "expire_by": "2026-06-30T23:59:59.000Z"
  }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/invoices',
        summary: 'List invoices (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/invoices/{id}', summary: 'Fetch one invoice' },
      {
        method: 'PATCH',
        path: '/v1/invoices/{id}',
        summary: 'Update a draft (replacing line_items recomputes amount)',
      },
      { method: 'DELETE', path: '/v1/invoices/{id}', summary: 'Delete a draft invoice' },
      {
        method: 'POST',
        path: '/v1/invoices/{id}/issue',
        summary: 'Issue: spins a hosted checkout session and stamps short_url',
      },
      {
        method: 'POST',
        path: '/v1/invoices/{id}/cancel',
        summary: 'Cancel an issued, unpaid invoice',
      },
    ],
  },
  {
    id: 'qr-codes',
    entity: 'QR Codes',
    description:
      'A stable, shareable collect code (payload_url = https://sabnode.com/pay/<qr_id>). usage is single_use (auto-closes on the first successful payment) or multiple_use (accumulates). fixed_amount: true pins the amount; otherwise the payer enters it. Crediting (qr_code.credited) happens in the finalize chokepoint; close on demand fires qr_code.closed.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/qr-codes',
        summary: 'Create a QR code → payload_url',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/qr-codes \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Counter 1", "usage": "multiple_use", "fixed_amount": false, "description": "Front desk collections" }'`,
        response: `{
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
}`,
      },
      {
        method: 'GET',
        path: '/v1/qr-codes',
        summary: 'List QR codes (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/qr-codes/{id}', summary: 'Fetch one QR code' },
      {
        method: 'POST',
        path: '/v1/qr-codes/{id}/close',
        summary: 'Close a QR code on demand (fires qr_code.closed)',
      },
    ],
  },
  {
    id: 'settlements',
    entity: 'Settlements',
    description:
      'Read-only, always live-mode. The daily settlement cron sweeps eligible live payments (succeeded, T+2, unsettled, not open-disputed), nets out fee + GST + refunds + lost disputes, and pays out amount. Test payments are never settled. The summary endpoint returns the projected next payout: { "next_amount": …, "eligible_count": …, "last_settled_at": … }.',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/settlements',
        summary: 'List settlements (?before=&limit=)',
      },
      {
        method: 'GET',
        path: '/v1/settlements/summary',
        summary: 'Projected next payout (next_amount, eligible_count, last_settled_at)',
      },
      {
        method: 'GET',
        path: '/v1/settlements/{id}',
        summary: 'Settlement detail with covered payments + refunds',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/settlements/setl_a4b5c6d7e8f90a1b2c3d4e5f \\
  -H "Authorization: Bearer sk_live_…"`,
        response: `{
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
}`,
      },
    ],
  },
  {
    id: 'disputes',
    entity: 'Disputes',
    description:
      'Chargebacks against succeeded payments. Lifecycle: open → under_review → won | lost. Real disputes are platform-seeded; in test mode you can simulate one to exercise webhooks end-to-end. The linked payment’s dispute_status is kept in lock-step, and an open dispute excludes the payment from settlement. Contest body: { "summary": "…", "file_urls": ["https://…"] } (summary ≤ 2000 chars, ≤ 20 http(s) URLs — in the dashboard, evidence files come from SabFiles).',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/disputes',
        summary: 'List disputes (?status=&before=&limit=)',
      },
      { method: 'GET', path: '/v1/disputes/{id}', summary: 'Fetch one dispute' },
      {
        method: 'POST',
        path: '/v1/disputes/{id}/accept',
        summary: 'Concede the dispute → lost',
      },
      {
        method: 'POST',
        path: '/v1/disputes/{id}/contest',
        summary: 'Submit evidence → under_review',
      },
      {
        method: 'POST',
        path: '/v1/test/disputes',
        summary: 'Simulate a dispute (test mode only; optional immediate outcome: "won" | "lost")',
        curl: `curl -s https://sabnode.com/api/sabpay/v1/test/disputes \\
  -H "Authorization: Bearer sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "payment_id": "pay_0a1b2c3d4e5f60718293a4b5", "reason_code": "product_not_received" }'`,
        response: `{
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
}`,
      },
    ],
  },
];
