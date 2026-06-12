//! # crm-core
//!
//! Cross-cutting CRM/HRM types per `crm_function_plan.md` §0. Every
//! CRM/HRM entity DTO in the Rust port composes these structs (via
//! `#[serde(flatten)]`) so ownership, audit, lifecycle, assignment, and
//! attribution are wired uniformly across modules.
//!
//! This crate is the kickoff for the Rust CRM backend. It defines the
//! structural fragments §0 enumerates — nothing entity-specific. Each
//! domain crate (`crm-leads`, `crm-deals`, `crm-invoices`, …) flattens
//! these fragments into its own DTOs.
//!
//! ## Distinction from `wachat-types`
//!
//! `wachat-types` mirrors WhatsApp-business document shapes. `crm-core`
//! defines **shared structural fragments** that every CRM entity inherits;
//! it carries no entity-specific shapes.
//!
//! ## Modules
//! - [`identity`] — `_id`, `projectId`, `userId`, `tenantId`
//! - [`audit`] — `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
//! - [`lifecycle`] — `status`, `priority`, `archived`, `deletedAt`
//! - [`assignment`] — `assignedTo`, `teamId`, `pipelineId`, `stageId`
//! - [`attribution`] — `source`, `referrerId`, `campaignId`, `utm{...}`
//! - [`tagging`] — `tags[]`
//! - [`note`] — structured note timeline entry
//! - [`attachment`] — SabFile reference
//! - [`custom_fields`] — `customFields{}` opaque bag
//!
//! ## Conventions
//!
//! - All structs derive `Serialize + Deserialize` with `rename_all =
//!   "camelCase"` so they round-trip with the existing TypeScript
//!   `src/lib/definitions.ts` document shapes.
//! - `_id` and FK fields are `bson::oid::ObjectId`. Timestamps are
//!   `chrono::DateTime<Utc>` (BSON interop via the `chrono-0_4` feature).
//! - Optional fields use `#[serde(skip_serializing_if = "Option::is_none")]`
//!   so we never write `null` placeholders to Mongo.
//! - This crate carries **no I/O, no business logic, no async**. Adding
//!   behaviour here is a layering violation — put it in the consuming crate.

pub mod assignment;
pub mod attachment;
pub mod attribution;
pub mod audit;
pub mod custom_fields;
pub mod identity;
pub mod lifecycle;
pub mod lineage;
pub mod note;
pub mod scope;
pub mod tagging;

pub use assignment::Assignment;
pub use attachment::Attachment;
pub use attribution::{Attribution, Utm};
pub use audit::Audit;
pub use custom_fields::CustomFields;
pub use identity::Identity;
pub use lifecycle::{Lifecycle, Priority, SoftDelete, Status};
pub use lineage::{LineageRef, append_lineage, build_lineage_from_parent};
pub use note::Note;
pub use scope::{ScopeMode, TenantScope, sabcrm_project_oid};
pub use tagging::Tags;
