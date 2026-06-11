# SabPay — Public Checkout Surfaces and the `/pay/[pageSlug]` Dispatcher

Every public, unauthenticated "collect money" URL in SabNode rides **one**
Next.js route: `src/app/pay/[pageSlug]/page.tsx`. There is no `/pay/[id]`, no
`/pay/link/[id]`, no second dynamic segment — one folder serves every surface
by inspecting the captured segment.

## THE HARD RULE

> **Never create `/pay/[id]` or any sibling dynamic route segment next to
> `[pageSlug]`.**

Next.js forbids two different dynamic segment names at the same path level
(`app/pay/[id]` + `app/pay/[pageSlug]`). When this was violated historically it
did not fail at the offending route — it **broke every dynamic route in the
app** at build time. The fix was the merged dispatcher in `[pageSlug]`; all new
public checkout products must branch *inside* it. If you need a new public
URL shape, add a prefix branch to the dispatcher — do not add a folder.

## The dispatcher contract

The single segment is matched against the SabPay id prefixes **in order**
(prefixes are unguessable `<prefix>_<24 hex>` ids, so they can never collide
with a page slug, which is `^[a-z0-9-]{3,60}$` — underscores are impossible in
slugs):

| Order | Segment shape | Surface | Resolution |
| ----- | ------------- | ------- | ---------- |
| 1 | `pay_…` | **Hosted checkout** | `GET /v1/sabpay/public/payments/{id}` → render `CheckoutClient` (payment + merchant branding). The payment id is the capability. |
| 2 | `plink_…` | **Payment link** | `GET /v1/sabpay/public/links/{id}` for the view; starting checkout calls `POST /v1/sabpay/public/links/{id}/session`, which resolves (already-`paid` links return the existing payment) or creates a `pay_…` session linked via `paymentLinkId`, then redirects to `/pay/<pay_id>`. Cancelled/expired links render a closed state (the engine answers 409). |
| 3 | `inv_…` | **Invoice payable view** | The invoice's `short_url` already points at its payment's `/pay/<pay_id>`; the `inv_…` branch renders the invoice (line items, customer, status) with a *Pay* action that follows the linked payment session. Paid/cancelled/expired invoices render their terminal state. |
| 4 | `qr_…` | **QR landing** | `GET /v1/sabpay/public/qr/{id}` for the view (fixed amount shown, open amount prompts the payer); `POST /v1/sabpay/public/qr/{id}/session` creates a `pay_…` session linked via `qrCodeId` and redirects to `/pay/<pay_id>`. Closed QRs render a closed state (409 from the engine). |
| 5 | anything else | **SabPay payment page by slug** | `GET /v1/sabpay/public/pages/{slug}` (active pages only). Submitting calls `POST /v1/sabpay/public/pages/{slug}/session` → `pay_…` session linked via `paymentPageId` → redirect to `/pay/<pay_id>`. |
| 6 | still unresolved | **SabCheckout fallback** | `loadPublicSabcheckoutPage(slug)` (the legacy SabCheckout product, `/v1/sabcheckout/pages/public/by-slug/:slug`). A 404 from every branch above falls through here; if SabCheckout also misses, `notFound()`. |

Key properties of the contract:

- **Prefix branches must come before slug resolution.** A `pay_…` lookup that
  404s in SabPay falls through (an old/foreign id should not shadow a slug),
  but any non-404 error is a real failure and must `throw`.
- **Every payable surface funnels into a `pay_…` session.** Links, pages, QRs,
  and invoices never collect money themselves — they create/resolve a payment
  via their `…/session` endpoint and hand off to the hosted checkout at
  `/pay/<pay_id>`. That keeps the finalize chokepoint
  (`rust/crates/sabpay/src/finalize.rs`) the only place success side effects
  happen, regardless of the entry surface.
- **No principal anywhere.** Public handlers carry no `AuthUser`; the engine
  resolves the owning merchant from the document itself (for branding) and the
  unguessable id is the capability (`rust/crates/sabpay/src/ids.rs`).
- The engine builds all of these URLs from one base:
  `checkout_url` / `short_url` / `payload_url` / `url` are
  `{NEXT_PUBLIC_APP_URL}/pay/<id-or-slug>` (`store::app_url()`).

## Sub-routes of the dispatcher

```
src/app/pay/
├── [pageSlug]/
│   ├── page.tsx                      ← the dispatcher (server component)
│   ├── checkout-client.tsx           ← SabPay hosted checkout (form → processing → receipt)
│   ├── checkout.css                  ← self-contained checkout styles (NOT 20ui — public surface)
│   ├── _components/public-checkout-form.tsx  ← SabCheckout fallback renderer
│   ├── success/page.tsx              ← SabCheckout success confirmation (?sessionId=…)
│   └── cancel/page.tsx               ← SabCheckout cancel page
└── error/page.tsx                    ← terminal error (unverifiable PayU callback, parse failures)
```

Two flavors of "where does the customer land afterwards":

- **SabPay** payments redirect to the merchant's own `success_url` /
  `cancel_url` with `?sabpay_payment_id=…&sabpay_status=…` appended (or stay on
  the hosted receipt when none is set). The PayU callback proxy
  (`src/app/api/sabpay/callback/payu/route.ts`) 303-redirects there after the
  Rust engine verifies the reverse hash; verification failures land on
  `/pay/error`.
- **SabCheckout** uses its own `/pay/<slug>/success` + `/pay/<slug>/cancel`
  sub-pages.

The public surface intentionally does **not** use 20ui primitives — it themes
itself inline from each product's own branding (merchant logo/brand color for
SabPay; page theme for SabCheckout), because it renders outside the
authenticated app shell.

## Slug-collision policy (SabPay pages vs SabCheckout pages)

Two products publish human slugs under `/pay/`: SabPay payment pages and
SabCheckout pages. The policy:

1. **Uniqueness is enforced at creation time.** SabPay validates a new payment
   page slug (`^[a-z0-9-]{3,60}$`, lowercased, immutable after create) for
   uniqueness against existing slugs — across **all merchants** (one slug = one
   public URL; see `slug_taken` in
   `rust/crates/sabpay/src/entities/payment_pages.rs`) **and against
   SabCheckout pages**, so a new SabPay page can never shadow an existing
   SabCheckout URL. `GET /v1/sabpay/payment-pages/slug-available?slug=…` is the
   pre-flight check the dashboard create form uses.
2. **The dispatcher tries SabPay first.** At request time an unprefixed segment
   resolves as a SabPay payment page before falling through to SabCheckout.
   Because of rule 1 this order only matters for legacy duplicates — and in
   that case SabPay deliberately wins.
3. Entity ids can never collide with either: every SabPay id carries a
   `<prefix>_` marker and slugs cannot contain `_`.

## Checklist for touching this area

- [ ] New public surface? Add a branch inside `[pageSlug]/page.tsx` — never a
      new dynamic folder under `/pay/`.
- [ ] Branch order preserved: `pay_` → `plink_` → `inv_` → `qr_` → SabPay slug
      → SabCheckout fallback.
- [ ] 404s fall through; non-404 engine errors throw.
- [ ] Money is only ever collected on the `pay_…` hosted checkout; new surfaces
      create sessions via a `…/session` public endpoint and link themselves with
      the proper `*Id` field so `finalize.rs` fires their side effects.
- [ ] Slug creation paths validate against both slug namespaces.
- [ ] `checkout.css` is reconstructed and pending visual QA — eyeball the
      hosted checkout after any change to it.
