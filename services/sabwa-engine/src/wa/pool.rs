//! Session pool — keeps one [`WaSession`] per linked WhatsApp account.
//!
//! The pool is the single entry point through which routes and background
//! workers talk to a live WhatsApp client. It is intentionally tiny: a
//! map from `session_id -> Arc<dyn WaSession>` guarded by an
//! `RwLock`, plus a factory so we can instantiate sessions lazily.
//!
//! ## Cloneability
//!
//! `SessionPool` is `Clone` (cheap — every field is wrapped in `Arc`)
//! so it can be embedded inside `AppState` or any handler that wants
//! to call into it.
//!
//! ## Global handle
//!
//! Until `AppState` grows a `pool: SessionPool` field, the convenience
//! free functions ([`request_pair`], [`send_message`], [`logout`]) reach
//! the pool via a process-wide [`OnceLock`]. Call [`install`] once
//! at boot (typically inside `main.rs`) before the HTTP server starts
//! accepting traffic.

use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use tokio::sync::RwLock;

use crate::state::AppState;

use super::errors::WaError;
use super::session::{
    PairRequest, PairResponse, SendRequest, SendResponse, SessionStatusDto, WaSession,
    WaSessionFactory,
};

/// Process-wide pool handle. `None` until [`install`] is called.
static POOL: OnceLock<SessionPool> = OnceLock::new();

/// Install the global session pool. Must be called exactly once at boot —
/// repeated installs are silently ignored (the first wins). The `AppState`
/// field will eventually replace this: leaving the OnceLock in place for
/// Phase 1 so existing route code can compile without an `AppState`
/// schema migration.
pub fn install(pool: SessionPool) {
    if POOL.set(pool).is_err() {
        tracing::warn!(
            target: "sabwa_engine::wa::pool",
            "pool::install called more than once — ignoring later installs"
        );
    }
}

/// Read-only accessor for the global pool. Returns a reference rather than
/// a clone because `SessionPool` is already cheap to clone.
pub fn global() -> Option<&'static SessionPool> {
    POOL.get()
}

/// One pool per process. Cheap to clone (everything is behind `Arc`).
#[derive(Clone)]
pub struct SessionPool {
    factory: Arc<dyn WaSessionFactory>,
    sessions: Arc<RwLock<HashMap<String, Arc<dyn WaSession>>>>,
}

impl SessionPool {
    /// Create a fresh, empty pool wired to the given factory.
    pub fn new(factory: Arc<dyn WaSessionFactory>) -> Self {
        Self {
            factory,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Look up `session_id` — if it isn't in the pool yet, build a new
    /// session via the factory (optionally hydrated from `auth_state`)
    /// and insert it.
    pub async fn get_or_create(
        &self,
        session_id: &str,
        auth_state: Option<Vec<u8>>,
    ) -> anyhow::Result<Arc<dyn WaSession>> {
        // Fast path: already cached.
        {
            let guard = self.sessions.read().await;
            if let Some(existing) = guard.get(session_id) {
                return Ok(Arc::clone(existing));
            }
        }

        // Slow path: build outside the lock, then double-check under the
        // write lock to avoid duplicate inserts under contention.
        let built = self
            .factory
            .create(session_id.to_string(), auth_state)
            .await?;

        let mut guard = self.sessions.write().await;
        if let Some(existing) = guard.get(session_id) {
            // Lost the race — discard our freshly-built session and reuse
            // the one another task already inserted.
            return Ok(Arc::clone(existing));
        }
        guard.insert(session_id.to_string(), Arc::clone(&built));
        Ok(built)
    }

    /// Drop a session from the pool. Does NOT call `logout()` on the
    /// underlying client — callers that want a full logout should call
    /// `session.logout().await` first.
    pub async fn remove(&self, session_id: &str) -> Option<Arc<dyn WaSession>> {
        self.sessions.write().await.remove(session_id)
    }

    /// Snapshot of every session currently held by the pool. Cheap because
    /// it just clones `Arc`s.
    pub async fn iter(&self) -> Vec<(String, Arc<dyn WaSession>)> {
        self.sessions
            .read()
            .await
            .iter()
            .map(|(id, sess)| (id.clone(), Arc::clone(sess)))
            .collect()
    }
}

// ---------- Free-function helpers used by routes ----------
//
// These let routes call into the pool with one line of code and without
// caring whether the pool lives on `AppState` or on the static
// `OnceLock`. When `AppState` grows a `pool: SessionPool` field, swap the
// `global()` lookup for `state.pool.clone()` — call sites do not change.

/// Begin pairing on a session, creating the session in the pool first if
/// necessary.
pub async fn request_pair(
    state: &AppState,
    session_id: &str,
    req: PairRequest,
) -> Result<PairResponse, WaError> {
    let _ = state; // reserved for future use (e.g. authz, mongo lookups)
    let pool = require_pool()?;
    let session = pool
        .get_or_create(session_id, None)
        .await
        .map_err(WaError::Other)?;
    session.start_pair(req).await
}

/// Send a message through a session. The session must already be paired.
pub async fn send_message(
    state: &AppState,
    session_id: &str,
    req: SendRequest,
) -> Result<SendResponse, WaError> {
    let _ = state;
    let pool = require_pool()?;
    let session = pool
        .get_or_create(session_id, None)
        .await
        .map_err(WaError::Other)?;
    if !session.is_connected().await {
        return Err(WaError::NotPaired);
    }
    session.send(req).await
}

/// Log a session out and evict it from the pool.
pub async fn logout(state: &AppState, session_id: &str) -> Result<(), WaError> {
    let _ = state;
    let pool = require_pool()?;
    if let Some(session) = pool.remove(session_id).await {
        session.logout().await?;
    } else {
        tracing::warn!(
            target: "sabwa_engine::wa::pool",
            session_id = %session_id,
            "logout called on unknown session — already gone?"
        );
    }
    Ok(())
}

/// Best-effort live status snapshot for a session.
///
/// Looks up `session_id` in the global pool. If we have a live session
/// object we project its connection flag onto the wire shape; otherwise we
/// return `pending` so the browser keeps polling while the worker spins up.
pub async fn status(
    state: &AppState,
    session_id: &str,
) -> Result<SessionStatusDto, WaError> {
    let _ = state;
    let pool = match global() {
        Some(p) => p,
        None => {
            return Ok(SessionStatusDto {
                status: "pending".into(),
                qr: None,
                pair_code: None,
                last_connected_at: None,
            });
        }
    };
    // Scan the snapshot without forcing get_or_create (which would mint a
    // brand-new session and skew the apparent state).
    let snapshot = pool.iter().await;
    let found = snapshot.into_iter().find(|(id, _)| id == session_id);
    match found {
        Some((_, session)) => {
            let connected = session.is_connected().await;
            Ok(SessionStatusDto {
                status: if connected { "connected" } else { "pending" }.into(),
                qr: None,
                pair_code: None,
                last_connected_at: None,
            })
        }
        None => Ok(SessionStatusDto {
            status: "pending".into(),
            qr: None,
            pair_code: None,
            last_connected_at: None,
        }),
    }
}

fn require_pool() -> Result<&'static SessionPool, WaError> {
    global().ok_or_else(|| {
        WaError::Other(anyhow::anyhow!(
            "wa::pool::install has not been called — pool is not available"
        ))
    })
}
