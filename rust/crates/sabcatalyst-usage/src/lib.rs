//! SabCatalyst per-project usage aggregates. Mounted at
//! `/v1/sabcatalyst/usage`. The TS-side function executor + invocation
//! logger calls `POST /increment` after each run to keep the daily and
//! monthly rollups current.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystUsageState;
pub use types::{SabcatalystUsage, UsagePeriod};

pub const USAGE_COLL: &str = "sabcatalyst_usage";
