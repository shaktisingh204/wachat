//! # pagesense-form-analytics
//!
//! Form-level analytics — one row per `(siteId, formSelector)` capturing
//! per-field dropoff counts and an overall completion rate.
//!
//! Mongo collection: `pagesense_form_analytics`.
//!
//! TODO: the snippet does not yet emit `form_focus` / `form_blur` /
//! `form_submit` events. Until it does, rows are seeded via the
//! dashboard "create form analytics" CTA and stay zeroed.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
