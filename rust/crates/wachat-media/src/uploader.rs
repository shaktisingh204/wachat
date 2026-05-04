//! Media upload client for the Meta WhatsApp Cloud API.
//!
//! ## Two endpoints, two flows
//!
//! ### Single-shot — `upload_for_messages`
//!
//! `POST /{phone-number-id}/media` with `multipart/form-data`:
//! * `messaging_product=whatsapp`
//! * `type={mime}`
//! * `file=@bytes`
//!
//! Returns `{ "id": "<media-id>" }`. The id is used in the
//! `messages` endpoint payload (e.g. `{"image": {"id": "..."}}`).
//! This matches `src/lib/meta-upload.ts` and the inline upload in
//! `src/app/actions/whatsapp.actions.ts` around line 437.
//!
//! ### Resumable — `upload_for_template_header`
//!
//! Used for template *header* media (image/video/document attached to
//! a template the WhatsApp account approves). Two requests:
//!
//! 1. `POST /{app-id}/uploads?file_length={N}&file_type={mime}&access_token={token}`
//!    → `{ "id": "<upload-session-id>" }`.
//! 2. `POST /{upload-session-id}` with raw bytes and header
//!    `Authorization: OAuth {token}` (note: **OAuth**, not Bearer —
//!    see TS `template.actions.ts` line 155).
//!    → `{ "h": "<handle>" }`.
//!
//! The handle is what template creation expects in
//! `components[].example.header_handle[0]`.

use std::time::Duration;

use bytes::Bytes;
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use crate::error::MediaError;
use crate::meta_error_parse::parse_meta_error;
use crate::types::{MediaId, TemplateMediaHandle};

/// Default upload timeout — uploads can be large, so we give them
/// significantly more than the typical 30 s read timeout used elsewhere.
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(60);

/// Upload client. Holds a single `reqwest::Client` so connection pools
/// are reused across calls.
#[derive(Debug, Clone)]
pub struct MediaUploader {
    http: reqwest::Client,
    base: String,
    version: String,
}

impl MediaUploader {
    /// Build a new uploader pinned to a Meta Graph API version
    /// (e.g. `"v23.0"` to match the current upstream TS code).
    pub fn new(version: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(UPLOAD_TIMEOUT)
            .build()
            .expect("reqwest client builder with default settings should not fail");

        Self {
            http,
            base: "https://graph.facebook.com".to_owned(),
            version: version.to_owned(),
        }
    }

    /// Test/internal constructor — lets `wiremock` swap in a different
    /// base URL.
    #[doc(hidden)]
    pub fn new_with_base(base: impl Into<String>, version: impl Into<String>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(UPLOAD_TIMEOUT)
            .build()
            .expect("reqwest client builder with default settings should not fail");
        Self {
            http,
            base: base.into(),
            version: version.into(),
        }
    }

    /// Single-shot multipart upload to
    /// `POST /{version}/{phone_number_id}/media`. Returns the `id`
    /// from the response body.
    pub async fn upload_for_messages(
        &self,
        phone_number_id: &str,
        token: &str,
        bytes: Bytes,
        mime: &str,
        filename: &str,
    ) -> Result<MediaId, MediaError> {
        let url = format!("{}/{}/{}/media", self.base, self.version, phone_number_id);

        // We log url + size only — never the token or raw body.
        tracing::debug!(
            target: "wachat_media::upload",
            phone_number_id,
            mime,
            size = bytes.len(),
            "single-shot media upload"
        );

        let part = Part::bytes(bytes.to_vec())
            .file_name(filename.to_owned())
            .mime_str(mime)
            .map_err(|_| MediaError::Unsupported(mime.to_owned()))?;

        let form = Form::new()
            .text("messaging_product", "whatsapp")
            .text("type", mime.to_owned())
            .part("file", part);

        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await?;

        let status = resp.status();
        let body = resp.bytes().await?;

        if !status.is_success() {
            return Err(parse_meta_error(status.as_u16(), &body));
        }

        #[derive(Deserialize)]
        struct UploadResp {
            id: String,
        }

        let parsed: UploadResp = serde_json::from_slice(&body)?;
        Ok(MediaId(parsed.id))
    }

    /// Resumable upload for template header media. Performs both the
    /// session-open and the byte-upload requests, returning the final
    /// `h` handle.
    pub async fn upload_for_template_header(
        &self,
        app_id: &str,
        token: &str,
        bytes: Bytes,
        mime: &str,
        filename: &str,
    ) -> Result<TemplateMediaHandle, MediaError> {
        let _ = filename; // not sent to Meta in this flow; kept for API symmetry.

        let file_length = bytes.len() as u64;

        // --- Step 1: open an upload session.
        // Token is on the query string per Meta's docs / the TS code
        // (template.actions.ts L150). We deliberately do not log this URL.
        let session_url = format!(
            "{}/{}/{}/uploads?file_length={}&file_type={}&access_token={}",
            self.base,
            self.version,
            app_id,
            file_length,
            urlencode(mime),
            urlencode(token),
        );

        tracing::debug!(
            target: "wachat_media::upload",
            app_id,
            mime,
            size = file_length,
            "opening resumable upload session"
        );

        let session_resp = self.http.post(&session_url).send().await?;
        let session_status = session_resp.status();
        let session_body = session_resp.bytes().await?;

        if !session_status.is_success() {
            return Err(parse_meta_error(session_status.as_u16(), &session_body));
        }

        #[derive(Deserialize)]
        struct SessionResp {
            id: String,
        }
        let SessionResp { id: session_id } = serde_json::from_slice(&session_body)?;

        // --- Step 2: upload raw bytes against the session.
        // Note: `Authorization: OAuth {token}` here, NOT Bearer.
        let upload_url = format!("{}/{}/{}", self.base, self.version, session_id);

        let upload_resp = self
            .http
            .post(&upload_url)
            .header("Authorization", format!("OAuth {token}"))
            .body(bytes)
            .send()
            .await?;

        let upload_status = upload_resp.status();
        let upload_body = upload_resp.bytes().await?;

        if !upload_status.is_success() {
            return Err(parse_meta_error(upload_status.as_u16(), &upload_body));
        }

        #[derive(Deserialize)]
        struct HandleResp {
            h: String,
        }
        let HandleResp { h } = serde_json::from_slice(&upload_body)?;
        Ok(TemplateMediaHandle(h))
    }
}

/// Minimal percent-encoder for query-string values. We avoid pulling
/// in the `url` crate just for this; only `/`, `+`, `=`, `&`, ` ` and
/// `:` realistically show up in the values we encode (mime + token).
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
