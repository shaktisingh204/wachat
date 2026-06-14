//! `TemplatesSyncer` — port of `handleSyncTemplates` (TS line ~40).
//!
//! ## Algorithm
//!
//! ```text
//! GET /{wabaId}/message_templates?access_token=...&fields=...&limit=100
//!  └→ for each `data[]` row: build doc → update_one({projectId, metaId}, $set, upsert=true)
//!  └→ if `paging.next`: GET that exact URL (raw — already includes access_token + cursor)
//!     └→ repeat until `paging.next` is None.
//! ```
//!
//! ## Orphan handling
//!
//! The TS implementation **does not touch** local templates that are absent
//! from the Meta response. Quoting `src/app/actions/template.actions.ts`
//! (lines 97–106 — the only Mongo writes the function performs):
//!
//! ```text
//! const bulkOps = templatesToUpsert.map(template => ({
//!     updateOne: {
//!         filter: { metaId: template.metaId, projectId: template.projectId },
//!         update: { $set: template },
//!         upsert: true,
//!     }
//! }));
//! const result = await db.collection('templates').bulkWrite(bulkOps);
//! ```
//!
//! There is **no `deleteMany`**, **no `$set: { orphaned: true }`**, and
//! **no second pass** over local-only docs. We replicate that behavior:
//! `SyncOutcome.orphaned` is computed for observability only and never
//! written to Mongo.

use std::collections::HashSet;

use bson::{Bson, Document, doc, oid::ObjectId};
use mongodb::{Collection, options::UpdateOptions};
use serde_json::Value as JsonValue;
use tracing::{debug, info, warn};

use sabnode_common::ApiError;
use sabnode_db::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_meta_dto::{ListTemplatesResp, TemplateRecord};
use wachat_types::Project;

/// Meta Graph API version used by the TS source of truth (`API_VERSION = 'v22.0'`).
const META_API_VERSION: &str = "v25.0";

/// Page size — matches the TS code (`limit=100` on the initial URL, line 50).
const PAGE_SIZE: u32 = 100;

/// Field set requested from Meta. Matches the TS `?fields=` query string
/// at line 50:
///
/// ```text
/// fields=name,components,language,status,category,id,quality_score
/// ```
const FIELDS: &str = "name,components,language,status,category,id,quality_score";

/// Mongo collection name (TS: `db.collection('templates')`).
const COLLECTION: &str = "templates";

/// Result of one sync pass — counters only, no template payloads.
///
/// * `fetched` — number of `TemplateRecord`s pulled across all pages.
/// * `upserted` — number of `update_one`s issued (matches TS `bulkOps.length`,
///   i.e. equal to `fetched` on success). Each represents either an insert
///   or an in-place update.
/// * `orphaned` — local docs whose `metaId` was **not** in the Meta response.
///   Reported for observability; **never written to Mongo** because the TS
///   does not touch orphans.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SyncOutcome {
    pub fetched: usize,
    pub upserted: usize,
    pub orphaned: usize,
}

/// Pulls templates from Meta and writes them into Mongo.
///
/// Cheap to clone — `MongoHandle` and `MetaClient` are both `Arc`-wrapped
/// internally. Construct once and share across requests/workers.
#[derive(Debug, Clone)]
pub struct TemplatesSyncer {
    mongo: MongoHandle,
    meta: MetaClient,
    /// HTTP client used **only** for the `paging.next` follow-ups, which
    /// are fully-qualified URLs (Meta embeds `?access_token=...&after=...`).
    /// We deliberately do not push these back through `MetaClient` because
    /// `MetaClient::get_json` would re-prepend `base/version`. Same reason
    /// the TS uses raw `fetch(nextUrl)` at line 53.
    http: reqwest::Client,
}

