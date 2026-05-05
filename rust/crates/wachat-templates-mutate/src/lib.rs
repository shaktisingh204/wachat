//! # wachat-templates-mutate
//!
//! Create / edit / delete WhatsApp message templates against the Meta
//! Graph API. This crate is the Rust port of the **mutating** handlers
//! in the TypeScript `src/app/actions/template.actions.ts`:
//!
//! | TS function                  | TS line ~ | Rust API                              |
//! | ---------------------------- | --------- | ------------------------------------- |
//! | `handleCreateTemplate`       |  163      | [`TemplatesMutator::create`]          |
//! | `handleBulkCreateTemplate`   |  511      | [`TemplatesMutator::bulk_create`]     |
//! | `handleCreateFlowTemplate`   |  649      | [`TemplatesMutator::create_flow`]     |
//! | `handleEditTemplate`         |  884      | [`TemplatesMutator::edit`]            |
//! | `handleDeleteTemplate`       | 1009      | [`TemplatesMutator::delete_by_name`]  |
//! | `handleDeleteTemplateById`   | 1052      | [`TemplatesMutator::delete_by_id`]    |
//!
//! ## Read-side: see `wachat-templates-engine` and the Phase 3 slice 1
//! reader. This crate **only mutates**.
//!
//! ## Meta API URL inventory
//!
//! Every Meta call routed through this crate (the TS counterparts are
//! pinned to `API_VERSION = 'v22.0'` in `template.actions.ts` line 19,
//! but we accept any version supplied to [`MetaClient::new`]):
//!
//! * `POST {version}/{wabaId}/message_templates`             — create   (TS L463-473)
//! * `POST {version}/{wabaId}/message_templates`             — flow create (TS L692-696)
//! * `POST {version}/{metaTemplateId}`                       — edit     (TS L970-980)
//! * `DELETE {version}/{wabaId}/message_templates?name=…`    — delete by name  (TS L1021-1027)
//! * `DELETE {version}/{metaTemplateId}`                     — delete by id    (TS L1060-1066)
//!
//! Bodies are byte-equivalent to the TS payloads — see [`mutator`]
//! for the per-call construction.
//!
//! ## What this crate is NOT
//!
//! * It does **not** validate the request shape against
//!   `createTemplateSchema` (the TS Zod schema). The caller (HTTP route
//!   layer) is responsible for input validation; this crate trusts the
//!   `CreateTemplateRequest` it receives.
//! * It does **not** load `Project` from Mongo — the caller passes a
//!   borrowed `&Project` so the same project lookup can be reused
//!   across multiple template ops in one request.
//! * It does **not** touch `revalidatePath` (Next-only concern).

#![forbid(unsafe_code)]

pub mod dto;
pub mod mutator;

pub use dto::{
    BulkCreateOutcome, BulkError, CreateFlowTemplateRequest, CreateTemplateRequest,
    EditTemplateRequest, HeaderFormat, HeaderMedia, TemplateButton,
};
pub use mutator::TemplatesMutator;
