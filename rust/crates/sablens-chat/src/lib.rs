//! # sablens-chat
//!
//! In-session text chat for a SabLens session. Attachments are SabFiles
//! fileIds — never raw URLs.
//!
//! Mongo collection: `sablens_chat`. Mount under `/v1/sablens/chat`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