impl TemplatesSyncer {
    /// Construct a new syncer. The `MetaClient` is used for the **first**
    /// page; subsequent pages follow `paging.next` URLs verbatim.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent(concat!(
                "sabnode-wachat-templates-sync/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .expect("reqwest client must build with default config");
        Self { mongo, meta, http }
    }

    /// Run a full sync for `project`. Walks every `paging.next` page, then
    /// upserts each fetched template into `templates`. Idempotent: running
    /// twice in a row on an unchanged WABA produces zero net Mongo writes
    /// (the second `update_one` matches but mutates nothing).
    pub async fn sync(
        &self,
        project: &Project,
        access_token: &str,
    ) -> Result<SyncOutcome, ApiError> {
        let waba_id = project.waba_id.as_deref().ok_or_else(|| {
            ApiError::BadRequest("project has no wabaId — embedded signup not completed".to_owned())
        })?;
        if access_token.is_empty() {
            return Err(ApiError::BadRequest(
                "missing Meta access token for template sync".to_owned(),
            ));
        }

        let project_id = project.id;
        let coll: Collection<Document> = self.mongo.collection::<Document>(COLLECTION);

        // ---- fetch every page -------------------------------------------------
        let mut all: Vec<TemplateRecord> = Vec::new();

        // Page 1 goes through MetaClient (gets retry/backoff for the first
        // call, which is the most common failure point).
        let path = format!(
            "{waba_id}/message_templates?fields={FIELDS}&limit={PAGE_SIZE}&access_token={token}",
            waba_id = waba_id,
            FIELDS = FIELDS,
            PAGE_SIZE = PAGE_SIZE,
            token = access_token,
        );
        debug!(
            project_id = %project_id,
            waba_id,
            "templates-sync: fetching first page via MetaClient"
        );
        // Note: `MetaClient::get_json` adds an `Authorization: Bearer ...`
        // header; the `?access_token=` in the query is harmless duplication
        // (Meta accepts either) and matches the TS exactly.
        let first: ListTemplatesResp = self.meta.get_json(&path, access_token).await?;
        all.extend(first.data);
        let mut next_url: Option<String> = first.paging.and_then(|p| p.next);

        // Subsequent pages: follow Meta's `paging.next` URL verbatim. These
        // URLs already embed `access_token` + cursor; reconstructing them
        // from `cursors.after` would race Meta's signed cursor format.
        while let Some(url) = next_url.take() {
            debug!(
                project_id = %project_id,
                "templates-sync: following paging.next"
            );
            let resp = self.http.get(&url).send().await.map_err(|e| {
                ApiError::Internal(anyhow::anyhow!(
                    "templates-sync: paging.next GET failed: {e}"
                ))
            })?;
            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                // Mirror TS line 56-63 — surface Meta's `error.message` if
                // the body parses, otherwise the raw status.
                let message = serde_json::from_str::<JsonValue>(&body)
                    .ok()
                    .and_then(|v| {
                        v.get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_owned())
                    })
                    .unwrap_or_else(|| {
                        format!(
                            "Could not parse error response from Meta. Status: {} {}",
                            status.as_u16(),
                            status.canonical_reason().unwrap_or("")
                        )
                    });
                return Err(ApiError::BadRequest(format!(
                    "Failed to fetch templates from Meta: {message}"
                )));
            }
            let page: ListTemplatesResp = resp.json().await.map_err(|e| {
                ApiError::Internal(anyhow::anyhow!(
                    "templates-sync: paging.next decode failed: {e}"
                ))
            })?;
            all.extend(page.data);
            next_url = page.paging.and_then(|p| p.next);
        }

        let fetched = all.len();
        if fetched == 0 {
            info!(
                project_id = %project_id,
                "templates-sync: Meta returned 0 templates — nothing to upsert"
            );
            return Ok(SyncOutcome::default());
        }

        // ---- upsert each template --------------------------------------------
        // Mirrors the TS `bulkWrite` block (lines 79-105). We issue one
        // `update_one` per template — same logical primitive as the TS
        // `bulkOps`, just unbatched. mongodb 3.2's bulkWrite API is more
        // ceremony than payoff for the typical ≤200 template payload here.
        let mut seen_meta_ids: HashSet<String> = HashSet::with_capacity(fetched);
        let mut upserted = 0usize;
        for tpl in &all {
            seen_meta_ids.insert(tpl.id.clone());
            let set_doc = build_template_doc(project_id, tpl)?;
            let filter = doc! {
                "metaId": &tpl.id,
                "projectId": project_id,
            };
            let update = doc! { "$set": set_doc };
            let opts = UpdateOptions::builder().upsert(true).build();
            coll.update_one(filter, update)
                .with_options(opts)
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::anyhow!(
                        "templates-sync: Mongo upsert failed for metaId {}: {e}",
                        tpl.id
                    ))
                })?;
            upserted += 1;
        }

        // ---- orphan accounting (observation only — TS does NOT mutate) -------
        // Quote of `template.actions.ts` lines 97-105 (verified above): only
        // `updateOne` with `upsert: true` is issued. No `deleteMany`, no
        // `$set: { orphaned: true }`. We compute a count for telemetry and
        // log it, but never write back.
        let orphaned = match count_orphans(&coll, project_id, &seen_meta_ids).await {
            Ok(n) => n,
            Err(e) => {
                // Don't fail the whole sync just because the observational
                // count failed — the upserts already succeeded and the TS
                // doesn't even compute this number.
                warn!(
                    project_id = %project_id,
                    error = %e,
                    "templates-sync: orphan-count query failed; treating as 0",
                );
                0
            }
        };

        info!(
            project_id = %project_id,
            fetched, upserted, orphaned,
            "templates-sync: complete"
        );

        Ok(SyncOutcome {
            fetched,
            upserted,
            orphaned,
        })
    }
}

