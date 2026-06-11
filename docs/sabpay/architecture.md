# SabPay — Architecture

SabPay is SabNode's Razorpay-parity payment gateway. A merchant creates objects
(payments, orders, links, invoices, subscriptions, …) through a REST API or the
`/sabpay` dashboard; customers pay on a hosted checkout backed by the platform
PayU account (live mode) or a test simulator (test mode); signed webhooks
confirm the results.

The system is split across two codebases that share the same Mongo collections:

| Layer | Location | Role |
| ----- | -------- | ---- |
| Rust engine | `rust/crates/sabpay` (mounted at `/v1/sabpay` by the `api` crate) | Owns every SabPay collection and ALL business logic |
| Next.js app | `src/lib/sabpay/*`, `src/lib/rust-client/sabpay.ts`, `src/app/sabpay`, `src/app/api/sabpay`, `src/app/pay/[pageSlug]` | Auth, public REST surface, dashboard UI, hosted checkout, thin proxies |

---

## Rust crate layout (`rust/crates/sabpay/src/`)

```
lib.rs           Router — the full route table mounted at /v1/sabpay
handlers.rs      Merchant / payments / keys / webhook-endpoint handlers
                 + public checkout handlers (view, payu-session, simulate, callback)
store.rs         Mongo persistence: collection constants, helpers (now_iso,
                 random_hex, validate_amount, validate_notes…), doc→DTO mappers,
                 payment create/list/finalize, merchant get-or-create, key +
                 endpoint CRUD, WEBHOOK_EVENTS catalog
dto.rs           Request/response DTOs (camelCase serde, matches src/lib/sabpay/types.ts)
ids.rs           Razorpay-style id generation: <prefix>_<24 lower-case hex>
finalize.rs      THE finalize chokepoint — every payment-success side effect
cron.rs          Internal cron runners: settlements, subscription cycles, expiry sweeps
webhooks.rs      Outbound HMAC-SHA256 webhook signing + retrying delivery + redeliver
idempotency.rs   Idempotency-Key support (24h TTL, replay/conflict semantics)
payu.rs          PayU Biz SHA-512 request/response hashing (platform credentials)
fees.rs          Platform fee (bps) + 18% GST computation
exports.rs       CSV exports (payments / refunds / orders / settlements)
entities/        One module per entity — `orders` is the reference template
  ├── orders.rs            customers.rs        refunds.rs
  ├── payment_links.rs     payment_pages.rs    plans.rs
  ├── subscriptions.rs     invoices.rs         qr_codes.rs
  └── settlements.rs       disputes.rs
```

Every entity module follows the same shape (mirroring `entities/orders.rs`):
DTOs → `doc_to_*` mapper → `{userId, mode}`-scoped store fns → Axum handlers.
Routes are wired centrally in `lib.rs`. Dashboard handlers take an `AuthUser`
(shared-secret JWT from the Next.js side); public handlers take no principal —
**the unguessable id is the capability**.

### The finalize chokepoint (`finalize.rs`)

`store::finalize_payment` is the only exactly-once transition out of
`status: "created"` (its update filter is `{paymentId, status: "created"}`, so a
PayU retry matches nothing and returns `None`). Both the test simulator and the
PayU callback then call `finalize::after_finalize_success` with the transitioned
doc. Side effects — each idempotent, each firing its own webhook — live **here
and nowhere else**:

1. Stamp the platform `fee` + `tax` (only when absent).
2. Linked order → `paid` (`order.paid`).
3. Linked payment link → `paid` (`payment_link.paid`).
4. Linked invoice → `paid` (`invoice.paid`), and if the invoice belongs to a
   subscription, credit the cycle: `paidCount += 1`, reset `missedCycles`,
   status → `active` (`subscription.charged`, then `subscription.completed`
   when `paidCount >= totalCount`).
5. Linked QR code → credited (`qr_code.credited`); a `single_use` QR
   auto-closes with `closeReason: "paid"`.

### Cron runners (`cron.rs`)

