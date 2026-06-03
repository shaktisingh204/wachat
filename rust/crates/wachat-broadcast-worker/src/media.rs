//! Header media upload — port of `uploadHeaderMediaIfNeeded` from
//! `src/workers/broadcast/control.worker.js` (lines 52-100).
//!
//! Called once per broadcast, on the first time the control worker picks
//! up the job. Reads the binary blob off `broadcasts.headerMediaFile`,
//! POSTs it as multipart to `/{phone-number-id}/media`, and stores the
//! returned media id back on the broadcast doc. Idempotent: if
//! `headerMediaId` is already set we skip — survives crash recovery.

use anyhow::{Context, Result, anyhow};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use reqwest::multipart::{Form, Part};
use tracing::{debug, info, warn};

/// Outcome of a media upload.
#[derive(Debug, Clone)]
pub struct MediaUploadResult {
    /// Meta media id (used as `parameters[0].image.id` etc. on the send).
    pub id: String,
    /// `IMAGE` / `VIDEO` / `DOCUMENT` — stored on the broadcast doc and
    /// used by the payload builder to pick the right header parameter
    /// shape.
    pub media_type: String,
}

/// If `broadcast.headerMediaFile` is populated and `headerMediaId` is
/// not, upload the bytes to Meta and persist the resulting id.
///
/// Returns:
///   * `Ok(Some(result))` — fresh upload, caller should mirror `id` /
///     `media_type` onto the in-memory broadcast struct.
///   * `Ok(None)`         — nothing to do (no file, or already uploaded).
///   * `Err(_)`           — upload or DB write failed.
///
/// On a fresh upload the broadcast document is updated with:
///
///   * `headerMediaId`         — Meta's id,
///   * `headerMediaType`       — `IMAGE` / `VIDEO` / `DOCUMENT`,
///   * `headerMediaUploadedAt` — wall clock,
///
/// matching the Node `updateOne` at lines 88-97.
pub async fn upload_header_media_if_needed(
    broadcasts_coll: &Collection<Document>,
    broadcast: &Document,
    api_version: &str,
    http: &reqwest::Client,
) -> Result<Option<MediaUploadResult>> {
    // Already uploaded? Skip.
    if broadcast.get_str("headerMediaId").is_ok() {
        return Ok(None);
    }

    // No file to upload?
    let Some(file) = broadcast.get_document("headerMediaFile").ok() else {
        return Ok(None);
    };

    let phone_number_id = broadcast
        .get_str("phoneNumberId")
        .map_err(|_| anyhow!("broadcast.phoneNumberId missing"))?;
    let access_token = broadcast
        .get_str("accessToken")
        .map_err(|_| anyhow!("broadcast.accessToken missing"))?;

    let name = file.get_str("name").unwrap_or("upload.bin").to_owned();
    let content_type = file
        .get_str("type")
        .unwrap_or("application/octet-stream")
        .to_owned();

    // Header media bytes can be stored as a Mongo Binary or as a nested
    // `{ buffer: Binary }` envelope (Node's `Buffer.from(buffer.buffer || buffer)`).
    // We accept both shapes.
    let bytes = extract_bytes(file).context("extract headerMediaFile bytes")?;

    debug!(
        broadcast_id = ?broadcast.get_object_id("_id").ok(),
        bytes = bytes.len(),
        %content_type,
        "uploading header media to Meta"
    );

    let part = Part::bytes(bytes)
        .file_name(name)
        .mime_str(&content_type)
        .map_err(|e| anyhow!("invalid Content-Type for header media: {e}"))?;

    let form = Form::new()
        .text("messaging_product", "whatsapp")
        .part("file", part);

    let url = format!("https://graph.facebook.com/{api_version}/{phone_number_id}/media",);

    let resp = http
        .post(&url)
        .bearer_auth(access_token)
        .multipart(form)
        .send()
        .await
        .context("POST /media to Meta")?;

    let status = resp.status();
    let body_text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(anyhow!(
            "Media upload failed ({status}): {}",
            body_text.chars().take(300).collect::<String>()
        ));
    }

    let body: serde_json::Value =
        serde_json::from_str(&body_text).context("parse Meta /media response as JSON")?;
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            anyhow!(
                "Media upload failed: {}",
                body_text.chars().take(300).collect::<String>()
            )
        })?
        .to_owned();

    let media_type = if content_type.starts_with("video") {
        "VIDEO"
    } else if content_type.starts_with("image") {
        "IMAGE"
    } else {
        "DOCUMENT"
    }
    .to_owned();

    let bcast_id = broadcast
        .get_object_id("_id")
        .map_err(|_| anyhow!("broadcast._id missing"))?;
    persist_media_id(broadcasts_coll, bcast_id, &id, &media_type).await?;

    info!(media_id = %id, %media_type, "header media uploaded");
    Ok(Some(MediaUploadResult { id, media_type }))
}

/// Pull the binary payload out of a `headerMediaFile` document. Node
/// stores either:
///
///   1. `{ buffer: <Binary>, name, type }` — when serialized via
///      JSON.parse(JSON.stringify(...)) round-tripping where Buffer
///      becomes `{ type: 'Buffer', data: [...] }`, OR
///   2. a flat `Binary` value at `buffer` (newer code path).
///
/// We handle both. If neither is present we fail loudly so the caller
/// flips the broadcast to `FAILED_PROCESSING` instead of silently
/// uploading an empty file.
fn extract_bytes(file: &Document) -> Result<Vec<u8>> {
    if let Ok(bin) = file.get_binary_generic("buffer") {
        return Ok(bin.clone());
    }
    // Fallback for the JSON-roundtripped shape.
    if let Ok(inner) = file.get_document("buffer") {
        if let Ok(bin) = inner.get_binary_generic("buffer") {
            return Ok(bin.clone());
        }
        if let Ok(arr) = inner.get_array("data") {
            let mut out = Vec::with_capacity(arr.len());
            for item in arr {
                if let Some(n) = item.as_i32() {
                    out.push(n as u8);
                } else if let Some(n) = item.as_i64() {
                    out.push(n as u8);
                }
            }
            return Ok(out);
        }
    }
    Err(anyhow!("headerMediaFile.buffer is empty or unrecognized"))
}

async fn persist_media_id(
    coll: &Collection<Document>,
    broadcast_id: ObjectId,
    media_id: &str,
    media_type: &str,
) -> Result<()> {
    let now = bson::DateTime::from_chrono(Utc::now());
    let res = coll
        .update_one(
            doc! { "_id": broadcast_id },
            doc! {
                "$set": {
                    "headerMediaId": media_id,
                    "headerMediaType": media_type,
                    "headerMediaUploadedAt": now,
                }
            },
        )
        .await
        .context("broadcasts.updateOne(headerMediaId)")?;
    if res.matched_count == 0 {
        warn!(
            ?broadcast_id,
            "broadcast disappeared while persisting headerMediaId"
        );
    }
    Ok(())
}