/// Build the `$set` document for one template. Field-for-field parity with
/// the TS `templatesToUpsert.map(...)` block (lines 79-95).
fn build_template_doc(project_id: ObjectId, tpl: &TemplateRecord) -> Result<Document, ApiError> {
    // BODY component → `body` text (TS: `bodyComponent?.text || ''`).
    let body = find_component(&tpl.components, "BODY")
        .and_then(|c| c.get("text").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_owned();

    // Media HEADER component → header sample URL (TS: lines 81 + 93).
    let header_sample_url = find_media_header(&tpl.components).and_then(|c| {
        c.get("example")
            .and_then(|e| e.get("header_handle"))
            .and_then(|h| h.as_array())
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str())
            .map(|handle| format!("https://graph.facebook.com/{handle}"))
    });

    // qualityScore: TS does `t.quality_score?.score?.toUpperCase() || 'UNKNOWN'`.
    let quality_score = tpl
        .quality_score
        .as_ref()
        .and_then(|qs| qs.get("score"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_ascii_uppercase())
        .unwrap_or_else(|| "UNKNOWN".to_owned());

    // Components are stored as the raw Meta wire shape (TS keeps
    // `t.components` verbatim). bson can take serde_json::Value via try_from.
    let components_bson = bson::to_bson(&tpl.components).map_err(|e| {
        ApiError::Internal(anyhow::anyhow!(
            "templates-sync: failed to encode components for {}: {e}",
            tpl.id
        ))
    })?;

    let mut d = doc! {
        "name": &tpl.name,
        "category": &tpl.category,
        "language": &tpl.language,
        "status": &tpl.status,
        "body": body,
        "projectId": project_id,
        "metaId": &tpl.id,
        "components": components_bson,
        "qualityScore": quality_score,
    };
    // TS sets `headerSampleUrl: undefined` when not present, which Mongo
    // serializes as the field being **absent**. Match that — only insert
    // the field when we have a value.
    if let Some(url) = header_sample_url {
        d.insert("headerSampleUrl", Bson::String(url));
    }
    Ok(d)
}

/// First component matching the requested `type`. Components are open-ended
/// JSON, so this is a linear scan + field lookup.
fn find_component<'a>(components: &'a [JsonValue], ty: &str) -> Option<&'a JsonValue> {
    components
        .iter()
        .find(|c| c.get("type").and_then(|t| t.as_str()) == Some(ty))
}

/// First HEADER component whose `format` is one of the media formats the TS
/// pulls a sample URL from (lines 81): `IMAGE | VIDEO | DOCUMENT`.
fn find_media_header(components: &[JsonValue]) -> Option<&JsonValue> {
    components.iter().find(|c| {
        let is_header = c.get("type").and_then(|t| t.as_str()) == Some("HEADER");
        let fmt = c.get("format").and_then(|f| f.as_str()).unwrap_or("");
        is_header && matches!(fmt, "IMAGE" | "VIDEO" | "DOCUMENT")
    })
}

/// Count local templates for `project_id` whose `metaId` is **not** in the
/// `seen` set. Observational only — never used to mutate.
async fn count_orphans(
    coll: &Collection<Document>,
    project_id: ObjectId,
    seen: &HashSet<String>,
) -> Result<usize, ApiError> {
    // Mongo's `$nin` accepts an array of strings; if `seen` is huge this
    // could become a large query, but the realistic upper bound is a few
    // hundred templates per WABA.
    let nin: Vec<Bson> = seen.iter().map(|s| Bson::String(s.clone())).collect();
    let filter = doc! {
        "projectId": project_id,
        // Only count docs that *have* a metaId (locally-drafted templates
        // with no metaId aren't orphans — they've never been to Meta).
        "metaId": { "$exists": true, "$nin": nin, "$ne": "" },
    };
    let count = coll.count_documents(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::anyhow!(
            "templates-sync: orphan count query failed: {e}"
        ))
    })?;
    Ok(count as usize)
}

// `META_API_VERSION` is documented for future readers but isn't used at
// runtime — the version on the wire is whatever the caller passed to
// `MetaClient::new(...)`. We keep the constant so the TS source of truth
// (`API_VERSION = 'v22.0'`) is visible from this file.
#[allow(dead_code)]
const _META_API_VERSION_DOC: &str = META_API_VERSION;