Mounted at `/v1/sabpay/internal/cron/*`, self-guarded by an `x-cron-secret`
header matching `CRON_SECRET`. **Dry-run by default; `?execute=1` performs
writes.** The Next.js proxies at `/api/cron/sabpay-*` forward the secret
(declared in `vercel.json`: settlements `30 1 * * *`, subscriptions `0 3 * * *`,
expiries `*/30 * * * *`).

- **Settlements** (`run_settlements`) — T+2 hold: sweeps every live, succeeded,
  unsettled, not-open-disputed payment per merchant into one `setl_…` doc per
  day (unique `{userId, periodEnd}` index is the double-run guard), nets out
  fee + GST, processes pending live refunds (`pending → processed`,
  `refund.processed`), deducts lost disputes, fires `settlement.processed`.
- **Subscription cycles** (`run_subscription_cycles`) — for every
  `active`/`created` subscription with `nextChargeAt <= now`: honours
  `cancelAtCycleEnd`, halts after 3 outstanding cycle invoices
  (`subscription.halted`), otherwise generates a `subscription_cycle` invoice +
  linked payment. **Test mode auto-succeeds the cycle through the normal
  finalize path; live mode has no auto-debit rail** — it emits
  `subscription.pending` and the customer pays the cycle invoice's checkout
  link.
- **Expiry sweeps** (`run_expiry_sweeps`) — payment links and invoices past
  `expireBy` flip to `expired` (`payment_link.expired`, `invoice.expired`).

### Webhooks (`webhooks.rs`)

For each active endpoint subscribed to the event, SabPay POSTs a signed JSON
envelope:

```
POST <endpoint url>
Content-Type: application/json
X-SabNode-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed by the endpoint secret>
X-SabNode-Event: payment.succeeded
X-SabNode-Delivery: <random hex>
```

Delivery retries 5× with exponential backoff (0.5 s → 8 s, capped 30 s, 15 s
request timeout) on transport errors and 408/429/5xx. Endpoints auto-disable
after **10** consecutive failures. Every attempt is appended to
`sabpay_webhook_deliveries`; the dashboard can redeliver any logged delivery
(re-signed with the endpoint's *current* secret, logged with
`redeliveredFrom`). Dispatch never blocks a handler — it is `tokio::spawn`ed.

### Idempotency (`idempotency.rs`)

Mutating public-API requests may carry an `Idempotency-Key` header. First use
claims a pending row (unique `{userId, key, method, path}` index, race-safe);
the stored response is replayed verbatim for 24 h (Mongo TTL index on
`expiresAt` — the one BSON `DateTime` in SabPay; everything else is ISO
strings). Reusing a key with a different body is `409 idempotency_key_reused`.

---

## Next.js layer

| Path | Role |
| ---- | ---- |
| `src/lib/rust-client/sabpay.ts` | Typed client for `/v1/sabpay`. Three auth modes: `rustFetch` (session cookie → dashboard), `rustFetchAs` (`*As` methods — public API resolves the merchant from a secret key then acts as that user id), `rustFetchPublic` (no principal — the id is the capability). |
| `src/lib/sabpay/api-auth.server.ts` | `verifySabpayApiKey` (Bearer `sk_test_…`/`sk_live_…`, `x-api-key` fallback) + the `{ error: { code, message } }` error helper. |
| `src/lib/sabpay/types.ts` | TS types matching the Rust DTOs verbatim (camelCase). |
| `src/app/api/sabpay/v1/*` | The public REST API (snake_case responses). Key prefix decides the mode; data ops are executed by the Rust engine acting as the merchant. |
| `src/app/api/sabpay/checkout/[id]/payu-session` `…/simulate` | Hosted-checkout proxies to the Rust public endpoints. |
| `src/app/api/sabpay/callback/payu` | PayU `surl`/`furl` target — forwards the form-POST to Rust for reverse-hash verification + finalize, then 303-redirects the customer. |
| `src/app/api/cron/sabpay-*` | Cron proxies (Vercel Cron → Rust runners with `x-cron-secret`). |
| `src/app/sabpay/**` | The merchant dashboard (20ui). Server actions in `src/app/sabpay/actions*` are thin pass-throughs to `rustClient.sabpay.*`. See `docs/sabpay/dashboard.md`. |
| `src/app/pay/[pageSlug]` | THE single public checkout dispatcher. See `docs/sabpay/checkout-surfaces.md`. |

