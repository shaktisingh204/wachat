//! # sabmeet-qna
//!
//! Q&A submissions during a SabMeet meeting. Attendees post questions, hosts /
//! cohosts answer them inline. Optional upvotes for ranking.
//!
//! Mongo collection: `meet_qna`.
//!
//! TODO(integrator): add to workspace `members` and mount under `/v1/sabmeet/qna`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
