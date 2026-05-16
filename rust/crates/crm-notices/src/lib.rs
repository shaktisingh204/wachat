//! # crm-notices
//!
//! HTTP surface for the Notice entity — formal company notices distinct from
//! casual announcements. Carries title + body + category + severity, optional
//! effective window, recipient targeting, acknowledgement tracking, and a
//! status lifecycle (`draft` → `issued` → `acknowledged` → `superseded` → `archived`).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
