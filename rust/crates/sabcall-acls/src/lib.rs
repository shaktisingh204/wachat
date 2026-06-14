//! # sabcall-acls
//!
//! HTTP surface for the Voice SIP ACL (IP access-control list) entity.
//! An ACL identifies a named rule — its action (allow/deny), the set of
//! CIDRs it matches, what traffic it applies to (trunk/registration/all)
//! and its enabled status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
