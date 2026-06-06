//! HTTP handlers for the wachat contacts **export + sync** domain.
//!
//! These back the "Export CSV" button and the "Sync Contacts" dialog on
//! the `/wachat/contacts` page. They operate on the **real** existing
//! `contacts` collection (NOT `wa_contacts`) — the two-store gotcha — so
//! exported / synced rows are the same ones the contacts list reads.
//!
//! | Endpoint                                | Action                         |
//! |-----------------------------------------|--------------------------------|
//! | `GET  /v1/wachat/contacts-export-sync/export`        | stream CSV         |
//! | `POST /v1/wachat/contacts-export-sync/sync/vcard`    | parse + upsert vCard |
//! | `POST /v1/wachat/contacts-export-sync/sync/google`   | gated (ext. seam)  |
//! | `POST /v1/wachat/contacts-export-sync/sync/shopify`  | gated (ext. seam)  |
//!
//! ## Tenancy
//!
//! Every endpoint requires the [`AuthUser`] extractor and runs the
//! **owner-or-agent** project guard ([`load_project_with_membership`])
//! before reading or writing any project-scoped data — identical to the
//! guard used by `wachat-contacts`. We never return another tenant's
//! rows.

use axum::{
    Json,
    extract::{Query, State},
    http::{StatusCode, header},
    response::Response,
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ExportQuery, IntegrationSyncBody, SyncResponse, VcardSyncBody};
use crate::external::{self, ExternalContact, Provider};
use crate::state::WachatContactsExportSyncState;

/// Real existing collections — the two-store gotcha: contacts live in
/// `contacts`, NOT `wa_contacts`.
const CONTACTS_COLL: &str = "contacts";
const PROJECTS_COLL: &str = "projects";

/// Chunk size for the bulk-upsert path, matching `wachat-contacts`.
const UPSERT_BATCH_SIZE: usize = 1_000;

// ===========================================================================
// Tenancy guard (mirrors wachat-contacts::load_project_with_membership)
// ===========================================================================

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **owner-or-agent** access for the caller.
/// Returns `404` (folding not-found + forbidden into one message to
/// avoid leaking project existence) — identical to the contacts crate.
async fn load_project_with_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let filter = doc! {
        "_id": project_oid,
        "$or": [
            { "userId": uid },
            { "agents.userId": uid },
        ],
    };
    coll.find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })
}

/// Pull the project's `_id` as an `ObjectId`.
fn project_oid_of(project: &Document) -> Result<ObjectId> {
    project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))
}

// ===========================================================================
// GET /export — stream all matching contacts as CSV (LOCAL, no external)
// ===========================================================================

