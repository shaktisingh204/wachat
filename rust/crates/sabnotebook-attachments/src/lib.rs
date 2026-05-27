//! # sabnotebook-attachments
//!
//! HTTP surface for SabNotebook **Attachment** entities — SabFiles records
//! linked to a note. Each row references the SabFiles file id (no inline
//! URL paste) and carries a kind discriminator (`image` | `audio` | `video`
//! | `file`).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
