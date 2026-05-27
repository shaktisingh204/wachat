//! # sabbackstage-sponsors
//!
//! HTTP surface for the SabBackstage Sponsor entity. Each row binds
//! a sponsor name + tier + SabFiles logo to a host event in
//! `crm_events`. Surfaces on the public sponsors page grouped by
//! tier and ordered by `orderRank`.
//!
//! Backs the `sabbackstage_sponsors` collection. Admin routes mount
//! at `/v1/sabbackstage/sponsors`. Public list by-event lives at
//! `/public/by-event/:eventId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