---

## Test vs live mode

Everything in SabPay is dual-track:

- The merchant doc (`sabpay_merchants`) carries a `mode` (`test` default) that
  the dashboard reads/writes (Settings page) — dashboard lists and creates
  follow it.
- API keys are minted per mode: `sk_test_…` / `sk_live_…`. **The key prefix
  decides the mode** of everything created through the public API; a test key
  can never create a live charge.
- Linked objects must exist in the **same mode** (no mode bleed): a payment's
  `order_id`/`customer_id`, a subscription's `plan_id`/`customer_id`, an
  invoice's `customer_id` are all resolved with `{userId, mode}` filters.
- **Test mode**: payments finalize via the simulator (`/public/payments/{id}/simulate`),
  refunds are instantly `processed`, disputes can be conjured via
  `POST /v1/sabpay/test/disputes`, subscription cycles auto-succeed.
- **Live mode**: payments go through the PayU form-POST flow, refunds are
  `pending` until the settlement cron processes them, settlements exist
  (live-only, always), disputes are platform-seeded.

## PayU is platform-level and collection-only

SabPay rides **SabNode's single platform PayU Biz account**
(`PAYU_MERCHANT_KEY` / `PAYU_MERCHANT_SALT` / `PAYU_MODE` in the engine env).
Merchants never connect their own PayU credentials. PayU is used **only to
collect money** on the hosted checkout (SHA-512-signed form POST to
`secure.payu.in`, reverse-hash-verified callback). There is **no PayU API for
anything else**: refunds, settlements, disputes, fees, and recurring billing
are all **SabPay-managed ledgers** in Mongo — the gateway's own bookkeeping,
mirroring how Razorpay nets MDR + GST before paying out. Subscriptions have no
card-on-file auto-debit rail; each cycle is a payable invoice.

Fees: default `SABPAY_FEE_BPS=200` (2.00 %) + `SABPAY_FEE_TAX_BPS=1800` (18 %
GST on the fee), overridable per merchant via `feeBps` on the merchant doc.
Stamped onto the payment at finalize-success; summed by the settlement runner.

Amount rules (shared by every entity): integer **paise**, minimum `100` (₹1),
maximum `100_000_000` (₹10,00,000), currency `INR` only.

---

## Public id prefixes (`ids.rs`)

Ids are `<prefix>_<24 lower-case hex>` — the prefix names the entity, the hex
tail is unguessable, so public surfaces treat "knows the id" as the capability.

| Prefix | Entity | Example |
| ------ | ------ | ------- |
| `pay_` | Payment | `pay_0a1b2c3d4e5f60718293a4b5` |
| `order_` | Order | `order_1b2c3d4e5f60718293a4b5c6` |
| `rfnd_` | Refund | `rfnd_2c3d4e5f60718293a4b5c6d7` |
| `cust_` | Customer | `cust_3d4e5f60718293a4b5c6d7e8` |
| `plink_` | Payment link | `plink_4e5f60718293a4b5c6d7e8f9` |
| `page_` | Payment page | `page_5f60718293a4b5c6d7e8f90a` |
| `plan_` | Plan | `plan_60718293a4b5c6d7e8f90a1b` |
| `sub_` | Subscription | `sub_718293a4b5c6d7e8f90a1b2c` |
| `inv_` | Invoice | `inv_8293a4b5c6d7e8f90a1b2c3d` |
| `qr_` | QR code | `qr_93a4b5c6d7e8f90a1b2c3d4e` |
| `setl_` | Settlement | `setl_a4b5c6d7e8f90a1b2c3d4e5f` |
| `disp_` | Dispute | `disp_b5c6d7e8f90a1b2c3d4e5f60` |
| `evt_` | Webhook event | `evt_c6d7e8f90a1b2c3d4e5f6071` |

Related opaque tokens: secret keys `sk_test_…`/`sk_live_…` (48 hex), webhook
secrets `whsec_…` (64 hex), provider txn ids `sp…` (20 hex), settlement UTRs
`SABP…` (16 hex).

