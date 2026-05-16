//! # crm-project-categories
//!
//! HTTP surface for the Project Category foundational categorization master.
//! Referenced by projects. Reads/writes the `crm_project_categories` Mongo
//! collection. Supports hierarchical categories via `parentId` and explicit
//! `displayOrder` for sortable lists.
//!
//! ## Per-tenant unique name
//! Among non-archived categories for a given `userId`, `name` is unique.
//! Validation runs on create and on rename.
//!
//! ## Soft delete
//! `DELETE /v1/crm/project-categories/:id` sets `status: "archived"` (and
//! flips `isActive` off) rather than removing the row so referenced projects
//! stay valid.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
