//! Mongo CRUD for the user-scoped QR-code maker.
//!
//! Two collections:
//! - `qr_codes`   — one row per saved QR; keeps `userId`, `name`, payload,
//!                  visual config, optional `shortUrlId`, and tag list.
//! - `short_urls` — one row per dynamic URL QR; the QR encodes the short
//!                  code, click analytics live here.
//!
//! Document shapes mirror the legacy TS server action so the existing
//! consumers (`getQrCodes` aggregation in particular) keep working without
//! a rewrite.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;
use serde_json::{Map, Value};

const QR_COLL: &str = "qr_codes";
const SHORT_URL_COLL: &str = "short_urls";

/// Body for `POST /v1/qr-codes`. Mirrors the legacy `FormData` fields the
/// Next.js server action parsed.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub name: String,
    /// One of: `url` | `text` | `email` | `phone` | `sms` | `wifi`.
    pub data_type: String,
    /// Free-form payload object — passed through verbatim. For `url` types
    /// this carries `{ url: "..." }`.
    pub data: Value,
    /// Visual config: `{ color, bgColor, eccLevel, size }`.
    pub config: Value,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub is_dynamic: bool,
}

/// Result envelope for create. Matches the legacy server-action contract:
/// `{ message?, error?, qrCodeUrl? }`.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code_url: Option<String>,
}

/// Result envelope for `deleteMany`.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteManyResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result envelope for `delete`.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOneResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Body for `POST /v1/qr-codes/delete-many`.
#[derive(Debug, Deserialize)]
pub struct DeleteManyBody {
    pub ids: Vec<String>,
}

/// 7-character alphanumeric short code — same alphabet/length as the
/// `nanoid(7)` call in the legacy TS code so existing data stays
/// indistinguishable.
fn generate_short_code() -> String {
    // nanoid's default alphabet is `A-Za-z0-9_-`; we mirror it here without
    // pulling in an extra crate. Bytes from successive `ObjectId::new()` give
    // us OS-RNG-quality randomness without an external `rand` dep — same
    // technique used by `wachat-features::misc::api_keys`.
    let alphabet =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let mut out = String::with_capacity(7);
    while out.len() < 7 {
        let oid = ObjectId::new();
        for byte in oid.bytes() {
            if out.len() >= 7 {
                break;
            }
            let idx = byte as usize % alphabet.len();
            out.push(alphabet[idx] as char);
        }
    }
    out
}

