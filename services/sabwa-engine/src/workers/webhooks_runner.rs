//! Thin shim that owns the lifecycle of the webhook dispatcher.
//!
//! The actual delivery / retry logic lives in
//! [`crate::webhooks::dispatcher`]. This module exists so `workers::mod`
//! can treat every long-running task uniformly: each has a single
//! `pub async fn run(state) -> anyhow::Result<()>` entry point.

use crate::state::AppState;

/// Run the webhook dispatcher until it exits (which only happens on a
/// fatal error). Wraps [`crate::webhooks::dispatcher::Dispatcher::new`] +
/// [`crate::webhooks::dispatcher::Dispatcher::run`].
pub async fn run(state: AppState) -> anyhow::Result<()> {
    crate::webhooks::dispatcher::Dispatcher::new(state).run().await
}
