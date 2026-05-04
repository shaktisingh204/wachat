//! Lua script management for the token-bucket limiter.
//!
//! The acquire script is embedded at compile time (via `include_str!`) so the
//! limiter ships as one binary with no runtime file dependency. On first use
//! we lazily `SCRIPT LOAD` it into Redis and keep the resulting `Script`
//! handle (which carries the SHA1) cached in a process-global `OnceLock`.
//!
//! Why lazy + cached:
//!   * Subsequent `EVALSHA` calls are one round-trip with the server-side
//!     compiler bypassed entirely.
//!   * If Redis is restarted (script cache flushed), `EVALSHA` returns
//!     `NOSCRIPT`; the caller in `bucket.rs` catches this, drops the cache
//!     via `reload_after_noscript`, and retries once.
//!
//! The cache is a single `OnceLock<Mutex<Option<Script>>>` because every
//! `RedisHandle` clone shares the same underlying `fred::clients::Client`
//! (it's `Arc`-backed). One global cache is therefore correct even when
//! many `TokenBucket` instances exist.

use std::sync::OnceLock;

use fred::{clients::Client, types::scripts::Script};
use tokio::sync::Mutex;

/// The acquire Lua script. See `acquire.lua` for the contract — every input,
/// output, and the wire-compat caveats with the existing Node limiter.
///
/// Embedded with `include_str!` so editing the `.lua` file forces a rebuild
/// — there is no risk of running an outdated script in production.
pub const ACQUIRE_LUA: &str = include_str!("acquire.lua");

/// Process-global cache of the loaded `Script`. fred's `Script` holds the
/// SHA1 and dispatches via `EVALSHA` on every `evalsha` call.
static SCRIPT_CELL: OnceLock<Mutex<Option<Script>>> = OnceLock::new();

/// Returns a fred `Script` for `acquire.lua`, loading it into Redis on first
/// use. Subsequent calls reuse the cached SHA so we avoid re-shipping the
/// script body on every acquire.
///
/// Callers should funnel both initial use and post-`NOSCRIPT` reloads
/// through this function to avoid drifting between the cached digest and
/// what the server actually has.
pub async fn acquire_script(client: &Client) -> Result<Script, fred::error::Error> {
    let cell = SCRIPT_CELL.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock().await;

    if let Some(script) = guard.as_ref() {
        return Ok(script.clone());
    }

    // First use against this Redis. `Script::from_lua` computes the SHA
    // locally; `.load()` ships the body via `SCRIPT LOAD` so subsequent
    // `EVALSHA` calls succeed.
    let script = Script::from_lua(ACQUIRE_LUA);
    script.load(client).await?;

    *guard = Some(script.clone());
    Ok(script)
}

/// Force a re-load of the script. Called after `EVALSHA` returns `NOSCRIPT`
/// because Redis was restarted (or `SCRIPT FLUSH` was run). Drops the
/// cached digest so the next `acquire_script` call goes back through
/// `SCRIPT LOAD`.
pub async fn reload_after_noscript(client: &Client) -> Result<Script, fred::error::Error> {
    if let Some(cell) = SCRIPT_CELL.get() {
        let mut guard = cell.lock().await;
        *guard = None;
    }
    acquire_script(client).await
}
