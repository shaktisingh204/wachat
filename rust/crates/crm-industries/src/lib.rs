//! # crm-industries
//!
//! HTTP surface for the Industry classification master entity. Industries
//! are tenant-scoped taxonomy values referenced by accounts, contacts, and
//! leads for segmentation and reporting.
//!
//! ## Schema
//! Documents live in the `crm_industries` Mongo collection. Each row
//! carries `name` (required), optional `slug`, optional `parentId` for
//! nesting, `description`, the boolean `isActive`, and a `status`
//! discriminator (`"active"` | `"archived"`).
//!
//! ## Soft delete
//! `DELETE /v1/crm/industries/:id` flips `status` to `"archived"` and
//! clears `isActive` rather than removing the row so accounts/contacts
//! that already reference the industry stay valid.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
