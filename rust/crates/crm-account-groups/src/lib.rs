//! # crm-account-groups
//!
//! HTTP surface for the Account Group entity — chart-of-accounts grouping
//! (asset / liability / income / expense / equity). Each group can carry an
//! optional ledger code and an optional parent group id for hierarchy.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
