//! SabNode common utilities: shared error type, configuration loader, and
//! tracing subscriber initialization. Re-exported here so downstream crates
//! can `use sabnode_common::{ApiError, Result, Settings, tracing_init};`.

pub mod config;
pub mod error;
pub mod tracing_init;

pub use config::{Settings, load as load_settings};
pub use error::{ApiError, ErrorBody, ErrorEnvelope, Result};
