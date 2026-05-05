//! `wachat-templates-sync` — Meta WABA → Mongo template synchroniser.
//!
//! ## What this slice owns
//!
//! Pulling the full set of approved/pending message templates from a project's
//! WhatsApp Business Account (WABA) on Meta Graph API and upserting them into
//! the local Mongo `templates` collection. This is a one-shot, idempotent
//! operation: it can be triggered manually from the dashboard ("Sync from
//! Meta") or by a periodic worker.
//!
//! ## TS source of truth
//!
//! Mirrors [`handleSyncTemplates`](../../../src/app/actions/template.actions.ts)
//! at line ~40. In particular:
//!
//! 1. `GET /{wabaId}/message_templates?access_token=...&fields=name,components,
//!    language,status,category,id,quality_score&limit=100` (the TS uses
//!    `limit=100`, *not* `200` — the prompt suggests 200 but we honor TS).
//! 2. Iterates `response.data[]`.
//! 3. For each Meta template, builds a Mongo document with the same fields
//!    as the TS (`name`, `category`, `language`, `status`, `body`,
//!    `projectId`, `metaId`, `components`, `qualityScore`, `headerSampleUrl`)
//!    and upserts on `{ projectId, metaId }`.
//! 4. Pagination follows `paging.next` URL exactly as Meta returns it
//!    (Meta embeds the cursor + access_token in that URL — we **do not**
//!    reconstruct it from `cursors.after`).
//! 5. **Orphan handling**: the TS does **not** delete or flag local
//!    templates whose `metaId` is no longer present on Meta. It only ever
//!    upserts. We preserve that behavior here — the `orphaned` count in
//!    `SyncOutcome` is purely observational (computed but **never written
//!    back to Mongo**), so callers get visibility without us silently
//!    diverging from TS.
//!
//! ## Public surface
//!
//! ```no_run
//! use wachat_templates_sync::TemplatesSyncer;
//! use wachat_meta_client::MetaClient;
//! # async fn demo(mongo: sabnode_db::MongoHandle, project: wachat_types::Project) -> anyhow::Result<()> {
//! let meta = MetaClient::new("v22.0");
//! let syncer = TemplatesSyncer::new(mongo, meta);
//! let token = project.access_token.clone().unwrap_or_default();
//! let outcome = syncer.sync(&project, &token).await?;
//! println!("fetched={} upserted={} orphaned={}",
//!          outcome.fetched, outcome.upserted, outcome.orphaned);
//! # Ok(()) }
//! ```

pub mod syncer;

pub use syncer::{SyncOutcome, TemplatesSyncer};