/// Insert a QR code row, plus an accompanying short-URL row when both
/// `isDynamic` is true and `dataType` equals `"url"`. Returns the URL that
/// was encoded (empty string when the QR isn't a URL) so the client can
/// show a preview just like the legacy code did.
pub async fn create(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    body: CreateBody,
) -> Result<CreateResult> {
    if body.name.trim().is_empty() || body.data_type.trim().is_empty() || body.data.is_null() {
        return Ok(CreateResult {
            error: Some("Name and data are required.".to_owned()),
            message: None,
            qr_code_url: None,
        });
    }

    let qr_coll = mongo.collection::<Document>(QR_COLL);
    let short_coll = mongo.collection::<Document>(SHORT_URL_COLL);

    // Pull `data.url` once — used twice below (for the short-URL row and the
    // returned `qrCodeUrl`).
    let url_in_data: Option<String> = body
        .data
        .get("url")
        .and_then(Value::as_str)
        .map(str::to_owned);

    let mut short_url_id: Option<ObjectId> = None;

    if body.is_dynamic && body.data_type == "url" {
        let original_url = url_in_data.clone().unwrap_or_default();
        let short_code = generate_short_code();
        let short_doc = doc! {
            "userId": user_oid,
            "originalUrl": original_url,
            "shortCode": short_code,
            "clickCount": 0_i64,
            "analytics": Bson::Array(Vec::new()),
            "tagIds": tag_ids_to_bson(&body.tag_ids),
            "createdAt": bson::DateTime::from_chrono(Utc::now()),
        };
        let res = short_coll
            .insert_one(short_doc)
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        if let Some(id) = res.inserted_id.as_object_id() {
            short_url_id = Some(id);
        }
    }

    let mut qr_doc = doc! {
        "userId": user_oid,
        "name": &body.name,
        "dataType": &body.data_type,
        "data": json_to_bson(&body.data),
        "config": json_to_bson(&body.config),
        "tagIds": tag_ids_to_bson(&body.tag_ids),
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(sid) = short_url_id {
        qr_doc.insert("shortUrlId", sid);
    }

    qr_coll
        .insert_one(qr_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let qr_code_url = if body.data_type == "url" {
        url_in_data.unwrap_or_default()
    } else {
        String::new()
    };

    Ok(CreateResult {
        message: Some("QR Code saved successfully!".to_owned()),
        error: None,
        qr_code_url: Some(qr_code_url),
    })
}

/// `getQrCodes` — pipelined `$lookup` on `short_urls` so the UI gets the
/// short-URL row in one round trip. Returns the same JSON the legacy
/// `JSON.parse(JSON.stringify(...))` round-trip emitted (ObjectIds as hex
/// strings, BSON dates as ISO 8601).
pub async fn list(mongo: &MongoHandle, user_oid: ObjectId) -> Result<Value> {
    let coll = mongo.collection::<Document>(QR_COLL);
    let pipeline = vec![
        doc! { "$match": { "userId": user_oid } },
        doc! { "$sort": { "createdAt": -1 } },
        doc! {
            "$lookup": {
                "from": SHORT_URL_COLL,
                "localField": "shortUrlId",
                "foreignField": "_id",
                "as": "shortUrl",
            }
        },
        doc! {
            "$unwind": {
                "path": "$shortUrl",
                "preserveNullAndEmptyArrays": true,
            }
        },
    ];
    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Value::Array(docs.into_iter().map(doc_to_json).collect()))
}

/// Bulk delete — also wipes any associated `short_urls` rows so dynamic QR
/// codes don't leak. Mirrors `deleteManyQrCodes`.
pub async fn delete_many(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    ids: &[String],
) -> Result<DeleteManyResult> {
    let valid_ids: Vec<ObjectId> = ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();
    if valid_ids.is_empty() {
        return Ok(DeleteManyResult {
            success: false,
            deleted: None,
            error: Some("No valid IDs provided.".to_owned()),
        });
    }

    let qr_coll = mongo.collection::<Document>(QR_COLL);
    let short_coll = mongo.collection::<Document>(SHORT_URL_COLL);

    let oid_array: Vec<Bson> = valid_ids.iter().copied().map(Bson::ObjectId).collect();

    // Find the QR docs first so we can collect their `shortUrlId`s before
    // delete. Same two-step the legacy code did.
    let cursor = qr_coll
        .find(doc! { "_id": { "$in": oid_array.clone() }, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let short_ids: Vec<Bson> = docs
        .iter()
        .filter_map(|d| d.get_object_id("shortUrlId").ok().map(Bson::ObjectId))
        .collect();
    if !short_ids.is_empty() {
        short_coll
            .delete_many(doc! { "_id": { "$in": short_ids } })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    }

    let res = qr_coll
        .delete_many(doc! { "_id": { "$in": oid_array }, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(DeleteManyResult {
        success: true,
        deleted: Some(res.deleted_count),
        error: None,
    })
}

/// User-scoped count of saved QR codes.
pub async fn count_for_user(mongo: &MongoHandle, user_oid: ObjectId) -> Result<u64> {
    let coll = mongo.collection::<Document>(QR_COLL);
    coll.count_documents(doc! { "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
}

/// Global count for admin dashboards.
pub async fn count_global(mongo: &MongoHandle) -> Result<u64> {
    let coll = mongo.collection::<Document>(QR_COLL);
    coll.count_documents(doc! {})
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
}

/// Single delete — also drops the dependent short-URL row when present.
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
                error: Some("Invalid ID.".to_owned()),
            });
        }
    };

    let qr_coll = mongo.collection::<Document>(QR_COLL);
    let short_coll = mongo.collection::<Document>(SHORT_URL_COLL);

    let qr = qr_coll
        .find_one(doc! { "_id": oid, "userId": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let Some(qr_doc) = qr else {
        return Ok(DeleteOneResult {
            success: false,
            error: Some("QR Code not found or access denied.".to_owned()),
        });
    };

    if let Ok(short_id) = qr_doc.get_object_id("shortUrlId") {
        short_coll
            .delete_one(doc! { "_id": short_id })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    }

    qr_coll
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(DeleteOneResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// JSON ↔ BSON helpers (kept private to this crate).
// ---------------------------------------------------------------------------

fn tag_ids_to_bson(tag_ids: &[String]) -> Bson {
    Bson::Array(
        tag_ids
            .iter()
            .filter(|s| !s.is_empty())
            .map(|s| Bson::String(s.clone()))
            .collect(),
    )
}

/// Pass-through JSON → BSON conversion for opaque payload fields. Numbers
/// preserve int-vs-float; nulls become `Bson::Null`.
fn json_to_bson(v: &Value) -> Bson {
    match v {
        Value::Null => Bson::Null,
        Value::Bool(b) => Bson::Boolean(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Bson::Int64(i)
            } else if let Some(f) = n.as_f64() {
                Bson::Double(f)
            } else {
                Bson::Null
            }
        }
        Value::String(s) => Bson::String(s.clone()),
        Value::Array(arr) => Bson::Array(arr.iter().map(json_to_bson).collect()),
        Value::Object(map) => {
            let mut d = Document::new();
            for (k, v) in map {
                d.insert(k, json_to_bson(v));
            }
            Bson::Document(d)
        }
    }
}

/// Mongo `Document` → `serde_json::Value` matching the legacy
/// `JSON.parse(JSON.stringify(...))` shape: ObjectIds as hex strings, BSON
/// dates as ISO 8601 strings.
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
