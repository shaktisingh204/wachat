//! # sabrequests-blueprints
//!
//! Zoho Qntrl-equivalent **Blueprint** entity for the §Requests &
//! Approval Orchestration module. A blueprint is the template that
//! describes:
//!
//! - Which fields the requester fills in (`formSchema` — opaque JSON
//!   shaped by the form-builder UI).
//! - The ordered list of approval `stages` (each stage names an
//!   approver-resolver — user / role / "manager-of-requester" /
//!   conditional — and an SLA in minutes).
//! - Routing rules (`routingRules` — optional decision branches that
//!   choose a starting stage based on form values).
//! - The owning team (`ownerTeamId`) for RBAC / "blueprints I can
//!   manage" filtering.
//!
//! Backing Mongo collection: `requests_blueprints`. The Blueprint DTO
//! flattens `Identity` / `Audit` / `Assignment` from `crm-core` so the
//! document root carries `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! All Mongo queries are scoped by `userId == AuthUser.user_id` (the
//! tenant root — `crm-core::Identity.user_id`).
//!
//! ## Soft delete
//!
//! `DELETE` sets `archived = true` and stamps `deletedAt`. Blueprints
//! are load-bearing for historical request audit; we never lose the
//! document.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
