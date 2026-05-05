//! # wachat-templates
//!
//! **Read** side of the wachat templates module — Phase 3, slice 1 of the
//! SabNode TS-to-Rust port.
//!
//! This crate is intentionally narrow. It exposes a single struct,
//! [`TemplatesReader`], that wraps a [`sabnode_db::mongo::MongoHandle`] and
//! returns deserialized DTOs from two MongoDB collections:
//!
//! | Crate API                       | TS source                                                                            | Mongo collection     |
//! | ------------------------------- | ------------------------------------------------------------------------------------ | -------------------- |
//! | [`TemplatesReader::list`]       | `getTemplates(projectId)` in `src/app/actions/template.actions.ts` (line ~21)         | `templates`          |
//! | [`TemplatesReader::get_by_id`]  | (helper, not in TS — derived from the same `{ projectId, _id }` pattern)              | `templates`          |
//! | [`TemplatesReader::list_library`] | `getLibraryTemplates()` in `src/app/actions/template.actions.ts` (line ~796)        | `library_templates`  |
//!
//! ## Filter doc parity
//!
//! The TS uses these filters verbatim — we reproduce them byte-for-byte so
//! the ported handlers stay drop-in compatible with the Node app reading the
//! same data:
//!
//! ```text
//! list:        { projectId: ObjectId(...) }                sort { createdAt: -1 }
//! get_by_id:   { projectId: ObjectId(...), _id: ObjectId(...) }
//! list_library: {}                                          sort { name: 1 }
//! ```
//!
//! ## What this crate is **not**
//!
//! * No writes — `handleSyncTemplates`, `handleEditTemplate`,
//!   `handleApplyTemplateToProjects`, etc. land in later slices.
//! * No Meta API calls.
//! * No `premadeTemplates` merge. The TS prepends an in-process constant
//!   array (`[...premadeTemplates, ...customTemplates]`) before returning;
//!   that fallback list belongs in a config crate / data file in a later
//!   slice. This reader returns only the Mongo-backed rows.
//! * No `revalidatePath` — that's a Next.js concern.

mod library_dto;
mod reader;

pub use library_dto::LibraryTemplate;
pub use reader::TemplatesReader;
