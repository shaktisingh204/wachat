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

pub mod dto;
pub mod handlers;
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
}
