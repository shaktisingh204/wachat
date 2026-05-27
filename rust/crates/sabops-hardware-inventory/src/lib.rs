//! # sabops-hardware-inventory
//!
//! Hardware specs per endpoint (CPU, RAM, disk, GPU, battery). Generally
//! upserted by the agent on inventory sync; admin UI reads via the
//! endpoint-detail view.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
