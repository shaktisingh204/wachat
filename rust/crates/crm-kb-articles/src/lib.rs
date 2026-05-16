//! # crm-kb-articles
//!
//! HTTP surface for Knowledge Base Article entity. Title/body/slug/
//! category/tags/visibility/status/helpfulCount/viewCount.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
