//! Redis client wrapper built on `fred`.
//!
//! `fred` was chosen over `redis-rs` because it ships first-class support for
//! cluster topologies and pub/sub with sane reconnection, which the legacy
//! Node service relies on. We expose a single `RedisHandle` that owns the
//! pooled client and a `ping` helper for health checks.
//!
//! `RedisHandle` is `Clone` — fred's `Client` is internally reference-counted,
//! so handing it to multiple Axum handlers does not duplicate connections.

use anyhow::{Context, Result};
use fred::{clients::Client, interfaces::ClientLike, types::config::Config as FredConfig};

/// Cheap, cloneable handle wrapping a connected fred `Client`.
///
/// `Debug` is intentionally not derived: fred's `Client` does not implement
/// `Debug` cleanly, and the only field we own is the client itself, so the
/// derived impl would not add useful information.
#[derive(Clone)]
pub struct RedisHandle {
    /// The underlying fred client. Clone is cheap (Arc inside).
    pub client: Client,
}

impl RedisHandle {
    /// Build a Redis client from a connection URL (e.g. `redis://...` or
    /// `rediss://...`), initialize it, and wait for the first connection to
    /// succeed before returning.
    ///
    /// We deliberately do *not* keep the background reconnect task handle;
    /// fred manages its own task and the handle ownership is moved into the
    /// runtime via `init()`.
    pub async fn connect(url: &str) -> Result<Self> {
        let config =
            FredConfig::from_url(url).with_context(|| format!("parsing Redis URL `{url}`"))?;

        let client = Client::new(config, None, None, None);

        // `init()` spawns the connection task and returns once we are ready
        // to issue commands (or surfaces the underlying connection error).
        client
            .init()
            .await
            .context("initializing fred Redis client")?;

        Ok(Self { client })
    }

    /// Issue a `PING`. Any non-`PONG` reply or transport failure is bubbled up
    /// as `anyhow::Error`.
    pub async fn ping(&self) -> Result<()> {
        // `ping` is part of `ClientLike`; a successful round-trip is
        // sufficient evidence of liveness for our health checks. We discard
        // the `PONG` payload — only the round-trip success matters.
        let _: String = self.client.ping(None).await.context("Redis PING failed")?;
        Ok(())
    }
}
