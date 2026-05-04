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

/// Process-global `Script` handle. `Script::from_lua` precomputes the SHA1
/// in pure Rust (via fred's `sha-1` feature) so this initialisation does
/// no I/O — the first EVALSHA call is what actually loads the script
/// server-side, and `evalsha_with_reload` retries with `SCRIPT LOAD` on
/// `NOSCRIPT`.
static SCRIPT: OnceLock<Script> = OnceLock::new();

/// Returns the cached `Script` for `add_job.lua`. Cheap (one OnceLock read);
/// safe to call on every `BullProducer::add` invocation.
#[inline]
pub fn add_job_script() -> &'static Script {
    SCRIPT.get_or_init(|| Script::from_lua(ADD_JOB_LUA))
}
