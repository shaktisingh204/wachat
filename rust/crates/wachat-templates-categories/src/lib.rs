//! # wachat-templates-categories
//!
//! **Write** side of the wachat *library / catalog* templates module —
//! Phase 3, slice 4 of the SabNode TS-to-Rust port.
//!
//! This crate ports the three admin-facing write endpoints from
//! `src/app/actions/template.actions.ts`:
//!
//! | Crate API                                  | TS source                                   | Mongo collection      |
//! | ------------------------------------------ | ------------------------------------------- | --------------------- |
//! | [`TemplatesLibrary::save`]                 | `saveLibraryTemplate`         (line ~731)   | `library_templates`   |
//! | [`TemplatesLibrary::delete`]               | `deleteLibraryTemplate`       (line ~776)   | `library_templates`   |
//! | [`TemplatesLibrary::apply_to_projects`]    | `handleApplyTemplateToProjects` (line ~808) | `templates` (R/W)     |
//!
//! ## Collection-name parity
//!
//! The slice prompt suggested `template_library`. **The TS uses
//! `library_templates`** — see lines 764, 784, 799 of
//! `template.actions.ts`. We honor the TS so the Rust port stays drop-in
//! compatible with rows the Node app has already written.
//!
//! ## Apply-to-projects dedup rule
//!
//! `apply_to_projects` reads a single source row from the **per-project**
//! `templates` collection (not the library) and copies it into N target
//! projects' `templates` rows. It uses a Mongo `bulkWrite` of `updateOne`
//! upserts; the upsert filter is **`{ projectId, name, language }`** — see
//! TS line 861:
//!
//! ```text
//! filter: { projectId: projectObjectId, name: sourceTemplate.name, language: sourceTemplate.language }
//! ```
//!
//! Effect: a target project that already has a template with the same
//! `(name, language)` gets its row **updated in place** rather than a
//! duplicate inserted; a target that does not get a fresh insert via
//! `upsert: true`. The TS's reported `applied`/`skipped` counts are derived
//! from the auth check, not the upsert outcome — we mirror that semantic.
//!
//! ## Auth scope
//!
//! The TS `saveLibraryTemplate` / `deleteLibraryTemplate` are admin-gated
//! (`getAdminSession()`); `handleApplyTemplateToProjects` calls
//! `getProjectById` per source/target. Auth is **not** enforced here — those
//! checks are session-scoped and live in the HTTP handler crate that wraps
//! us. `apply_to_projects` therefore takes a pre-validated
//! `target_project_ids: &[ObjectId]` rather than raw strings.
//!
//! ## What this crate is **not**
//!
//! * No HTTP routing, no session lookup, no `revalidatePath`.
//! * No premade-template merge — the read sibling (`wachat-templates`)
//!   handles the public read path.
//! * No Meta API calls. `apply_to_projects` writes `status: "LOCAL"` and
//!   clears `metaId` exactly like the TS so the existing template-sync cron
//!   picks them up later.

mod dto;
mod library;

pub use dto::{ApplyOutcome, LibraryTemplateId, SaveLibraryTemplateReq};
pub use library::TemplatesLibrary;

/// Mongo collection that backs the admin library pool.
///
/// Public so the wrapping HTTP crate can also use it for cache-tag plumbing
/// without re-typing the literal.
pub const LIBRARY_TEMPLATES_COLLECTION: &str = "library_templates";

/// Mongo collection that backs per-project templates. `apply_to_projects`
/// reads + writes here.
pub const TEMPLATES_COLLECTION: &str = "templates";
