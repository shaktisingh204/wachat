//! SabCatalyst custom domains for project HTTP functions. Mounted at
//! `/v1/sabcatalyst/domains`. Verification + SSL issuance is handled
//! out-of-band; this crate just tracks state.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystDomainsState;
pub use types::{SabcatalystDomain, SslStatus};

pub const DOMAINS_COLL: &str = "sabcatalyst_domains";
