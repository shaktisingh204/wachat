//! # sablens-annotations
//!
//! Spatial annotations drawn by the technician on the customer's camera
//! view. Geometry is stored in normalized (0..1) coordinates so the same
//! annotation re-projects across device aspect ratios.
//!
//! Mongo collection: `sablens_annotations`. Mount under
//! `/v1/sablens/annotations`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
