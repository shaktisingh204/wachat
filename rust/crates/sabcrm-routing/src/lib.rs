//! # sabcrm-routing
//!
//! Axum router for **SabCRM**'s assignment-routing surface over the MongoDB
//! `sabcrm_routing_rules` collection. Mounted under `/v1/sabcrm/routing`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/routing", sabcrm_routing::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action                  | HTTP route        |
//! |----------------------------|-------------------|
//! | `listSabcrmRoutingRules`   | `GET    /`        |
//! | `createSabcrmRoutingRule`  | `POST   /`        |
//! | `evaluateSabcrmRouting`    | `POST   /evaluate`|
//! | `getSabcrmRoutingRule`     | `GET    /{id}`    |
//! | `updateSabcrmRoutingRule`  | `PATCH  /{id}`    |
//! | `deleteSabcrmRoutingRule`  | `DELETE /{id}`    |
//!
//! ## Document
//!
//! ```text
//! { _id, projectId, name, objectSlug,
//!   trigger: "record.created" | "form.submission",
//!   conditions: [ { field, operator, value? } ],   // workflow operator set
//!   strategy: "round_robin" | "least_assigned" | "fixed",
//!   assignees: [memberId, ...],
//!   assignField: "owner" (default),
//!   active: bool, position: i64 (priority order),
//!   lastAssignedIndex: i64 (round-robin cursor),
//!   createdAt, updatedAt }
//! ```
//!
//! `POST /evaluate { objectSlug, recordId, trigger? }` walks the project's
//! active rules for that object slug + trigger in `position` order, evaluates
//! each rule's conditions against the record's `data` map, and applies the
//! FIRST match: an assignee is chosen per the rule's strategy and written to
//! the record's `data.<assignField>` in `sabcrm_records`. Round-robin
//! persists its rotation atomically (`find_one_and_update` + `$inc`), so
//! concurrent evaluations never hand two records the same turn.
//!
//! Callers:
//! - `record.created` — `src/lib/sabcrm/runtime.ts` evaluates routing BEFORE
//!   firing `record.created` workflows so the assignment is visible to
//!   workflow conditions;
//! - `form.submission` — `convertSabcrmSubmissionToRecord` in
//!   `src/app/actions/sabcrm-forms.actions.ts` evaluates after the converted
//!   record is created.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
