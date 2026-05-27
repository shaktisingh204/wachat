//! # sabvault-folders
//!
//! HTTP surface for the SabVault folder hierarchy. Folders group secrets;
//! ownership is per-user. Mount under `/v1/sabvault/folders`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
