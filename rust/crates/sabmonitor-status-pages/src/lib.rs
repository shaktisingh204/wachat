//! # sabmonitor-status-pages
//!
//! Branded public status pages. Owners CRUD their pages via the
//! authenticated `router()` mounted at `/v1/sabmonitor/status-pages`.
//! Anonymous readers fetch via `public_router()` mounted at
//! `/v1/sabmonitor/status-pages-public/{slug}` (no auth required).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{public_router, router};
