//! # sabprep-profiles
//!
//! Column-profile snapshots for a row-set: per-column type guess, null
//! count, distinct count, numeric min/max/mean, top-N value frequencies,
//! and a list of "suggested cleansing" chips (Trim, Lowercase, Standardize
//! Phone, etc.) the UI uses to one-click add cleaning steps.
//!
//! Routes (mount at `/v1/sabprep/profiles`):
//! ```text
//! GET    /              — list_profiles (by datasetId)
//! POST   /              — create_profile (compute + persist for a dataset)
//! POST   /compute       — ad-hoc compute (rows in body, no persist)
//! GET    /{profileId}   — get_profile
//! DELETE /{profileId}   — delete_profile
//! ```

pub mod compute;
pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
pub use compute::profile_rows;
