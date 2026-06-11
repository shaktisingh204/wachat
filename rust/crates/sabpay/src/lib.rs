//! # sabpay
//!
//! Axum router for the **SabPay** payment-gateway surface. SabPay is a
//! Stripe-style gateway built on SabNode's platform PayU account: any website
//! or app creates a payment through the API, the customer pays on a SabNode
//! hosted checkout, money flows through PayU, the customer is redirected back,
//! and a signed webhook confirms the result.
//!
//! This crate owns every SabPay Mongo collection and all of its logic —
//! merchants, payments (incl. PayU SHA-512 signing + reverse-hash callback
//! verification), secret API keys, webhook endpoints, and HMAC webhook
//! delivery. Document shapes match the Next.js `src/lib/sabpay/*` impl exactly
//! (ISO-string timestamps, `userId` as ObjectId), so both sides share the
//! same collections without a migration.
//!
//! Mount under `/v1/sabpay` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabpay", sabpay::router::<AppState>())
//! ```
//!
//! ## Routes
//!
//! Dashboard (JWT — scoped to the caller / merchant):
//!
//! | Method | Path                      | Purpose                                   |
//! | ------ | ------------------------- | ----------------------------------------- |
//! | GET    | `/overview`               | merchant + stats + recent payments        |
//! | GET    | `/merchant`               | get-or-create merchant settings           |
//! | PUT    | `/merchant`               | update branding / mode                    |
//! | GET    | `/stats`                  | 14-day volume + totals                    |
//! | GET    | `/payments`               | list payments (mode/status/before/limit)  |
//! | POST   | `/payments`               | create a payment session                  |
//! | GET    | `/payments/{id}`          | payment detail                            |
//! | GET    | `/keys`                   | list secret keys                          |
//! | POST   | `/keys`                   | create a secret key (returns secret once) |
//! | POST   | `/keys/{id}/revoke`       | revoke a key                              |
//! | GET    | `/webhooks`               | endpoints + recent deliveries             |
//! | POST   | `/webhooks`               | create an endpoint (returns secret once)  |
//! | PATCH  | `/webhooks/{id}`          | update an endpoint                        |
//! | POST   | `/webhooks/{id}/rotate`   | rotate the signing secret                 |
//! | DELETE | `/webhooks/{id}`          | delete an endpoint                        |
//!
//! Public (no JWT — the unguessable payment id is the capability):
//!
//! | Method | Path                                  | Purpose                          |
//! | ------ | ------------------------------------- | -------------------------------- |
//! | GET    | `/public/payments/{id}`               | hosted-checkout view             |
//! | POST   | `/public/payments/{id}/payu-session`  | signed PayU form fields (live)   |
//! | POST   | `/public/payments/{id}/simulate`      | finalize a test payment          |
//! | POST   | `/public/payu-callback`               | verify + finalize + dispatch     |

pub mod cron;
pub mod dto;
pub mod entities;
pub mod exports;
pub mod fees;
pub mod finalize;
pub mod handlers;
pub mod ids;
pub mod idempotency;
pub mod payu;
pub mod store;
pub mod webhooks;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

