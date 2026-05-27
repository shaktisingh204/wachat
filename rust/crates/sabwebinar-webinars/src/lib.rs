//! # sabwebinar-webinars
//!
//! HTTP surface for the SabWebinar module `Webinar` entity — a one-to-many
//! live broadcast with registration funnel, branded landing page, live
//! stream, and post-event recording. Distinct from SabMeet (group meetings).
//!
//! Scoped per `userId` (host). Public read-by-slug for the landing page is
//! unauthenticated. Mongo collection: `sabwebinar_webinars`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_webinars::router()` under `/v1/sabwebinar/webinars`
//! in the api crate. The public-read route is the `/by-slug/:slug` GET.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