/// `GET /export` — stream every contact matching the filter as CSV.
///
/// Local-only: builds the same `{ projectId, phoneNumberId?, tagIds? }`
/// filter the contacts list uses, then writes a CSV body and returns an
/// `axum` [`Response`] with `Content-Type: text/csv` +
/// `Content-Disposition: attachment; filename="contacts.csv"`.
///
/// Failures return a typed [`ApiError`] (rendered by the shared
/// `IntoResponse` impl); only the success path returns a raw CSV body.
#[instrument(skip_all, fields(project_id = %query.project_id))]
pub async fn export_csv(
    user: AuthUser,
    State(state): State<WachatContactsExportSyncState>,
    Query(query): Query<ExportQuery>,
) -> Result<Response> {
    // ---- Tenancy guard --------------------------------------------------
    let project = load_project_with_membership(&user, &state.mongo, &query.project_id).await?;
    let project_oid = project_oid_of(&project)?;

    // ---- Build filter (same shape as GET /v1/contacts) ------------------
    let mut filter = doc! { "projectId": project_oid };
    if let Some(pn) = query.phone_number_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("phoneNumberId", pn);
    }
    if let Some(tag_csv) = query.tag_ids.as_deref().filter(|s| !s.is_empty()) {
        let oids: Vec<ObjectId> = tag_csv
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(oid_from_str)
            .collect::<Result<Vec<_>>>()?;
        if !oids.is_empty() {
            filter.insert(
                "tagIds",
                doc! { "$in": Bson::Array(oids.into_iter().map(Bson::ObjectId).collect()) },
            );
        }
    }

    // ---- Stream ALL matching contacts (no pagination) -------------------
    let opts = FindOptions::builder()
        .sort(doc! { "lastMessageTimestamp": -1, "updatedAt": -1 })
        .build();
    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let mut cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find")))?;

    // ---- Render CSV -----------------------------------------------------
    let mut out = String::from("name,waId,phoneNumberId,status,tags,createdAt\n");
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.cursor")))?
    {
        out.push_str(&csv_escape(doc.get_str("name").unwrap_or("")));
        out.push(',');
        out.push_str(&csv_escape(doc.get_str("waId").unwrap_or("")));
        out.push(',');
        out.push_str(&csv_escape(doc.get_str("phoneNumberId").unwrap_or("")));
        out.push(',');
        out.push_str(&csv_escape(doc.get_str("status").unwrap_or("")));
        out.push(',');
        out.push_str(&csv_escape(&tag_ids_csv(&doc)));
        out.push(',');
        out.push_str(&csv_escape(&created_at_str(&doc)));
        out.push('\n');
    }

    // ---- Build the streaming Response with the required headers ---------
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"contacts.csv\"",
        )
        .body(axum::body::Body::from(out))
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("csv response build")))
}

// ===========================================================================
// POST /sync/vcard — parse vCard FN+TEL, bulk-upsert (LOCAL, no external)
// ===========================================================================

/// `POST /sync/vcard` — parse a vCard blob and bulk-upsert contacts.
///
/// Local-only: extracts `FN` (display name) + `TEL` (phone) from each
/// `BEGIN:VCARD … END:VCARD` block, then upserts on `{ waId, projectId }`
/// using the exact `$setOnInsert` / `$set` shape from the `wachat-contacts`
/// import path.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn sync_vcard(
    user: AuthUser,
    State(state): State<WachatContactsExportSyncState>,
    Json(body): Json<VcardSyncBody>,
) -> Result<Json<SyncResponse>> {
    if body.project_id.trim().is_empty() || body.phone_number_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "Project and Phone Number ID are required.".to_owned(),
        ));
    }
    if body.vcard.trim().is_empty() {
        return Err(ApiError::Validation("No vCard data provided.".to_owned()));
    }

    let project = load_project_with_membership(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project_oid_of(&project)?;
    let uid = user_oid(&user)?;

    let parsed = parse_vcards(&body.vcard);
    let rows: Vec<ExternalContact> = parsed
        .into_iter()
        .filter(|(name, phone)| !name.trim().is_empty() && !digits_only(phone).is_empty())
        .map(|(name, phone)| ExternalContact { name, phone })
        .collect();

    upsert_contacts(
        &state.mongo,
        project_oid,
        uid,
        &body.phone_number_id,
        "vcard",
        rows,
    )
    .await
}

// ===========================================================================
// POST /sync/google + POST /sync/shopify — gated via the external seam
// ===========================================================================

/// `POST /sync/google` — gated Google Contacts sync.
///
/// Runs the tenancy guard, then asks the [external seam](crate::external)
/// for contacts. With no stored Google credentials (the current state)
/// the seam degrades to `ApiError::BadRequest("Google not connected")`.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn sync_google(
    user: AuthUser,
    State(state): State<WachatContactsExportSyncState>,
    Json(body): Json<IntegrationSyncBody>,
) -> Result<Json<SyncResponse>> {
    sync_via_provider(Provider::Google, user, state, body).await
}

/// `POST /sync/shopify` — gated Shopify Customers sync.
///
/// Same shape as [`sync_google`]; degrades to
/// `ApiError::BadRequest("Shopify not connected")` with no stored creds.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn sync_shopify(
    user: AuthUser,
    State(state): State<WachatContactsExportSyncState>,
    Json(body): Json<IntegrationSyncBody>,
) -> Result<Json<SyncResponse>> {
    sync_via_provider(Provider::Shopify, user, state, body).await
}

