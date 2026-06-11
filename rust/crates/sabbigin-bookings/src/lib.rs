//! # sabbigin-bookings
//!
//! HTTP surface for **SabBigin** (lite CRM SKU) booking pages.
//!
//! A booking page is a tenant-owned, publicly-bookable scheduling surface — a
//! Calendly-style page with a slug, a title, weekly availability windows, a
//! duration/buffer, and an optional intake question set. Each page is scoped to
//! the owning user and stored in `sabbigin_booking_pages`. The TS side
//! (`src/lib/rust-client/sabbigin-bookings.ts`) exposes the standard
//! `list / getById / getBySlug / create / update / delete` shape.
//!
//! Routes (mount under `/v1/sabbigin/bookings`):
//!
//! ```text
//! GET    /            — list_pages   (tenant-scoped)
//! POST   /            — create_page
//! GET    /slug/{slug} — get_by_slug  (find by {userId, slug})
//! GET    /{pageId}    — get_page
//! PATCH  /{pageId}    — update_page
//! DELETE /{pageId}    — delete_page  (soft → status: archived)
//! ```
//!
//! TODO (integrator): mount in `rust/crates/api/src/router.rs`:
//!
//! ```ignore
//! let sabbigin_bookings_r = sabbigin_bookings::router::<AppState>();
//! .nest("/v1/sabbigin/bookings", sabbigin_bookings_r)
//! ```
//!
//! TODO (workspace): add `"crates/sabbigin-bookings"` to the `members` list in
//! `rust/Cargo.toml`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
