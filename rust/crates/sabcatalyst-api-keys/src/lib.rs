//! SabCatalyst project API keys. Mounted at
//! `/v1/sabcatalyst/api-keys`. Plaintext secret is generated TS-side
//! and shown to the user exactly once; only the SHA-256 hash lives in
//! Mongo.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystApiKeysState;
pub use types::{ApiKeyScope, ApiKeyStatus, SabcatalystApiKey};

pub const API_KEYS_COLL: &str = "sabcatalyst_api_keys";
