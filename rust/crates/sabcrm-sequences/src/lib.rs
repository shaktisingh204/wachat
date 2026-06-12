//! # sabcrm-sequences
//!
//! Axum router for **SabCRM**'s sequences (cadences) surface over the MongoDB
//! `sabcrm_sequences` + `sabcrm_sequence_enrollments` collections. Mounted
//! under `/v1/sabcrm/sequences` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/sequences", sabcrm_sequences::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action                        | HTTP route                          |
//! |----------------------------------|-------------------------------------|
//! | `listSabcrmSequences`            | `GET    /`                          |
//! | `createSabcrmSequence`           | `POST   /`                          |
//! | `listSabcrmSequenceEnrollments`  | `GET    /enrollments`               |
//! | `unenrollSabcrmEnrollment`       | `POST   /enrollments/{id}/unenroll` |
//! | `getSabcrmSequence`              | `GET    /{id}`                      |
//! | `updateSabcrmSequence`           | `PATCH  /{id}`                      |
//! | `deleteSabcrmSequence`           | `DELETE /{id}`                      |
//! | `enrollSabcrmSequence`           | `POST   /{id}/enroll`               |
//!
//! ## Documents
//!
//! A sequence definition (HubSpot/Close-style cadence):
//!
//! ```text
//! { _id, projectId, name, status: "active" | "paused",
//!   steps: [ { id, kind: "email" | "task" | "wait",
//!              email?: { templateId?, subject?, body? },
//!              task?: { title, dueInDays? },
//!              waitDays? } ],
//!   settings: { unenrollOnReply: bool (default true),
//!               unenrollOnStageChange?: [stageId, ...] },
//!   createdAt, updatedAt }
//! ```
//!
//! An enrollment (one record's progress through one sequence):
//!
//! ```text
//! { _id, projectId, sequenceId, objectSlug, recordId,
//!   currentStepIndex, status: "active" | "completed" | "unenrolled" | "failed",
//!   nextRunAt, enrolledBy, history: [ { stepId, at, outcome } ],
//!   createdAt, updatedAt }
//! ```
//!
//! **Execution** is NOT here: the SabCRM scheduler tick
//! (`src/lib/sabcrm/scheduler.ts`, invoked by `/api/cron/sabcrm-workflows`)
//! pops due enrollments (`status: "active"`, `nextRunAt <= now`), executes the
//! current step (email via the tenant transport + `sabcrm-templates`
//! interpolation; task via `sabcrm-activities`; wait by advancing `nextRunAt`)
//! and advances `currentStepIndex`. Auto-unenroll (reply / stage change) lives
//! in `src/lib/sabcrm/sequences.server.ts`.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint; the caller's `user_id` is captured as `enrolledBy` on enroll.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
