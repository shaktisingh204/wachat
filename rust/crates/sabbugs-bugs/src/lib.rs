//! # sabbugs-bugs
//!
//! HTTP surface for the internal SabBugs `Bug` entity. Scoped per
//! `userId`. Reuses `crm_projects` for project linkage — bugs link to a
//! `projectId` (Mongo `ObjectId`) defined elsewhere; this crate does not
//! own the project model.
//!
//! Mongo collection: `sabbugs_bugs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