/// Shared body for the two gated integration syncs: guard → external
/// seam → upsert. The external call is fully isolated in
/// [`external::fetch_external_contacts`] and degrades to a typed
/// `ApiError`; it never panics and never unwraps a network result.
async fn sync_via_provider(
    provider: Provider,
    user: AuthUser,
    state: WachatContactsExportSyncState,
    body: IntegrationSyncBody,
) -> Result<Json<SyncResponse>> {
    if body.project_id.trim().is_empty() || body.phone_number_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "Project and Phone Number ID are required.".to_owned(),
        ));
    }

    let project = load_project_with_membership(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project_oid_of(&project)?;
    let uid = user_oid(&user)?;

    // EXTERNAL SEAM — isolated, typed-error, no SDK, no live creds.
    let rows = external::fetch_external_contacts(provider, &project)?;

    upsert_contacts(
        &state.mongo,
        project_oid,
        uid,
        &body.phone_number_id,
        "sync",
        rows,
    )
    .await
}

// ===========================================================================
// Shared upsert (mirrors wachat-contacts import shape)
// ===========================================================================

/// Bulk-upsert normalized rows into the REAL `contacts` collection on
/// `{ waId, projectId }`. Mirrors the `$setOnInsert` / `$set` shape from
/// `wachat-contacts::import_contacts`, batched to bound concurrency.
async fn upsert_contacts(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    user_oid: ObjectId,
    phone_number_id: &str,
    status: &str,
    rows: Vec<ExternalContact>,
) -> Result<Json<SyncResponse>> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    // Build (filter, update) op pairs, skipping unusable rows.
    let mut ops: Vec<(Document, Document)> = Vec::with_capacity(rows.len());
    let mut skipped: u64 = 0;
    for row in &rows {
        let wa_id = digits_only(&row.phone);
        if wa_id.is_empty() || row.name.trim().is_empty() {
            skipped += 1;
            continue;
        }
        let now = bson::DateTime::from_chrono(Utc::now());
        let filter = doc! { "waId": &wa_id, "projectId": project_oid };
        let update = doc! {
            "$setOnInsert": {
                "projectId": project_oid,
                "phoneNumberId": phone_number_id,
                "name": &row.name,
                "waId": &wa_id,
                "userId": user_oid,
                "status": status,
                "createdAt": now,
            },
            "$set": { "updatedAt": now },
        };
        ops.push((filter, update));
    }

    let mut imported: u64 = 0;
    for chunk in ops.chunks(UPSERT_BATCH_SIZE) {
        for (filter, update) in chunk {
            let res = coll
                .update_one(filter.clone(), update.clone())
                .upsert(true)
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one"))
                })?;
            if res.upserted_id.is_some() || res.modified_count > 0 {
                imported += 1;
            }
        }
    }

    let message = format!("Sync complete. {imported} imported/updated. {skipped} skipped.");
    Ok(Json(SyncResponse {
        message,
        imported,
        skipped,
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Strip every non-digit character. Mirrors the TS regex `s.replace(/\D/g, '')`.
fn digits_only(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_digit()).collect()
}

/// RFC-4180 CSV field escaping (quote + double inner quotes when the
/// field contains a comma, quote, CR, or LF).
fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') || v.contains('\r') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_owned()
    }
}

