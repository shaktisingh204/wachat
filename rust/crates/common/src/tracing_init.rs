//! Tracing subscriber bootstrap.
//!
//! - In `dev`: human-readable pretty layer.
//! - Anywhere else (`staging`, `prod`, ...): structured JSON layer suitable
//!   for log aggregators.
//!
//! The `EnvFilter` honors `RUST_LOG` if set; otherwise it falls back to a
//! sane default (`info,sabnode_=debug`).

use tracing_subscriber::{EnvFilter, fmt, prelude::*};

/// Initialize the global tracing subscriber. Safe to call once at process
/// startup; calling it twice will panic by design (tracing's contract).
pub fn init(env: &str) {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sabnode_=debug"));

    let registry = tracing_subscriber::registry().with(filter);

    if env == "dev" {
        registry
            .with(
                fmt::layer()
                    .pretty()
                    .with_target(true)
                    .with_thread_ids(false)
                    .with_thread_names(false),
            )
            .init();
    } else {
        registry
            .with(
                fmt::layer()
                    .json()
                    .with_current_span(true)
                    .with_span_list(false)
                    .with_target(true),
            )
            .init();
    }
}
