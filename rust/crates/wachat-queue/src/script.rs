//! Lua script management for the producer.
//!
//! BullMQ's atomicity guarantees come from its server-side Lua scripts; we
//! follow the same pattern. The `addJob` script is embedded at compile time
//! (so the producer ships as one binary, no runtime file dependency) and
//! lazily compiled into a `fred::types::scripts::Script` (which carries the
//! SHA1 it computes locally). All EVALSHA round-trips go through fred's
//! built-in `evalsha_with_reload`, which transparently re-runs `SCRIPT LOAD`
//! if Redis returns `NOSCRIPT` (e.g. after a server restart) — so we don't
//! need to roll our own NOSCRIPT recovery.
//!
//! See `add_job.lua` for the script body and the docstring at the top of
//! that file for the BullMQ-compat caveats.

use std::sync::OnceLock;

use fred::types::scripts::Script;

/// The minimal-fallback addJob Lua script. See `add_job.lua` for the
/// docstring covering every input, output, and BullMQ-compat trade-off.
///
/// Embedded with `include_str!` so editing the `.lua` file forces a rebuild
/// — there is no risk of running an outdated script in production.
pub const ADD_JOB_LUA: &str = include_str!("add_job.lua");

/// Consumer-side scripts. See the matching `.lua` files for the contracts.
pub const MOVE_TO_ACTIVE_LUA: &str = include_str!("move_to_active.lua");
pub const MOVE_TO_COMPLETED_LUA: &str = include_str!("move_to_completed.lua");
pub const MOVE_TO_FAILED_LUA: &str = include_str!("move_to_failed.lua");
pub const STALLED_CHECK_LUA: &str = include_str!("stalled_check.lua");

/// Process-global `Script` handles. `Script::from_lua` precomputes the SHA1
/// in pure Rust (via fred's `sha-1` feature) so this initialisation does
/// no I/O — the first EVALSHA call is what actually loads the script
/// server-side, and `evalsha_with_reload` retries with `SCRIPT LOAD` on
/// `NOSCRIPT`.
static ADD_JOB_SCRIPT: OnceLock<Script> = OnceLock::new();
static MOVE_TO_ACTIVE_SCRIPT: OnceLock<Script> = OnceLock::new();
static MOVE_TO_COMPLETED_SCRIPT: OnceLock<Script> = OnceLock::new();
static MOVE_TO_FAILED_SCRIPT: OnceLock<Script> = OnceLock::new();
static STALLED_CHECK_SCRIPT: OnceLock<Script> = OnceLock::new();

/// Returns the cached `Script` for `add_job.lua`. Cheap (one OnceLock read);
/// safe to call on every `BullProducer::add` invocation.
#[inline]
pub fn add_job_script() -> &'static Script {
    ADD_JOB_SCRIPT.get_or_init(|| Script::from_lua(ADD_JOB_LUA))
}

/// Returns the cached `Script` for `move_to_active.lua`.
#[inline]
pub fn move_to_active_script() -> &'static Script {
    MOVE_TO_ACTIVE_SCRIPT.get_or_init(|| Script::from_lua(MOVE_TO_ACTIVE_LUA))
}

/// Returns the cached `Script` for `move_to_completed.lua`.
#[inline]
pub fn move_to_completed_script() -> &'static Script {
    MOVE_TO_COMPLETED_SCRIPT.get_or_init(|| Script::from_lua(MOVE_TO_COMPLETED_LUA))
}

/// Returns the cached `Script` for `move_to_failed.lua`.
#[inline]
pub fn move_to_failed_script() -> &'static Script {
    MOVE_TO_FAILED_SCRIPT.get_or_init(|| Script::from_lua(MOVE_TO_FAILED_LUA))
}

/// Returns the cached `Script` for `stalled_check.lua`.
#[inline]
pub fn stalled_check_script() -> &'static Script {
    STALLED_CHECK_SCRIPT.get_or_init(|| Script::from_lua(STALLED_CHECK_LUA))
}
