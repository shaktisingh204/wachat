//! # developer-webhooks
//!
//! Control plane for outbound webhooks. Owns:
//!
//!   - `webhook_subscriptions` — tenant-scoped subscription rows.
//!   - `webhook_deliveries`     — per-attempt delivery log.
//!
//! The Node `webhook-worker` process is the data plane — it reads
//! pending deliveries off a BullMQ queue (`webhook-deliveries`), signs
//! them with HMAC-SHA256 keyed by `subscription.secret`, posts to the
//! subscriber URL, and writes the attempt result back into
//! `webhook_deliveries`. Both sides share collections so the dashboard
//! `/dashboard/api/webhooks` UI can see deliveries created by the
//! worker without any sync step.
//!
//! ## Routes
//!
//! ```ignore
//! .nest("/v1/developer-webhooks", developer_webhooks::router::<AppState>())
//! ```
//!
//! | Method | Path                       | Purpose                              |
//! | ------ | -------------------------- | ------------------------------------ |
//! | POST   | `/subscriptions`            | Create a subscription (returns secret once). |
//! | GET    | `/subscriptions`            | List subscriptions for the tenant.           |
//! | GET    | `/subscriptions/{id}`       | Fetch one.                                   |
//! | PATCH  | `/subscriptions/{id}`       | Update url/events/status.                    |
//! | DELETE | `/subscriptions/{id}`       | Remove the subscription (cascades to active deliveries). |
//! | POST   | `/subscriptions/{id}/test`  | Enqueue a synthetic test delivery.           |
//! | GET    | `/deliveries`               | List recent deliveries.                      |
//! | POST   | `/deliveries/{id}/retry`    | Force a retry of a failed delivery.          |

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

pub use state::DeveloperWebhooksState;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

/// Build the `/v1/developer-webhooks` router.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/subscriptions",
            get(handlers::list_subs).post(handlers::create_sub),
        )
        .route(
            "/subscriptions/{sub_id}",
            get(handlers::get_sub)
                .patch(handlers::update_sub)
                .delete(handlers::delete_sub),
        )
        .route(
            "/subscriptions/{sub_id}/test",
            post(handlers::test_sub),
        )
        .route("/deliveries", get(handlers::list_deliveries))
        .route("/deliveries/{delivery_id}/retry", post(handlers::retry_delivery))
}
