//! Mongo CRUD for the URL shortener.
//!
//! Wire shape mirrors the legacy server actions exactly so consumers
//! (`/dashboard/url-shortener` pages, the bulk-import dialog, the root
//! `[shortCode]` redirect page, the `webhook-processor` short-link
//! creator) keep working without changes.
//!
//! Two collections:
//! - `short_urls` — one document per short link.
//! - `users`      — `customDomains[]` lives on the user doc.

use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Duration, Utc};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const SHORT_URL_COLL: &str = "short_urls";
const USERS_COLL: &str = "users";

// ---------------------------------------------------------------------------
// Bodies / responses
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extended structs for new fields
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UtmParams {
    pub source: Option<String>,
    pub medium: Option<String>,
    pub campaign: Option<String>,
    pub term: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitTarget {
    pub url: String,
    /// Weights must sum to 100.
    pub weight: i32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelIds {
    pub facebook: Option<String>,
    pub google: Option<String>,
    pub tiktok: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub original_url: String,
    #[serde(default)]
    pub alias: Option<String>,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    /// ISO-8601 string. Optional.
    #[serde(default)]
    pub expires_at: Option<String>,
    /// May be `"none"` from the form — coerced to None.
    #[serde(default)]
    pub domain_id: Option<String>,
    /// User-chosen back-half for the short URL.
    #[serde(default)]
    pub custom_slug: Option<String>,
    /// Deactivate the link after this many clicks.
    #[serde(default)]
    pub click_limit: Option<i64>,
    /// Pre-hashed password (bcrypt hash; caller is responsible for hashing).
    #[serde(default)]
    pub password_hash: Option<String>,
    #[serde(default)]
    pub utm_params: Option<UtmParams>,
    #[serde(default)]
    pub split_targets: Option<Vec<SplitTarget>>,
    /// ISO-8601 — scheduled activation datetime.
    #[serde(default)]
    pub activate_at: Option<String>,
    #[serde(default)]
    pub pixel_ids: Option<PixelIds>,
    /// Link health status: "ok" | "dead" | "unknown". Defaults to "unknown".
    #[serde(default)]
    pub health_status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_url_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkCreateBody {
    pub items: Vec<BulkCreateItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCreateItem {
    pub original_url: String,
    #[serde(default)]
    pub alias: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCreateResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    /// User doc minus password — JSON shape matches legacy `JSON.parse(JSON.stringify(user))`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<Value>,
    pub urls: Value,
    pub domains: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOneResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteManyBody {
    pub ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteManyResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackClickQuery {
    pub short_code: String,
    /// Lowercased hostname or `null` for default-domain access.
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub referrer: Option<String>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackClickResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utm_params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_targets: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_expired: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDomainBody {
    pub hostname: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDomainResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyDomainResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDomainResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Random short-code generator (nanoid alphabet, default 7 chars).
// ---------------------------------------------------------------------------

const NANOID_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

pub(crate) fn generate_short_code(len: usize) -> String {
    let mut out = String::with_capacity(len);
    while out.len() < len {
        let oid = ObjectId::new();
        for byte in oid.bytes() {
            if out.len() >= len {
                break;
            }
            let idx = byte as usize % NANOID_ALPHABET.len();
            out.push(NANOID_ALPHABET[idx] as char);
        }
    }
    out
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

pub async fn create(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    body: CreateBody,
) -> Result<CreateResult> {
    if body.original_url.trim().is_empty() {
        return Ok(CreateResult {
            error: Some("Original URL is required.".to_owned()),
            ..Default::default()
        });
    }
    if !is_valid_url(&body.original_url) {
        return Ok(CreateResult {
            error: Some("Invalid Original URL format.".to_owned()),
            ..Default::default()
        });
    }

    // The legacy form sends `"none"` to mean "default domain".
    let domain_id = body
        .domain_id
        .as_deref()
        .filter(|s| !s.is_empty() && *s != "none")
        .map(str::to_owned);

    // custom_slug takes priority over alias, then alias, then generated.
    let short_code = match body
        .custom_slug
        .as_deref()
        .filter(|s| !s.is_empty())
        .or_else(|| body.alias.as_deref().filter(|s| !s.is_empty()))
    {
        Some(slug) => slug.to_owned(),
        None => generate_short_code(7),
    };

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);

    // Duplicate check — scoped to the same domainId bucket as the legacy
    // code: { shortCode, domainId } or { shortCode, domainId: { $exists: false } }.
    let dup_filter = match &domain_id {
        Some(d) => doc! { "shortCode": &short_code, "domainId": d },
        None => doc! { "shortCode": &short_code, "domainId": { "$exists": false } },
    };
    if coll
        .find_one(dup_filter)
        .await
        .map_err(internal)?
        .is_some()
    {
        // Use a specific message when a custom_slug was requested.
        let msg = if body.custom_slug.as_deref().filter(|s| !s.is_empty()).is_some() {
            "Slug already in use."
        } else {
            "This custom alias is already in use."
        };
        return Ok(CreateResult {
            error: Some(msg.to_owned()),
            ..Default::default()
        });
    }

    // Determine status — "scheduled" when activateAt is provided, else "active".
    let initial_status = if body.activate_at.as_deref().filter(|s| !s.is_empty()).is_some() {
        "scheduled"
    } else {
        "active"
    };

    let health = body
        .health_status
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("unknown");

    let mut new_doc = doc! {
        "userId": user_oid,
        "originalUrl": &body.original_url,
        "shortCode": &short_code,
        "clickCount": 0_i64,
        "analytics": Bson::Array(Vec::new()),
        "tagIds": Bson::Array(
            body.tag_ids
                .iter()
                .filter(|s| !s.is_empty())
                .map(|s| Bson::String(s.clone()))
                .collect()
        ),
        "status": initial_status,
        "healthStatus": health,
        "createdAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(d) = domain_id {
        new_doc.insert("domainId", d);
    }
    if let Some(exp) = body.expires_at.as_deref() {
        if let Some(dt) = parse_iso(exp) {
            new_doc.insert("expiresAt", BsonDateTime::from_chrono(dt));
        }
    }
    if let Some(limit) = body.click_limit {
        new_doc.insert("clickLimit", limit);
    }
    if let Some(ph) = body.password_hash.as_deref() {
        if !ph.is_empty() {
            new_doc.insert("passwordHash", ph);
        }
    }
    if let Some(utm) = &body.utm_params {
        let mut utm_doc = Document::new();
        if let Some(v) = &utm.source { utm_doc.insert("source", v); }
        if let Some(v) = &utm.medium { utm_doc.insert("medium", v); }
        if let Some(v) = &utm.campaign { utm_doc.insert("campaign", v); }
        if let Some(v) = &utm.term { utm_doc.insert("term", v); }
        if let Some(v) = &utm.content { utm_doc.insert("content", v); }
        new_doc.insert("utmParams", utm_doc);
    }
    if let Some(targets) = &body.split_targets {
        let bson_targets: Vec<Bson> = targets
            .iter()
            .map(|t| {
                Bson::Document(doc! {
                    "url": &t.url,
                    "weight": t.weight,
                })
            })
            .collect();
        new_doc.insert("splitTargets", Bson::Array(bson_targets));
    }
    if let Some(act) = body.activate_at.as_deref().filter(|s| !s.is_empty()) {
        if let Some(dt) = parse_iso(act) {
            new_doc.insert("activateAt", BsonDateTime::from_chrono(dt));
        }
    }
    if let Some(pixels) = &body.pixel_ids {
        let mut px_doc = Document::new();
        if let Some(v) = &pixels.facebook { px_doc.insert("facebook", v); }
        if let Some(v) = &pixels.google { px_doc.insert("google", v); }
        if let Some(v) = &pixels.tiktok { px_doc.insert("tiktok", v); }
        new_doc.insert("pixelIds", px_doc);
    }

    let res = match coll.insert_one(&new_doc).await {
        Ok(r) => r,
        Err(e) => {
            // Mongo dup-key code 11000.
            if format!("{e}").contains("E11000") {
                return Ok(CreateResult {
                    error: Some(
                        "That short code is already taken, please try again.".to_owned(),
                    ),
                    ..Default::default()
                });
            }
            return Err(ApiError::Internal(anyhow::anyhow!(e)));
        }
    };

    let inserted = res
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default();

    Ok(CreateResult {
        message: Some("Short URL created successfully!".to_owned()),
        short_url_id: Some(inserted),
        short_code: Some(short_code),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// BULK CREATE
// ---------------------------------------------------------------------------

pub async fn bulk_create(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    items: Vec<BulkCreateItem>,
) -> Result<BulkCreateResult> {
    let valid: Vec<Document> = items
        .into_iter()
        .filter_map(|it| {
            let url = it.original_url.trim();
            if url.is_empty() || !is_valid_url(url) {
                return None;
            }
            let alias = it.alias.as_deref().map(str::trim).filter(|s| !s.is_empty());
            let short_code = alias.map(str::to_owned).unwrap_or_else(|| generate_short_code(7));
            Some(doc! {
                "userId": user_oid,
                "originalUrl": url,
                "shortCode": short_code,
                "clickCount": 0_i64,
                "analytics": Bson::Array(Vec::new()),
                "createdAt": BsonDateTime::from_chrono(Utc::now()),
            })
        })
        .collect();

    if valid.is_empty() {
        return Ok(BulkCreateResult {
            error: Some("No valid URLs found in the file to import.".to_owned()),
            message: None,
        });
    }

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let inserted = match coll.insert_many(valid).ordered(false).await {
        Ok(r) => r.inserted_ids.len(),
        // Partial-failure (dup-key 11000) — `insert_many` with `ordered: false`
        // still inserts the rest, but the typed mongo error doesn't expose a
        // clean partial count. For UI purposes report 0 on hard failure;
        // happy path covers the common case.
        Err(_) => 0,
    };

    if inserted == 0 {
        return Ok(BulkCreateResult {
            error: Some("No valid URLs found in the file to import.".to_owned()),
            message: None,
        });
    }
    Ok(BulkCreateResult {
        message: Some(format!(
            "Successfully imported and created {inserted} short URL(s)."
        )),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

pub async fn list(mongo: &MongoHandle, user_oid: ObjectId) -> Result<ListResult> {
    let users = mongo.collection::<Document>(USERS_COLL);
    let urls = mongo.collection::<Document>(SHORT_URL_COLL);

    let user = users
        .find_one(doc! { "_id": user_oid })
        .projection(doc! { "password": 0 })
        .await
        .map_err(internal)?;

    let Some(user_doc) = user else {
        return Ok(ListResult {
            user: None,
            urls: Value::Array(Vec::new()),
            domains: Value::Array(Vec::new()),
        });
    };

    let url_docs: Vec<Document> = urls
        .find(doc! { "userId": user_oid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(internal)?
        .try_collect()
        .await
        .map_err(internal)?;

    let domains = user_doc
        .get_array("customDomains")
        .map(|arr| Value::Array(arr.iter().cloned().map(bson_to_json).collect()))
        .unwrap_or_else(|_| Value::Array(Vec::new()));

    Ok(ListResult {
        user: Some(doc_to_json(user_doc)),
        urls: Value::Array(url_docs.into_iter().map(doc_to_json).collect()),
        domains,
    })
}

pub async fn get_one(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    id: &str,
) -> Result<Option<Value>> {
    let oid = match ObjectId::parse_str(id) {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let res = coll
        .find_one(doc! { "_id": oid, "userId": user_oid })
        .await
        .map_err(internal)?;
    Ok(res.map(doc_to_json))
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

pub async fn delete_one(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    id: &str,
) -> Result<DeleteOneResult> {
    let oid = match ObjectId::parse_str(id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(DeleteOneResult {
                success: false,
                error: Some("Invalid URL ID.".to_owned()),
            });
        }
    };

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let res = coll
        .delete_one(doc! { "_id": oid, "userId": user_oid })
        .await
        .map_err(internal)?;

    if res.deleted_count == 0 {
        return Ok(DeleteOneResult {
            success: false,
            error: Some("URL not found or access denied.".to_owned()),
        });
    }
    Ok(DeleteOneResult {
        success: true,
        error: None,
    })
}

pub async fn delete_many(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    ids: &[String],
) -> Result<DeleteManyResult> {
    let valid: Vec<Bson> = ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .map(Bson::ObjectId)
        .collect();

    if valid.is_empty() {
        return Ok(DeleteManyResult {
            success: false,
            deleted: None,
            error: Some("No valid IDs provided.".to_owned()),
        });
    }

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let res = coll
        .delete_many(doc! {
            "_id": { "$in": valid },
            "userId": user_oid,
        })
        .await
        .map_err(internal)?;

    Ok(DeleteManyResult {
        success: true,
        deleted: Some(res.deleted_count),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// BULK UPLOAD — parse a CSV/XLSX byte buffer into [{originalUrl, alias?}].
// Mirrors the legacy `parseCsv` + `XLSX.utils.sheet_to_csv` flow, but in
// Rust so the heavy parser deps don't ship with the Next.js SSR bundle.
// ---------------------------------------------------------------------------

/// File kind: "csv" or "xlsx" (anything else is rejected).
pub fn parse_bulk_upload(filename: &str, bytes: &[u8]) -> Result<Vec<BulkCreateItem>> {
    let lowered = filename.to_lowercase();
    if lowered.ends_with(".csv") {
        parse_csv_bytes(bytes)
    } else if lowered.ends_with(".xlsx") {
        parse_xlsx_bytes(bytes)
    } else {
        Err(ApiError::BadRequest(
            "Unsupported file type. Please upload a .csv or .xlsx file.".to_owned(),
        ))
    }
}

fn parse_csv_bytes(bytes: &[u8]) -> Result<Vec<BulkCreateItem>> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(bytes);

    // Match the legacy behavior: column 0 is URL, column 1 (if present) is alias.
    // Headers are preserved but we read positionally so any header names work.
    let mut items = Vec::new();
    for record in rdr.records() {
        let record = match record {
            Ok(r) => r,
            Err(_) => continue, // skip malformed rows, don't fail the whole import
        };
        let url = record.get(0).map(str::trim).unwrap_or("");
        if url.is_empty() {
            continue;
        }
        let alias = record
            .get(1)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned);
        items.push(BulkCreateItem {
            original_url: url.to_owned(),
            alias,
        });
    }
    Ok(items)
}

fn parse_xlsx_bytes(bytes: &[u8]) -> Result<Vec<BulkCreateItem>> {
    use calamine::{Reader, Xlsx, open_workbook_from_rs};
    use std::io::Cursor;

    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor).map_err(|e| {
        ApiError::BadRequest(format!("Could not open .xlsx: {e}"))
    })?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| ApiError::BadRequest("The XLSX file contains no sheets.".to_owned()))?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| ApiError::BadRequest(format!("Could not read sheet: {e}")))?;

    let mut iter = range.rows();
    // First row is treated as the header — same as the legacy
    // `Papa.parse(..., header: true)` behavior + XLSX→CSV stringify.
    let _ = iter.next();

    let mut items = Vec::new();
    for row in iter {
        let url = row
            .first()
            .map(|c| c.to_string())
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();
        if url.is_empty() {
            continue;
        }
        let alias = row
            .get(1)
            .map(|c| c.to_string())
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        items.push(BulkCreateItem {
            original_url: url,
            alias,
        });
    }
    Ok(items)
}

// ---------------------------------------------------------------------------
// COUNTS
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CountResult {
    pub count: u64,
}

pub async fn count_for_user(mongo: &MongoHandle, user_oid: ObjectId) -> Result<CountResult> {
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let n = coll
        .count_documents(doc! { "userId": user_oid })
        .await
        .map_err(internal)?;
    Ok(CountResult { count: n })
}

pub async fn count_global(mongo: &MongoHandle) -> Result<CountResult> {
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let n = coll
        .count_documents(doc! {})
        .await
        .map_err(internal)?;
    Ok(CountResult { count: n })
}

// ---------------------------------------------------------------------------
// REDIRECT TRACKING (public — no auth)
// ---------------------------------------------------------------------------

pub async fn track_click(
    mongo: &MongoHandle,
    q: TrackClickQuery,
) -> Result<TrackClickResult> {
    let urls = mongo.collection::<Document>(SHORT_URL_COLL);
    let users = mongo.collection::<Document>(USERS_COLL);

    let mut url_doc: Option<Document> = None;

    if let Some(host) = q.hostname.as_deref().filter(|s| !s.is_empty()) {
        // Custom-domain lookup first.
        let user = users
            .find_one(doc! {
                "customDomains.hostname": host,
                "customDomains.verified": true,
            })
            .await
            .map_err(internal)?;

        if let Some(u) = user {
            if let Ok(domains) = u.get_array("customDomains") {
                for d in domains {
                    if let Some(dd) = d.as_document() {
                        if dd.get_str("hostname").ok() == Some(host) {
                            if let Ok(domain_oid) = dd.get_object_id("_id") {
                                let domain_id_str = domain_oid.to_hex();
                                url_doc = urls
                                    .find_one(doc! {
                                        "shortCode": &q.short_code,
                                        "domainId": &domain_id_str,
                                    })
                                    .await
                                    .map_err(internal)?;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Fallback — any short_url with this code.
        if url_doc.is_none() {
            url_doc = urls
                .find_one(doc! { "shortCode": &q.short_code })
                .await
                .map_err(internal)?;
        }
    } else {
        // Default-domain path: prefer the row without a domainId.
        url_doc = urls
            .find_one(doc! {
                "shortCode": &q.short_code,
                "domainId": { "$exists": false },
            })
            .await
            .map_err(internal)?;
        if url_doc.is_none() {
            url_doc = urls
                .find_one(doc! { "shortCode": &q.short_code })
                .await
                .map_err(internal)?;
        }
    }

    let Some(doc) = url_doc else {
        return Ok(TrackClickResult {
            original_url: None,
            error: Some("URL not found.".to_owned()),
            password_hash: None,
            utm_params: None,
            split_targets: None,
            is_expired: None,
        });
    };

    // Check expiresAt
    if let Ok(exp) = doc.get_datetime("expiresAt") {
        if exp.to_chrono() < Utc::now() {
            return Ok(TrackClickResult {
                original_url: None,
                error: None,
                password_hash: None,
                utm_params: None,
                split_targets: None,
                is_expired: Some(true),
            });
        }
    }

    // Check clickLimit
    let click_count = doc.get_i64("clickCount").unwrap_or(0);
    if let Ok(limit) = doc.get_i64("clickLimit") {
        if click_count >= limit {
            return Ok(TrackClickResult {
                original_url: None,
                error: None,
                password_hash: None,
                utm_params: None,
                split_targets: None,
                is_expired: Some(true),
            });
        }
    }

    // Check activateAt
    if let Ok(activate) = doc.get_datetime("activateAt") {
        if activate.to_chrono() > Utc::now() {
            return Ok(TrackClickResult {
                original_url: None,
                error: Some("Link not yet active.".to_owned()),
                password_hash: None,
                utm_params: None,
                split_targets: None,
                is_expired: None,
                pixel_ids: None,
                is_expired: None,
            });
        }
    }

    // Check password protection
    if let Ok(ph) = doc.get_str("passwordHash") {
        if !ph.is_empty() && q.password.as_deref() != Some(ph) {
            return Ok(TrackClickResult {
                original_url: None,
                error: None,
                password_hash: Some(ph.to_owned()),
                utm_params: None,
                split_targets: None,
                is_expired: None,
            });
        }
    }

    // Extract utmParams from doc
    let utm_params = doc.get_document("utmParams").ok().map(|utm_doc| {
        bson_to_json(Bson::Document(utm_doc.clone()))
    });

    // Handle splitTargets — weighted random selection
    let chosen_url: Option<String> = if let Ok(targets) = doc.get_array("splitTargets") {
        if !targets.is_empty() {
            let rand_val = (ObjectId::new().bytes()[0] as u32) * 100 / 256;
            let mut cumulative: u32 = 0;
            let mut selected: Option<String> = None;
            for t in targets {
                if let Some(td) = t.as_document() {
                    let weight = td.get_i32("weight").unwrap_or(0) as u32;
                    cumulative += weight;
                    if cumulative > rand_val && selected.is_none() {
                        selected = td.get_str("url").ok().map(str::to_owned);
                    }
                }
            }
            // fallback to last target if rand_val exceeded all cumulative
            if selected.is_none() {
                if let Some(last) = targets.last() {
                    if let Some(td) = last.as_document() {
                        selected = td.get_str("url").ok().map(str::to_owned);
                    }
                }
            }
            selected
        } else {
            None
        }
    } else {
        None
    };

    let original_url = chosen_url.unwrap_or_else(|| {
        doc.get_str("originalUrl").unwrap_or("").to_owned()
    });

    let id = match doc.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Ok(TrackClickResult {
                original_url: Some(original_url),
                error: None,
                password_hash: None,
                utm_params,
                split_targets: None,
                is_expired: None,
            });
        }
    };

    // Build analytics push entry.
    let mut analytic = doc! { "timestamp": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(ua) = q.user_agent.as_deref() {
        analytic.insert("userAgent", ua);

        // Device breakdown — os, browser, deviceType.
        let (os, browser, device_type) = parse_device_from_ua(ua);
        analytic.insert("device", doc! {
            "os": os,
            "browser": browser,
            "deviceType": device_type,
        });
    } else {
        // Always include a device subdoc so aggregation projections work.
        analytic.insert("device", doc! {
            "os": Bson::Null,
            "browser": Bson::Null,
            "deviceType": "desktop",
        });
    }
    // Geo placeholder — country will be populated externally (Phase 2 MaxMind).
    analytic.insert("geo", doc! {
        "country": Bson::Null,
        "region": Bson::Null,
        "city": Bson::Null,
    });
    if let Some(rf) = q.referrer.as_deref() {
        analytic.insert("referrer", rf);
        let domain = extract_referrer_domain(rf);
        match domain {
            Some(d) => analytic.insert("referrerDomain", d),
            None => analytic.insert("referrerDomain", Bson::Null),
        };
    } else {
        analytic.insert("referrerDomain", Bson::Null);
    }
    if let Some(ip) = q.ip.as_deref() {
        analytic.insert("ip", ip);
    }

    // Best-effort: don't fail the redirect if the click counter update
    // hits a transient mongo error. Log + continue.
    if let Err(e) = urls
        .update_one(
            doc! { "_id": id },
            doc! {
                "$inc": { "clickCount": 1_i64 },
                "$push": {
                    "analytics": {
                        "$each": [analytic],
                        "$slice": -100_i64,
                    }
                }
            },
        )
        .await
    {
        tracing::warn!(error = %e, "url-shortener: click-tracking update failed");
    }

    Ok(TrackClickResult {
        original_url: Some(original_url),
        error: None,
        password_hash: None,
        utm_params,
        split_targets: None,
        is_expired: None,
    })
}

// ---------------------------------------------------------------------------
// CUSTOM DOMAINS (live on the user doc as `customDomains[]`)
// ---------------------------------------------------------------------------

pub async fn list_domains(mongo: &MongoHandle, user_oid: ObjectId) -> Result<Value> {
    let users = mongo.collection::<Document>(USERS_COLL);
    let user = users
        .find_one(doc! { "_id": user_oid })
        .await
        .map_err(internal)?;
    let Some(user_doc) = user else {
        return Ok(Value::Array(Vec::new()));
    };
    Ok(user_doc
        .get_array("customDomains")
        .map(|arr| Value::Array(arr.iter().cloned().map(bson_to_json).collect()))
        .unwrap_or_else(|_| Value::Array(Vec::new())))
}

pub async fn add_domain(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    body: AddDomainBody,
) -> Result<AddDomainResult> {
    if body.hostname.is_empty() {
        return Ok(AddDomainResult {
            success: false,
            error: Some("Hostname is required.".to_owned()),
        });
    }
    if !is_valid_hostname(&body.hostname) {
        return Ok(AddDomainResult {
            success: false,
            error: Some("Invalid domain format.".to_owned()),
        });
    }

    let users = mongo.collection::<Document>(USERS_COLL);
    let existing = users
        .find_one(doc! {
            "_id": user_oid,
            "customDomains.hostname": &body.hostname,
        })
        .await
        .map_err(internal)?;
    if existing.is_some() {
        return Ok(AddDomainResult {
            success: false,
            error: Some("This domain has already been added.".to_owned()),
        });
    }

    let new_domain = doc! {
        "_id": ObjectId::new(),
        "hostname": &body.hostname,
        "verified": false,
        "verificationCode": format!("sabnode-verify={}", generate_short_code(16)),
    };

    users
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$push": { "customDomains": new_domain } },
        )
        .await
        .map_err(internal)?;

    Ok(AddDomainResult {
        success: true,
        error: None,
    })
}

pub async fn verify_domain(
    mongo: &MongoHandle,
    resolver: &hickory_resolver::TokioAsyncResolver,
    user_oid: ObjectId,
    domain_id: &str,
) -> Result<VerifyDomainResult> {
    let oid = match ObjectId::parse_str(domain_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(VerifyDomainResult {
                success: false,
                error: Some("Domain not found.".to_owned()),
            });
        }
    };

    let users = mongo.collection::<Document>(USERS_COLL);
    let user = users
        .find_one(doc! {
            "_id": user_oid,
            "customDomains._id": oid,
        })
        .await
        .map_err(internal)?;

    let Some(u) = user else {
        return Ok(VerifyDomainResult {
            success: false,
            error: Some("Domain not found.".to_owned()),
        });
    };

    let domains = u
        .get_array("customDomains")
        .map_err(|_| ApiError::NotFound("Domain not found.".to_owned()))?;

    let mut hostname: Option<String> = None;
    let mut verification_code: Option<String> = None;
    for d in domains {
        if let Some(dd) = d.as_document() {
            if let Ok(id) = dd.get_object_id("_id") {
                if id == oid {
                    hostname = dd.get_str("hostname").ok().map(str::to_owned);
                    verification_code = dd.get_str("verificationCode").ok().map(str::to_owned);
                    break;
                }
            }
        }
    }

    let (Some(host), Some(code)) = (hostname, verification_code) else {
        return Ok(VerifyDomainResult {
            success: false,
            error: Some("Domain not found.".to_owned()),
        });
    };

    // Dev bypass — same as legacy.
    if host.ends_with(".localhost") || host.ends_with(".test") {
        users
            .update_one(
                doc! { "_id": user_oid, "customDomains._id": oid },
                doc! { "$set": { "customDomains.$.verified": true } },
            )
            .await
            .map_err(internal)?;
        return Ok(VerifyDomainResult {
            success: true,
            error: None,
        });
    }

    let mut verified = false;
    if let Ok(lookup) = resolver.txt_lookup(host.clone()).await {
        for record in lookup.iter() {
            for chunk in record.iter() {
                let s = String::from_utf8_lossy(chunk);
                if s == code {
                    verified = true;
                    break;
                }
            }
            if verified {
                break;
            }
        }
    }

    if !verified {
        return Ok(VerifyDomainResult {
            success: false,
            error: Some(format!(
                "DNS verification failed. Could not find TXT record: {code}"
            )),
        });
    }

    users
        .update_one(
            doc! { "_id": user_oid, "customDomains._id": oid },
            doc! { "$set": { "customDomains.$.verified": true } },
        )
        .await
        .map_err(internal)?;

    Ok(VerifyDomainResult {
        success: true,
        error: None,
    })
}

pub async fn delete_domain(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    domain_id: &str,
) -> Result<DeleteDomainResult> {
    let oid = match ObjectId::parse_str(domain_id) {
        Ok(o) => o,
        Err(_) => {
            return Ok(DeleteDomainResult {
                success: false,
                error: Some("Failed to delete domain.".to_owned()),
            });
        }
    };

    let users = mongo.collection::<Document>(USERS_COLL);
    users
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$pull": { "customDomains": { "_id": oid } } },
        )
        .await
        .map_err(internal)?;

    Ok(DeleteDomainResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// ANALYTICS AGGREGATION
// ---------------------------------------------------------------------------

pub async fn get_analytics_timeline(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
    days: i64,
) -> Result<Value> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Err(ApiError::BadRequest("Invalid link ID.".to_owned())),
    };
    let since = Utc::now() - Duration::days(days);
    let since_bson = BsonDateTime::from_chrono(since);

    let pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! { "$match": { "analytics.timestamp": { "$gte": since_bson } } },
        doc! {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$analytics.timestamp",
                    }
                },
                "count": { "$sum": 1_i64 },
            }
        },
        doc! { "$sort": { "_id": 1 } },
        doc! { "$project": { "_id": 0, "date": "$_id", "count": 1 } },
    ];

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let cursor = coll.aggregate(pipeline).await.map_err(internal)?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(internal)?;
    Ok(Value::Array(docs.into_iter().map(doc_to_json).collect()))
}

pub async fn get_analytics_geo(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
) -> Result<Value> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Err(ApiError::BadRequest("Invalid link ID.".to_owned())),
    };
    let pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! {
            "$group": {
                "_id": "$analytics.geo.country",
                "count": { "$sum": 1_i64 },
            }
        },
        doc! { "$sort": { "count": -1 } },
        doc! { "$project": { "_id": 0, "country": "$_id", "count": 1 } },
    ];

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let cursor = coll.aggregate(pipeline).await.map_err(internal)?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(internal)?;
    Ok(Value::Array(docs.into_iter().map(doc_to_json).collect()))
}

pub async fn get_analytics_devices(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
) -> Result<Value> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Err(ApiError::BadRequest("Invalid link ID.".to_owned())),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);

    let device_type_pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! { "$group": { "_id": "$analytics.device.deviceType", "count": { "$sum": 1_i64 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$project": { "_id": 0, "type": "$_id", "count": 1 } },
    ];
    let browser_pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! { "$group": { "_id": "$analytics.device.browser", "count": { "$sum": 1_i64 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$project": { "_id": 0, "browser": "$_id", "count": 1 } },
    ];
    let os_pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! { "$group": { "_id": "$analytics.device.os", "count": { "$sum": 1_i64 } } },
        doc! { "$sort": { "count": -1 } },
        doc! { "$project": { "_id": 0, "os": "$_id", "count": 1 } },
    ];

    let dt_docs: Vec<Document> = coll
        .aggregate(device_type_pipeline)
        .await
        .map_err(internal)?
        .try_collect()
        .await
        .map_err(internal)?;
    let br_docs: Vec<Document> = coll
        .aggregate(browser_pipeline)
        .await
        .map_err(internal)?
        .try_collect()
        .await
        .map_err(internal)?;
    let os_docs: Vec<Document> = coll
        .aggregate(os_pipeline)
        .await
        .map_err(internal)?
        .try_collect()
        .await
        .map_err(internal)?;

    let mut result = Map::new();
    result.insert(
        "deviceTypes".to_owned(),
        Value::Array(dt_docs.into_iter().map(doc_to_json).collect()),
    );
    result.insert(
        "browsers".to_owned(),
        Value::Array(br_docs.into_iter().map(doc_to_json).collect()),
    );
    result.insert(
        "os".to_owned(),
        Value::Array(os_docs.into_iter().map(doc_to_json).collect()),
    );
    Ok(Value::Object(result))
}

pub async fn get_analytics_referrers(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
) -> Result<Value> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Err(ApiError::BadRequest("Invalid link ID.".to_owned())),
    };
    let pipeline = vec![
        doc! { "$match": { "_id": oid, "userId": user_oid } },
        doc! { "$unwind": "$analytics" },
        doc! {
            "$group": {
                "_id": "$analytics.referrerDomain",
                "count": { "$sum": 1_i64 },
            }
        },
        doc! { "$sort": { "count": -1 } },
        doc! { "$project": { "_id": 0, "domain": "$_id", "count": 1 } },
    ];

    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let cursor = coll.aggregate(pipeline).await.map_err(internal)?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(internal)?;
    Ok(Value::Array(docs.into_iter().map(doc_to_json).collect()))
}

// ---------------------------------------------------------------------------
// PASSWORD VERIFICATION
// ---------------------------------------------------------------------------

pub async fn verify_link_password(
    mongo: &MongoHandle,
    short_code: &str,
    password_hash: &str,
) -> Result<bool> {
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let doc = coll
        .find_one(doc! { "shortCode": short_code })
        .await
        .map_err(internal)?;
    let Some(d) = doc else { return Ok(false) };
    Ok(d.get_str("passwordHash").ok() == Some(password_hash))
}

// ---------------------------------------------------------------------------
// UPDATE (PATCH)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBody {
    pub original_url: Option<String>,
    pub expires_at: Option<Option<String>>,
    pub click_limit: Option<Option<i64>>,
    #[serde(default)]
    pub tag_ids: Option<Vec<String>>,
    pub utm_params: Option<Option<UtmParams>>,
    pub split_targets: Option<Option<Vec<SplitTarget>>>,
    pub pixel_ids: Option<Option<PixelIds>>,
}

pub async fn update(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
    body: UpdateBody,
) -> Result<bool> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Ok(false),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);

    // If originalUrl is being changed, push the old one to history first.
    if let Some(new_url) = body.original_url.as_deref() {
        let current = coll
            .find_one(doc! { "_id": oid, "userId": user_oid })
            .await
            .map_err(internal)?;
        if let Some(ref doc) = current {
            let old_url = doc.get_str("originalUrl").unwrap_or("");
            if !old_url.is_empty() && old_url != new_url {
                let history_entry = doc! {
                    "url": old_url,
                    "changedAt": BsonDateTime::from_chrono(Utc::now()),
                };
                coll.update_one(
                    doc! { "_id": oid, "userId": user_oid },
                    doc! { "$push": { "history": history_entry } },
                )
                .await
                .ok(); // best-effort
            }
        }
    }

    let mut set_doc = Document::new();
    if let Some(url) = body.original_url {
        set_doc.insert("originalUrl", url);
    }
    // expires_at: Option<Option<String>> — outer Some means field was provided.
    if let Some(exp) = body.expires_at {
        match exp.as_deref() {
            Some("") | None => { set_doc.insert("expiresAt", Bson::Null); }
            Some(s) => {
                if let Some(dt) = parse_iso(s) {
                    set_doc.insert("expiresAt", BsonDateTime::from_chrono(dt));
                }
            }
        }
    }
    if let Some(limit) = body.click_limit {
        match limit {
            None => { set_doc.insert("clickLimit", Bson::Null); }
            Some(n) => { set_doc.insert("clickLimit", n); }
        }
    }
    if let Some(tags) = body.tag_ids {
        set_doc.insert(
            "tagIds",
            Bson::Array(tags.into_iter().map(Bson::String).collect()),
        );
    }
    if let Some(utm_opt) = body.utm_params {
        match utm_opt {
            None => { set_doc.insert("utmParams", Bson::Null); }
            Some(utm) => {
                let mut utm_doc = Document::new();
                if let Some(v) = utm.source { utm_doc.insert("source", v); }
                if let Some(v) = utm.medium { utm_doc.insert("medium", v); }
                if let Some(v) = utm.campaign { utm_doc.insert("campaign", v); }
                if let Some(v) = utm.term { utm_doc.insert("term", v); }
                if let Some(v) = utm.content { utm_doc.insert("content", v); }
                set_doc.insert("utmParams", utm_doc);
            }
        }
    }
    if let Some(targets_opt) = body.split_targets {
        match targets_opt {
            None => { set_doc.insert("splitTargets", Bson::Null); }
            Some(targets) => {
                let bson_targets: Vec<Bson> = targets
                    .iter()
                    .map(|t| Bson::Document(doc! { "url": &t.url, "weight": t.weight }))
                    .collect();
                set_doc.insert("splitTargets", Bson::Array(bson_targets));
            }
        }
    }
    if let Some(pixels_opt) = body.pixel_ids {
        match pixels_opt {
            None => { set_doc.insert("pixelIds", Bson::Null); }
            Some(pixels) => {
                let mut px_doc = Document::new();
                if let Some(v) = pixels.facebook { px_doc.insert("facebook", v); }
                if let Some(v) = pixels.google { px_doc.insert("google", v); }
                if let Some(v) = pixels.tiktok { px_doc.insert("tiktok", v); }
                set_doc.insert("pixelIds", px_doc);
            }
        }
    }

    if set_doc.is_empty() {
        return Ok(true);
    }

    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": user_oid },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(internal)?;
    Ok(res.matched_count > 0)
}

// ---------------------------------------------------------------------------
// HISTORY
// ---------------------------------------------------------------------------

pub async fn get_history(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
) -> Result<Value> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Ok(Value::Array(vec![])),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    match doc {
        None => Ok(Value::Array(vec![])),
        Some(d) => {
            let empty: Vec<bson::Bson> = Vec::new();
            let history = d.get_array("history").unwrap_or(&empty);
            let items: Vec<Value> = history
                .iter()
                .map(|b| bson_to_json(b.clone()))
                .collect();
            Ok(Value::Array(items))
        }
    }
}

pub async fn rollback_to_url(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    link_id: &str,
    url: &str,
) -> Result<bool> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Ok(false),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);

    // Push the current URL to history before overwriting.
    let current = coll
        .find_one(doc! { "_id": oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    if let Some(ref doc) = current {
        let old_url = doc.get_str("originalUrl").unwrap_or("");
        if !old_url.is_empty() {
            coll.update_one(
                doc! { "_id": oid, "userId": user_oid },
                doc! { "$push": { "history": doc! { "url": old_url, "changedAt": BsonDateTime::from_chrono(Utc::now()) } } },
            )
            .await
            .ok(); // best-effort
        }
    }

    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": user_oid },
            doc! { "$set": { "originalUrl": url } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(res.matched_count > 0)
}

// ---------------------------------------------------------------------------
// HEALTH STATUS
// ---------------------------------------------------------------------------

pub async fn update_health_status(
    mongo: &MongoHandle,
    link_id: &str,
    status: &str,
) -> Result<bool> {
    let oid = match ObjectId::parse_str(link_id) {
        Ok(o) => o,
        Err(_) => return Ok(false),
    };
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let res = coll
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "healthStatus": status } },
        )
        .await
        .map_err(internal)?;
    Ok(res.matched_count > 0)
}

// ---------------------------------------------------------------------------
// SCHEDULED ACTIVATION
// ---------------------------------------------------------------------------

pub async fn activate_scheduled_links(mongo: &MongoHandle) -> Result<u64> {
    let now_bson = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(SHORT_URL_COLL);
    let res = coll
        .update_many(
            doc! {
                "status": "scheduled",
                "activateAt": { "$lte": now_bson },
            },
            doc! { "$set": { "status": "active" } },
        )
        .await
        .map_err(internal)?;
    Ok(res.modified_count)
}

// ---------------------------------------------------------------------------
// Defaults / validators / helpers
// ---------------------------------------------------------------------------

impl Default for CreateResult {
    fn default() -> Self {
        Self {
            message: None,
            error: None,
            short_url_id: None,
            short_code: None,
        }
    }
}

fn internal(e: impl Into<anyhow::Error>) -> ApiError {
    ApiError::Internal(e.into())
}

/// Simple UA string parser — no external crates.
/// Returns `(os, browser, device_type)`.
pub(crate) fn parse_device_from_ua(ua: &str) -> (String, String, &'static str) {
    // deviceType
    let device_type = if ua.contains("iPad") || ua.contains("Tablet") {
        "tablet"
    } else if ua.contains("Mobile") || ua.contains("Android") {
        "mobile"
    } else {
        "desktop"
    };

    // browser — precedence: Chrome > Firefox > Safari > Edge > OPR
    let browser = if ua.contains("Chrome") {
        "Chrome"
    } else if ua.contains("Firefox") {
        "Firefox"
    } else if ua.contains("Safari") {
        "Safari"
    } else if ua.contains("Edge") {
        "Edge"
    } else if ua.contains("OPR") {
        "Opera"
    } else {
        "Unknown"
    };

    // os
    let os = if ua.contains("Windows") {
        "Windows"
    } else if ua.contains("Mac OS X") {
        "macOS"
    } else if ua.contains("Android") {
        "Android"
    } else if ua.contains("iPhone") {
        "iOS"
    } else if ua.contains("iPad") {
        "iOS"
    } else if ua.contains("Linux") {
        "Linux"
    } else {
        "Unknown"
    };

    (os.to_owned(), browser.to_owned(), device_type)
}

/// Extract the hostname from a referrer URL string, e.g. `"https://google.com/search"` → `"google.com"`.
fn extract_referrer_domain(referrer: &str) -> Option<String> {
    // Look for "://" then take everything up to the next "/".
    let after_scheme = referrer.find("://").map(|i| &referrer[i + 3..])?;
    let host = after_scheme
        .split('/')
        .next()
        .filter(|s| !s.is_empty())?;
    Some(host.to_owned())
}

fn is_valid_url(s: &str) -> bool {
    // Match `new URL(...)` permissiveness — accept anything with a scheme://host.
    if let Some(idx) = s.find("://") {
        idx > 0 && s.len() > idx + 3
    } else {
        false
    }
}

fn is_valid_hostname(s: &str) -> bool {
    // Same regex as the legacy TS code:
    //   /^(?!-)[A-Za-z0-9-]+([\-\.]{1}[a-z0-9]+)*\.[A-Za-z]{2,6}$/
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] == b'-' {
        return false;
    }
    let dot = match s.rfind('.') {
        Some(i) => i,
        None => return false,
    };
    let tld = &s[dot + 1..];
    if tld.len() < 2 || tld.len() > 6 {
        return false;
    }
    if !tld.chars().all(|c| c.is_ascii_alphabetic()) {
        return false;
    }
    s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .ok()
}

// JSON ↔ BSON conversion mirroring qr-codes::store.
fn doc_to_json(doc: Document) -> Value {
    bson_to_json(Bson::Document(doc))
}

fn bson_to_json(b: Bson) -> Value {
    match b {
        Bson::Double(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(s) => Value::String(s),
        Bson::Array(arr) => Value::Array(arr.into_iter().map(bson_to_json).collect()),
        Bson::Document(d) => {
            let mut m = Map::with_capacity(d.len());
            for (k, v) in d.into_iter() {
                m.insert(k, bson_to_json(v));
            }
            Value::Object(m)
        }
        Bson::Boolean(b) => Value::Bool(b),
        Bson::Null => Value::Null,
        Bson::Int32(i) => Value::Number(i.into()),
        Bson::Int64(i) => Value::Number(i.into()),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => {
            let ch = dt.to_chrono();
            Value::String(ch.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        }
        Bson::Timestamp(ts) => Value::String(format!("{}:{}", ts.time, ts.increment)),
        Bson::Decimal128(d) => Value::String(d.to_string()),
        Bson::RegularExpression(r) => Value::String(format!("/{}/{}", r.pattern, r.options)),
        Bson::JavaScriptCode(c) => Value::String(c),
        Bson::JavaScriptCodeWithScope(j) => Value::String(j.code),
        Bson::Symbol(s) => Value::String(s),
        Bson::Binary(_) | Bson::Undefined | Bson::MaxKey | Bson::MinKey | Bson::DbPointer(_) => {
            Value::Null
        }
    }
}
