//! SabCatalyst end-user identity store. Mounted at
//! `/v1/sabcatalyst/auth-users`. Plaintext passwords never reach this
//! crate — TS callers send pre-hashed values.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystAuthUsersState;
pub use types::{AuthUserStatus, SabcatalystAuthUser};

pub const AUTH_USERS_COLL: &str = "sabcatalyst_auth_users";
