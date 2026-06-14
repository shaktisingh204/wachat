//! SabCall voice engine — library surface.
//!
//! A standalone Rust service that drives Asterisk via ARI: it runs the Stasis
//! call loop, generates `pjsip.conf` from the SabCall resource model, originates
//! outbound calls, and writes CDRs back to Mongo. Gated by `SABCALL_ENABLED`.

pub mod ari;
pub mod auth;
pub mod cdr;
pub mod config;
pub mod db;
pub mod errors;
pub mod flow;
pub mod http;
pub mod pjsip;
pub mod routing;
pub mod stasis;
pub mod state;
pub mod verbs;

pub use config::EngineConfig;
pub use state::AppState;