## Mongo collections (`store.rs`)

Document shapes are shared verbatim with the TS side: `_id`/`userId` are
`ObjectId`, timestamps are ISO-8601 **strings**, amounts are integer paise.

| Collection | Contents |
| ---------- | -------- |
| `sabpay_merchants` | One settings doc per user (businessName, branding, mode, feeBps) |
| `sabpay_payments` | Payment sessions |
| `sabpay_api_keys` | SHA-256-hashed secret keys |
| `sabpay_webhook_endpoints` | Outbound endpoints (+ clear-text signing secret) |
| `sabpay_webhook_deliveries` | Delivery log |
| `sabpay_orders` | Orders |
| `sabpay_refunds` | Refunds |
| `sabpay_customers` | Customers |
| `sabpay_payment_links` | Payment links |
| `sabpay_payment_pages` | Payment pages (globally-unique `slug`) |
| `sabpay_plans` | Plans (immutable billing templates) |
| `sabpay_subscriptions` | Subscriptions |
| `sabpay_invoices` | Invoices (`type: invoice \| subscription_cycle`) |
| `sabpay_qr_codes` | QR codes |
| `sabpay_settlements` | Settlements (live-only; unique `{userId, periodEnd}`) |
| `sabpay_disputes` | Disputes |
| `sabpay_idempotency_keys` | Idempotency rows (TTL 24 h; unique `{userId,key,method,path}`) |

---

## Data flow

```
            create / manage objects                          pay
 ┌──────────────────────────────────────────┐   ┌──────────────────────────────┐
 │  Merchant                                │   │  Customer                    │
 │                                          │   │                              │
 │  /sabpay dashboard      REST API         │   │  /pay/<id|slug> dispatcher   │
 │  (server actions)       /api/sabpay/v1/* │   │  (hosted checkout)           │
 │        │                     │           │   │        │                     │
 │        │  session JWT        │ sk_… key  │   │        │ id = capability     │
 │        ▼                     ▼           │   │        ▼                     │
 │   rustClient.sabpay.*   rustFetchAs(uid) │   │   rustFetchPublic            │
 └────────┼─────────────────────┼───────────┘   └────────┼─────────────────────┘
          ▼                     ▼                        ▼
        ┌──────────────────────────────────────────────────────┐
        │   Rust engine — /v1/sabpay  (rust/crates/sabpay)     │
        │   handlers + entities/* → store.rs → Mongo           │
        └──────────────────────────┬───────────────────────────┘
                                   │
        live: signed PayU form ────┤──── test: /simulate
        POST secure.payu.in        │
        PayU → /api/sabpay/callback/payu (reverse-hash verify)
                                   ▼
                    store::finalize_payment            ←─ exactly-once
                    (created → succeeded|failed)          (status:"created" filter)
                                   │ succeeded
                                   ▼
                    finalize::after_finalize_success   ←─ THE chokepoint
                    ├─ stamp fee + tax (fees.rs)
                    ├─ order → paid          ──► order.paid
                    ├─ payment link → paid   ──► payment_link.paid
                    ├─ invoice → paid        ──► invoice.paid
                    │    └─ subscription cycle credit ──► subscription.charged/.completed
                    └─ QR credited (+ single_use auto-close) ──► qr_code.credited
                                   │
                                   ▼
                    webhooks::dispatch — HMAC-signed POST to every
                    subscribed endpoint (payment.succeeded/.failed + entity events)
                                   │
                                   ▼
                    customer 303-redirected to success_url/cancel_url
                    + ?sabpay_payment_id=…&sabpay_status=…
```

Daily, off this hot path, the cron runners (settlements / subscription cycles /
expiries) advance the SabPay-managed ledgers and fire their own webhooks.

## Related docs

- `docs/sabpay/api-reference.md` — full REST reference
- `docs/sabpay/integration-guide.md` — merchant journey + webhook verification
- `docs/sabpay/checkout-surfaces.md` — the `/pay/[pageSlug]` dispatcher contract
- `docs/sabpay/dashboard.md` — dashboard frontend conventions