/// Build the SabPay router. Wire onto any state exposing a [`MongoHandle`] +
/// `Arc<AuthConfig>` via `FromRef` (the `api` crate's `AppState` does both).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/overview", get(handlers::overview))
        .route(
            "/merchant",
            get(handlers::get_merchant).put(handlers::update_merchant),
        )
        .route("/stats", get(handlers::get_stats))
        .route(
            "/payments",
            get(handlers::list_payments).post(handlers::create_payment),
        )
        .route("/payments/{id}", get(handlers::get_payment))
        .route("/keys", get(handlers::list_keys).post(handlers::create_key))
        .route("/keys/{id}/revoke", post(handlers::revoke_key))
        .route(
            "/webhooks",
            get(handlers::list_webhooks).post(handlers::create_webhook),
        )
        .route(
            "/webhooks/{id}",
            axum::routing::patch(handlers::update_webhook).delete(handlers::delete_webhook),
        )
        .route("/webhooks/{id}/rotate", post(handlers::rotate_webhook))
        .route("/public/payments/{id}", get(handlers::public_get_payment))
        .route(
            "/public/payments/{id}/payu-session",
            post(handlers::public_payu_session),
        )
        .route(
            "/public/payments/{id}/simulate",
            post(handlers::public_simulate),
        )
        .route("/public/payu-callback", post(handlers::public_callback))
        /* ── orders ──────────────────────────────────────────────────────── */
        .route(
            "/orders",
            get(entities::orders::list_handler).post(entities::orders::create_handler),
        )
        .route(
            "/orders/{id}",
            get(entities::orders::get_handler).patch(entities::orders::update_handler),
        )
        .route("/orders/{id}/payments", get(entities::orders::payments_handler))
        /* ── customers ───────────────────────────────────────────────────── */
        .route(
            "/customers",
            get(entities::customers::list_handler).post(entities::customers::create_handler),
        )
        .route(
            "/customers/{id}",
            get(entities::customers::get_handler)
                .patch(entities::customers::update_handler)
                .delete(entities::customers::delete_handler),
        )
        .route(
            "/customers/{id}/payments",
            get(entities::customers::payments_handler),
        )
        /* ── refunds ─────────────────────────────────────────────────────── */
        .route("/refunds", get(entities::refunds::list_handler))
        .route("/refunds/{id}", get(entities::refunds::get_handler))
        .route(
            "/payments/{id}/refunds",
            get(entities::refunds::list_for_payment_handler)
                .post(entities::refunds::create_handler),
        )
        /* ── webhooks: deliveries (filtered) + redeliver ─────────────────── */
        .route("/webhooks/deliveries", get(handlers::list_deliveries))
        .route(
            "/webhooks/deliveries/{id}/redeliver",
            post(handlers::redeliver_delivery),
        )
        /* ── payment links ───────────────────────────────────────────────── */
        .route(
            "/payment-links",
            get(entities::payment_links::list_handler)
                .post(entities::payment_links::create_handler),
        )
        .route(
            "/payment-links/{id}",
            get(entities::payment_links::get_handler)
                .patch(entities::payment_links::update_handler),
        )
        .route(
            "/payment-links/{id}/cancel",
            post(entities::payment_links::cancel_handler),
        )
        .route(
            "/public/links/{id}",
            get(entities::payment_links::public_view_handler),
        )
        .route(
            "/public/links/{id}/session",
            post(entities::payment_links::public_session_handler),
        )
        /* ── payment pages (literal route BEFORE {id}) ───────────────────── */
        .route(
            "/payment-pages",
            get(entities::payment_pages::list_handler)
                .post(entities::payment_pages::create_handler),
        )
        .route(
            "/payment-pages/slug-available",
            get(entities::payment_pages::slug_available_handler),
        )
        .route(
            "/payment-pages/{id}",
            get(entities::payment_pages::get_handler)
                .patch(entities::payment_pages::update_handler)
                .delete(entities::payment_pages::delete_handler),
        )
        .route(
            "/public/pages/{slug}",
            get(entities::payment_pages::public_view_handler),
        )
        .route(
            "/public/pages/{slug}/session",
            post(entities::payment_pages::public_session_handler),
        )
        /* ── plans ───────────────────────────────────────────────────────── */
        .route(
            "/plans",
            get(entities::plans::list_handler).post(entities::plans::create_handler),
        )
        .route(
            "/plans/{id}",
            get(entities::plans::get_handler).delete(entities::plans::delete_handler),
        )
        /* ── subscriptions ───────────────────────────────────────────────── */
        .route(
            "/subscriptions",
            get(entities::subscriptions::list_handler)
                .post(entities::subscriptions::create_handler),
        )
        .route(
            "/subscriptions/{id}",
            get(entities::subscriptions::get_handler)
                .patch(entities::subscriptions::update_handler),
        )
        .route(
            "/subscriptions/{id}/cancel",
            post(entities::subscriptions::cancel_handler),
        )
        .route(
            "/subscriptions/{id}/pause",
            post(entities::subscriptions::pause_handler),
        )
        .route(
            "/subscriptions/{id}/resume",
            post(entities::subscriptions::resume_handler),
        )
        /* ── invoices ────────────────────────────────────────────────────── */
        .route(
            "/invoices",
            get(entities::invoices::list_handler).post(entities::invoices::create_handler),
        )
        .route(
            "/invoices/{id}",
            get(entities::invoices::get_handler)
                .patch(entities::invoices::update_handler)
                .delete(entities::invoices::delete_handler),
        )
        .route("/invoices/{id}/issue", post(entities::invoices::issue_handler))
        .route("/invoices/{id}/cancel", post(entities::invoices::cancel_handler))
        /* ── qr codes ────────────────────────────────────────────────────── */
        .route(
            "/qr-codes",
            get(entities::qr_codes::list_handler).post(entities::qr_codes::create_handler),
        )
        .route("/qr-codes/{id}", get(entities::qr_codes::get_handler))
        .route("/qr-codes/{id}/close", post(entities::qr_codes::close_handler))
        .route(
            "/public/qr/{id}",
            get(entities::qr_codes::public_view_handler),
        )
        .route(
            "/public/qr/{id}/session",
            post(entities::qr_codes::public_session_handler),
        )
        /* ── settlements (literal route BEFORE {id}) ─────────────────────── */
        .route("/settlements", get(entities::settlements::list_handler))
        .route(
            "/settlements/summary",
            get(entities::settlements::summary_handler),
        )
        .route("/settlements/{id}", get(entities::settlements::get_handler))
        /* ── disputes ────────────────────────────────────────────────────── */
        .route("/disputes", get(entities::disputes::list_handler))
        .route("/disputes/{id}", get(entities::disputes::get_handler))
        .route("/disputes/{id}/accept", post(entities::disputes::accept_handler))
        .route(
            "/disputes/{id}/contest",
            post(entities::disputes::contest_handler),
        )
        .route("/test/disputes", post(entities::disputes::simulate_create_handler))
        /* ── internal cron (x-cron-secret self-guard) ────────────────────── */
        .route("/internal/cron/settlements", post(cron::run_settlements))
        .route("/internal/cron/subscriptions", post(cron::run_subscription_cycles))
        .route("/internal/cron/expiries", post(cron::run_expiry_sweeps))
        /* ── CSV exports ─────────────────────────────────────────────────── */
        .route("/exports/{entity}", get(exports::export_csv))
}
