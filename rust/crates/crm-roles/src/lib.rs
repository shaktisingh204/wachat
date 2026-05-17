//! # crm-roles
//!
//! HTTP surface for the Role entity (per-tenant role + permission registry).
//! Each role carries `{ name, slug, displayName, description, isAdmin,
//! permissions }`, where `permissions` is a map keyed by the module keys
//! defined in `src/lib/permission-modules.ts`. Each value carries the four
//! standard CRUD flags `{ view, create, edit, delete }`.
//!
//! Reads/writes `crm_roles`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
