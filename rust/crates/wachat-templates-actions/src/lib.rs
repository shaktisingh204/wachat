//! # wachat-templates-actions
//!
//! Server-Action-shaped facade over the Wachat WhatsApp template engines.
//!
//! Mirrors `src/app/actions/template.actions.ts` — every endpoint here
//! returns a payload that drops directly into a Next.js `useActionState`
//! reducer (`{ message?, error?, … }`) so the TS shim layer is one line
//! per function with no shape massaging.
//!
//! ## Why a separate crate from `wachat-templates-router`?
//!
//! The existing `wachat-templates-router` crate exposes RESTful
//! engine-shaped responses (`Template`, `SyncResponse { fetched,
//! upserted, orphaned }`, `ApplyLibraryResponse { applied, skipped }`,
//! …). The TS Server Actions returned a different shape historically
//! (`{ message: 'Successfully synced N…', count }`, `{ success, applied,
//! skipped, error }`) and many call sites depend on those exact strings.
//! Rather than add action-state shape concerns to the canonical REST
//! router, we keep them isolated here so the OpenAPI surface stays
//! clean and this crate can be removed once the call sites migrate to
//! the canonical router.
//!
//! ## Scope
//!
//! The 12 server actions in `template.actions.ts`:
//!
//! | Action TS fn                           | Endpoint here                                   |
//! | -------------------------------------- | ----------------------------------------------- |
//! | `getTemplates`                         | `GET  /list?project_id=…`                       |
//! | `handleSyncTemplates`                  | `POST /sync`                                    |
//! | `handleCreateTemplate`                 | `POST /create`                                  |
//! | `handleBulkCreateTemplate`             | `POST /bulk-create`                             |
//! | `handleCreateFlowTemplate`             | `POST /create-flow`                             |
//! | `saveLibraryTemplate`                  | `POST /library/save`                            |
//! | `deleteLibraryTemplate`                | `POST /library/{id}/delete`                     |
//! | `getLibraryTemplates`                  | `GET  /library/list`                            |
//! | `handleApplyTemplateToProjects`        | `POST /library/{source_id}/apply`               |
//! | `handleEditTemplate`                   | `POST /edit`                                    |
//! | `handleDeleteTemplate`                 | `POST /delete-by-name`                          |
//! | `handleDeleteTemplateById`             | `POST /delete-by-id`                            |
//!
//! Routes are mounted **relative**; the API crate nests them under
//! `/v1/wachat/templates-actions`.

pub mod dto;
pub mod handlers;
pub mod multilang;
pub mod router;
pub mod state;

pub use router::router;
pub use state::WachatTemplatesActionsState;
