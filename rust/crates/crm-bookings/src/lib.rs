//! # crm-bookings
//!
//! HTTP surface for the §12.12 Booking + BookingResource entities —
//! resource catalog (rooms, equipment, staff calendars) plus the
//! customer-held slots booked against them. Sibling business-logic
//! crate to `crm-leads`, `crm-subscriptions`, …; follows the same
//! conventions:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shapes
//!   are the canonical [`crm_extras_types::Booking`] /
//!   [`crm_extras_types::BookingResource`] from the §12.12 types crate;
//!   we never redeclare them here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`]
//!   as their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/bookings`. The
//!   resource catalog is nested under `/resources/*`; the slots
//!   themselves under `/bookings/*`.
//!
//! ## Mongo
//!
//! Two backing collections:
//!
//! | Collection                | Stores            |
//! |---------------------------|-------------------|
//! | `crm_booking_resources`   | `BookingResource` |
//! | `crm_bookings`            | `Booking`         |
//!
//! Both DTOs flatten `Identity` + `Audit` from `crm-core` so the
//! document root carries `_id`, `userId`, `projectId`, `createdAt`, …
//! directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Booking history is load-bearing for occupancy
//! / utilisation reports, so we never lose it. The list endpoints
//! exclude `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Bookings are root-of-chain documents — they don't originate from a
//! parent CRM record (a customer + resource pair is sufficient). The
//! create endpoints therefore expose **no** `fromKind` / `fromId`
//! hooks.
//!
//! ## Lifecycle endpoints
//!
//! In addition to the five standard CRUD endpoints per entity, the
//! booking surface exposes two dedicated lifecycle helpers (HTTP
//! `POST` because they mutate state and are not idempotent in the
//! "stamp now" sense):
//!
//! - `POST /bookings/{id}/check-in` — flip `status` to `completed` and
//!   stamp the check-in moment via `updatedAt`. Used when the customer
//!   actually shows up and the slot is consumed.
//! - `POST /bookings/{id}/cancel` — flip `status` to `cancelled`. The
//!   slot is freed for re-booking; the row stays for audit.
//!
//! See [`handlers::check_in_booking`] and [`handlers::cancel_booking`].

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
