//! `QrCodes` — single public entry point for WhatsApp QR-code CRUD.
//!
//! Construct once per process and clone freely (the underlying
//! `MetaClient` is an `Arc`-backed `reqwest::Client`).
//!
//! ## Meta API surface, pinned to TS source
//!
//! Each call quotes the originating TypeScript URL line so a reviewer
//! can byte-compare the wire shape against
//! `src/app/actions/whatsapp.actions.ts`. The version segment (TS pins
//! `API_VERSION`; we accept whatever the caller passed to
//! `MetaClient::new`).
//!
//! - **list**   `GET /{phone_number_id}/message_qrdls`
//!   TS L952.
//! - **create** `POST /{phone_number_id}/message_qrdls`
//!   body `{ "prefilled_message": "...", "generate_qr_image": "SVG" }`
//!   TS L977-978.
//! - **update** `POST /{phone_number_id}/message_qrdls/{code}`
//!   body `{ "prefilled_message": "..." }`
//!   TS L999-1000 (TS uses the bare `{code}` node; we use the
//!   nested form — both are accepted by Meta).
//! - **delete** `DELETE /{phone_number_id}/message_qrdls/{code}`
//!   TS L1020 (same nesting note as update).

use sabnode_common::{ApiError, error::Result};
use serde_json::{Value, json};
use tracing::debug;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use crate::dto::{CreateQrReq, QrCode, QrListResponse, UpdateQrReq};

/// QR-code CRUD client. Cheap to clone.
#[derive(Debug, Clone)]
pub struct QrCodes {
    meta: MetaClient,
}

impl QrCodes {
    /// Build a new client. Construct once per process, clone freely.
    pub fn new(meta: MetaClient) -> Self {
        Self { meta }
    }

    /// List all QR codes attached to `phone_number_id`.
    ///
    /// Wire call: `GET {version}/{phone_number_id}/message_qrdls`
    /// (TS L952). Returns the unwrapped `data` array; an empty array
    /// is returned when Meta omits `data` entirely (matches the TS
    /// `response.data.data || []` fallback at L955).
    pub async fn list(&self, project: &Project, phone_number_id: &str) -> Result<Vec<QrCode>> {
        let token = project_access_token(project)?;
        let path = format!("{phone_number_id}/message_qrdls");

        debug!(phone_number_id, "qr-codes: listing");

        let env: QrListResponse = self.meta.get_json(&path, token).await?;
        Ok(env.data)
    }

    /// Create a new QR code on `phone_number_id`.
    ///
    /// Wire call: `POST {version}/{phone_number_id}/message_qrdls`
    /// with body `{ "prefilled_message": "...", "generate_qr_image":
    /// "PNG"|"SVG" }` (TS L977-978).
    ///
    /// Validation: the prefilled message is `.trim()`'d before send
    /// and must be non-empty (mirrors TS L971-973).
    pub async fn create(
        &self,
        project: &Project,
        phone_number_id: &str,
        req: CreateQrReq,
    ) -> Result<QrCode> {
        let token = project_access_token(project)?;

        let trimmed = req.prefilled_message.trim();
        if trimmed.is_empty() {
            return Err(ApiError::BadRequest(
                "Prefilled message is required.".to_owned(),
            ));
        }

        let body = json!({
            "prefilled_message": trimmed,
            "generate_qr_image": req.generate_qr_image.as_meta_str(),
        });

        let path = format!("{phone_number_id}/message_qrdls");

        debug!(phone_number_id, format = ?req.generate_qr_image, "qr-codes: creating");

        let resp: Value = self.meta.post_json(&path, token, &body).await?;
        decode_qr(resp)
    }

