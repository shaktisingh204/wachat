//! SabCatalyst end-user session tokens. Mounted at
//! `/v1/sabcatalyst/auth-sessions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystAuthSessionsState;
pub use types::SabcatalystAuthSession;

pub const SESSIONS_COLL: &str = "sabcatalyst_auth_sessions";
