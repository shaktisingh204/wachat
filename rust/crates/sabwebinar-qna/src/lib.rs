//! # sabwebinar-qna
//!
//! HTTP surface for the SabWebinar `QnaItem` entity — audience questions
//! with host answers and upvotes. Public ask/upvote endpoints are
//! unauthenticated.
//!
//! Mongo collection: `sabwebinar_qna`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_qna::router()` under `/v1/sabwebinar/qna`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
