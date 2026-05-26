//! # crm-kb-categories
//!
//! HTTP surface for Knowledge Base Category nodes (tree). Each row carries
//! `name`, `slug`, optional `parentId` (adjacency-list nesting), display
//! `order`, `visibility` (internal/portal/public), and a denormalized
//! `articleCount`. Mounted at `/v1/crm/kb-categories`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
