//! # sabrequests-orgcharts
//!
//! Per-tenant "manager-of" map used by Request blueprints whose
//! `approverKind = "manager_of_requester"`. One document per tenant
//! (i.e. one per `userId` in single-tenant mode); each doc carries a
//! `managerOf` map from user id → manager user id.
//!
//! Backing collection: `requests_orgcharts`. Looked up by
//! `userId == AuthUser.user_id` and (optionally) `orgId` when the
//! tenant maintains multiple org charts (rare).
//!
//! The map is small (hundreds of entries) and the access pattern is
//! "given a requester, find their manager" — a single document with an
//! object field is the cheapest possible storage.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
