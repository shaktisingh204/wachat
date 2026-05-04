//! Process-wide application state shared with every handler.
//!
//! Cloneable because Axum requires `State` to be `Clone`. The handles inside
//! are themselves cheap to clone (each is `Arc`-backed).
//!
//! `FromRef` impls below let domain crates ask for the specific handle they
//! need (e.g. `State<MongoHandle>`) without depending on this concrete type.

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use axum::extract::FromRef;
use chrono::{DateTime, Utc};
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};

#[derive(Clone)]
pub struct AppState {
    pub started_at: DateTime<Utc>,
    pub mongo: MongoHandle,
    pub redis: RedisHandle,
    pub auth: Arc<AuthConfig>,
    pub ready: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(mongo: MongoHandle, redis: RedisHandle, auth: Arc<AuthConfig>) -> Self {
        Self {
            started_at: Utc::now(),
            mongo,
            redis,
            auth,
            ready: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn mark_ready(&self) {
        self.ready.store(true, Ordering::SeqCst);
    }

    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }
}

impl FromRef<AppState> for MongoHandle {
    fn from_ref(s: &AppState) -> Self {
        s.mongo.clone()
    }
}

impl FromRef<AppState> for RedisHandle {
    fn from_ref(s: &AppState) -> Self {
        s.redis.clone()
    }
}

impl FromRef<AppState> for Arc<AuthConfig> {
    fn from_ref(s: &AppState) -> Self {
        s.auth.clone()
    }
}