/// Join a contact's `tagIds` array into a space-separated hex string for
/// the CSV `tags` column. Non-ObjectId / missing arrays render empty.
fn tag_ids_csv(doc: &Document) -> String {
    match doc.get_array("tagIds") {
        Ok(arr) => arr
            .iter()
            .filter_map(|b| match b {
                Bson::ObjectId(o) => Some(o.to_hex()),
                Bson::String(s) => Some(s.clone()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(" "),
        Err(_) => String::new(),
    }
}

/// Render the `createdAt` field as an ISO-8601 string for the CSV.
fn created_at_str(doc: &Document) -> String {
    match doc.get_datetime("createdAt") {
        Ok(dt) => dt.try_to_rfc3339_string().unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Parse one or more vCard blocks into `(FN, TEL)` pairs.
///
/// Deliberately tolerant: handles folded lines, `TYPE=`/param-prefixed
/// property names (e.g. `TEL;TYPE=CELL:`), and multiple `BEGIN:VCARD`
/// blocks. The first `FN` and first `TEL` per block win. Pure string
/// work — no external parser dependency.
fn parse_vcards(raw: &str) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    let mut cur_name: Option<String> = None;
    let mut cur_phone: Option<String> = None;
    let mut in_card = false;

    // Unfold continuation lines (a leading space/tab continues the prior
    // line per RFC 6350) before scanning.
    let unfolded = unfold_vcard_lines(raw);

    for line in unfolded.lines() {
        let trimmed = line.trim();
        let upper = trimmed.to_ascii_uppercase();

        if upper.starts_with("BEGIN:VCARD") {
            in_card = true;
            cur_name = None;
            cur_phone = None;
            continue;
        }
        if upper.starts_with("END:VCARD") {
            if let (Some(name), Some(phone)) = (cur_name.take(), cur_phone.take()) {
                out.push((name, phone));
            }
            in_card = false;
            continue;
        }
        if !in_card {
            continue;
        }

        // Split on the FIRST ':' — left side is property + params, right
        // side is the value.
        let Some((prop_raw, value)) = trimmed.split_once(':') else {
            continue;
        };
        // Property name is everything before the first ';' param.
        let prop = prop_raw.split(';').next().unwrap_or("").to_ascii_uppercase();
        let value = value.trim();
        if value.is_empty() {
            continue;
        }

        if prop == "FN" && cur_name.is_none() {
            cur_name = Some(value.to_owned());
        } else if prop == "TEL" && cur_phone.is_none() {
            cur_phone = Some(value.to_owned());
        }
    }

    out
}

/// RFC-6350 line unfolding: a line beginning with a space or tab is a
/// continuation of the previous line.
fn unfold_vcard_lines(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for line in raw.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);
        if line.starts_with(' ') || line.starts_with('\t') {
            out.push_str(line.trim_start_matches([' ', '\t']));
        } else {
            if !out.is_empty() {
                out.push('\n');
            }
            out.push_str(line);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digits_only_strips_non_digits() {
        assert_eq!(digits_only("+91 98765-43210"), "919876543210");
        assert_eq!(digits_only("abc"), "");
    }

    #[test]
    fn csv_escape_quotes_specials() {
        assert_eq!(csv_escape("plain"), "plain");
        assert_eq!(csv_escape("a,b"), "\"a,b\"");
        assert_eq!(csv_escape("a\"b"), "\"a\"\"b\"");
    }

    #[test]
    fn parses_basic_vcard() {
        let raw = "BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nTEL;TYPE=CELL:+1 (555) 123-4567\nEND:VCARD\n";
        let parsed = parse_vcards(raw);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].0, "Jane Doe");
        assert_eq!(digits_only(&parsed[0].1), "15551234567");
    }

    #[test]
    fn parses_multiple_vcards_and_skips_incomplete() {
        let raw = "BEGIN:VCARD\nFN:A\nTEL:111\nEND:VCARD\nBEGIN:VCARD\nFN:NoPhone\nEND:VCARD\nBEGIN:VCARD\nFN:B\nTEL:222\nEND:VCARD\n";
        let parsed = parse_vcards(raw);
        // The middle card has no TEL → dropped.
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].0, "A");
        assert_eq!(parsed[1].0, "B");
    }

    #[test]
    fn unfolds_continuation_lines() {
        let raw = "BEGIN:VCARD\nFN:Long\n  Name\nTEL:999\nEND:VCARD\n";
        let parsed = parse_vcards(raw);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].0, "LongName");
    }
}
