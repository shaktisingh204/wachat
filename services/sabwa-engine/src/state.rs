//! Shared application state passed to every Axum handler.
//!
//! Cloning [`AppState`] is cheap — all heavy resources are reference-counted
//! (`Arc`) or already use internal `Arc` semantics (mongo/redis clients).

use std::sync::Arc;

use crate::config::Config;

/// Application-wide handles shared across HTTP handlers, middleware and
/// background tasks (scheduler, webhook dispatcher, session pool, ...).
#[derive(Clone)]
pub struct AppState {
    /// Loaded configuration. Wrapped in `Arc` so clones are O(1).
    pub config: Arc<Config>,
    /// Mongo client (already internally `Arc`-shared).
    pub mongo: mongodb::Client,
    /// Default Mongo database handle, derived from `config.mongodb_db`.
    pub db: mongodb::Database,
    /// Redis client. Per redis-rs docs the `Client` is cheap to clone and is
    /// used to create individual async connections on demand.
    pub redis: redis::Client,
}

impl AppState {
    /// Construct a new [`AppState`].
    pub fn new(
        config: Config,
        mongo: mongodb::Client,
        db: mongodb::Database,
        redis: redis::Client,
    ) -> Self {
        Self {
            config: Arc::new(config),
            mongo,
            db,
            redis,
        }
    }
}
