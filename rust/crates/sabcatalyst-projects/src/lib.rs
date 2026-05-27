//! # sabcatalyst-projects
//!
//! Owns the top-level tenancy unit of the SabCatalyst BaaS surface.
//! Every other SabCatalyst entity (functions, tables, records, auth
//! users, file-store keys, API keys, domains, usage rollups) hangs off
//! a `projectId` that points at a row in `sabcatalyst_projects`.
//!
//! HTTP surface mounted under `/v1/sabcatalyst/projects` from the
//! orchestrating `api` crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystProjectsState;
pub use types::{ProjectRuntime, ProjectStatus, SabcatalystProject};

/// Mongo collection that backs the project entity.
pub const PROJECTS_COLL: &str = "sabcatalyst_projects";
