//! # developer-api-usage
//!
//! Read-only analytics over `apiRequestLog`. Mounted at `/v1/usage`.
//!
//! | Method | Path           | Purpose                                    |
//! | ------ | -------------- | ------------------------------------------ |
//! | GET    | `/summary`     | Aggregate counters for a time window.      |
//! | GET    | `/top`         | Top N endpoints by request count.          |
//! | GET    | `/by-key`      | Per-key counters (rows = API keys).        |
//! | GET    | `/logs`        | Cursor-paginated raw log explorer.         |

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

pub use state::DeveloperApiUsageState;

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/summary", get(handlers::summary))
        .route("/top", get(handlers::top))
        .route("/by-key", get(handlers::by_key))
        .route("/logs", get(handlers::logs))
}
