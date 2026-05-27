//! # sabwebinar-registrations
//!
//! HTTP surface for the SabWebinar `Registration` entity — captured by the
//! public landing-page form. The public **create** endpoint (POST by slug)
//! is unauthenticated; host-scoped list/get/update endpoints require auth.
//!
//! Mongo collection: `sabwebinar_registrations`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_registrations::router()` under
//! `/v1/sabwebinar/registrations`. The public reg-by-slug POST is
//! `POST /public/by-slug/:slug`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