    /// Update the prefilled message of an existing QR code.
    ///
    /// Wire call: `POST {version}/{phone_number_id}/message_qrdls/{code}`
    /// with body `{ "prefilled_message": "..." }` (TS L999-1000).
    ///
    /// The prefilled message is `.trim()`'d before send (mirrors
    /// TS L1000 `prefilledMessage.trim()`).
    pub async fn update(
        &self,
        project: &Project,
        phone_number_id: &str,
        code: &str,
        req: UpdateQrReq,
    ) -> Result<QrCode> {
        let token = project_access_token(project)?;

        if code.is_empty() {
            return Err(ApiError::BadRequest("QR code is required.".to_owned()));
        }

        let body = json!({
            "prefilled_message": req.prefilled_message.trim(),
        });

        let path = format!("{phone_number_id}/message_qrdls/{code}");

        debug!(phone_number_id, code, "qr-codes: updating");

        let resp: Value = self.meta.post_json(&path, token, &body).await?;
        // Meta's update response sometimes echoes only `{ "success": true }`
        // and other times the full QR node. Fall back to a synthesized
        // record if no `code` is in the response — matches the TS handler
        // which discards the body entirely (TS L1003).
        if resp.get("code").and_then(Value::as_str).is_some() {
            decode_qr(resp)
        } else {
            Ok(QrCode {
                code: code.to_owned(),
                prefilled_message: req.prefilled_message.trim().to_owned(),
                // We don't know the deep_link_url without re-fetching;
                // construct the canonical Meta-format link so the
                // returned record is still useful to the caller.
                deep_link_url: format!("https://wa.me/message/{code}"),
                qr_image_url: None,
            })
        }
    }

    /// Delete a QR code.
    ///
    /// Wire call: `DELETE {version}/{phone_number_id}/message_qrdls/{code}`
    /// (TS L1020).
    pub async fn delete(
        &self,
        project: &Project,
        phone_number_id: &str,
        code: &str,
    ) -> Result<()> {
        let token = project_access_token(project)?;

        if code.is_empty() {
            return Err(ApiError::BadRequest("QR code is required.".to_owned()));
        }

        let path = format!("{phone_number_id}/message_qrdls/{code}");

        debug!(phone_number_id, code, "qr-codes: deleting");

        self.meta.delete(&path, token).await?;
        Ok(())
    }
}

// =====================================================================
// helpers
// =====================================================================

fn project_access_token(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest(
                "Project not found or access token is missing.".to_owned(),
            )
        })
}

/// Decode a raw `serde_json::Value` into a `QrCode`. Surfaces a clear
/// internal error if the Meta response is missing the required fields.
fn decode_qr(v: Value) -> Result<QrCode> {
    serde_json::from_value::<QrCode>(v)
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("invalid Meta QR-code response: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;
    use chrono::Utc;

    fn project_with_token(token: Option<&str>) -> Project {
        Project {
            id: ObjectId::new(),
            user_id: ObjectId::new(),
            name: "test".into(),
            waba_id: Some("WABA".into()),
            business_id: None,
            app_id: None,
            access_token: token.map(str::to_owned),
            phone_numbers: vec![],
            messages_per_second: None,
            credits: None,
            plan_id: None,
            review_status: None,
            ban_state: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn project_token_missing_is_bad_request() {
        let p = project_with_token(None);
        let err = project_access_token(&p).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)), "got {err:?}");
    }

    #[test]
    fn project_token_empty_is_bad_request() {
        let p = project_with_token(Some(""));
        let err = project_access_token(&p).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)), "got {err:?}");
    }

    #[test]
    fn project_token_present_returns_str() {
        let p = project_with_token(Some("EAA-token"));
        let t = project_access_token(&p).unwrap();
        assert_eq!(t, "EAA-token");
    }

    #[test]
    fn decode_qr_roundtrips_full_record() {
        let v = json!({
            "code": "C1",
            "prefilled_message": "hi",
            "deep_link_url": "https://wa.me/message/C1",
            "qr_image_url": "https://x/img.svg"
        });
        let qr = decode_qr(v).unwrap();
        assert_eq!(qr.code, "C1");
        assert_eq!(qr.qr_image_url.as_deref(), Some("https://x/img.svg"));
    }

    #[test]
    fn decode_qr_rejects_missing_code() {
        let v = json!({ "prefilled_message": "hi", "deep_link_url": "https://wa.me/message/x" });
        let err = decode_qr(v).unwrap_err();
        assert!(matches!(err, ApiError::Internal(_)));
    }
}
