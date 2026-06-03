//! Per-phone-number WhatsApp Business **calling settings** management.
//!
//! TS source: `src/app/actions/calling.actions.ts` —
//! `getPhoneNumberCallingSettings` and `savePhoneNumberCallingSettings`.
//!
//! Meta exposes calling settings on the phone-number-id node:
//! - `GET /{phone-number-id}?fields=calling` — read-only fetch.
//! - `POST /{phone-number-id}` with `{messaging_product, calling: {...}}` —
//!   writes the full settings envelope (or just `{status}` for the toggle).
//!
//! The legacy TS pinned `v24.0`. We defer to the caller's `MetaClient` (the
//! API crate currently uses `v23.0`); Meta accepts calling on either. The
//! payload shape and field names mirror the legacy server action verbatim.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

// ---------------------------------------------------------------------------
// Domain DTOs — match the `CallingSettings` TS type exactly so the
// browser-facing client can pass through Meta's payload as-is.
// ---------------------------------------------------------------------------

/// Single weekly schedule entry. `open_time` / `close_time` are `"HHMM"`
/// 24-hour strings (Meta's wire format).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyOperatingHours {
    pub day_of_week: String,
    pub open_time: String,
    pub close_time: String,
}

/// Single holiday window. `date` is `"YYYY-MM-DD"`; times are `"HHMM"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolidaySchedule {
    pub date: String,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallHours {
    pub status: String,
    pub timezone_id: String,
    #[serde(default)]
    pub weekly_operating_hours: Vec<WeeklyOperatingHours>,
    #[serde(default)]
    pub holiday_schedule: Vec<HolidaySchedule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SipServer {
    pub hostname: String,
    pub port: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_uri_user_params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SipSettings {
    pub status: String,
    #[serde(default)]
    pub servers: Vec<SipServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallIcons {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restrict_to_user_countries: Option<Vec<String>>,
}

/// Mirrors the `CallingSettings` TS type. Open-ended on read (`Value`-shaped
/// to tolerate fields Meta may add) but typed on write so the schema is
/// enforced at the API edge.
#[derive(Debug, Clone, Serialize)]
pub struct GetSettingsResponse {
    /// Raw `calling` object Meta returned, or `null` if the phone-number-id
    /// has no calling settings yet.
    pub settings: Value,
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/calling/projects/{id}/phone-numbers/{pnid}/settings`.
///
/// The legacy TS server action has two distinct write modes:
///
/// 1. **Quick toggle** — only `status` is filled in (`ENABLED`/`DISABLED`).
///    Meta accepts a minimal `{calling: {status}}` payload.
/// 2. **Full save** — every field is filled in: call hours, call icons,
///    callback permission, SIP servers.
///
/// We model both with one optional-heavy DTO. If `quick_status` is `Some`,
/// only that gets written; otherwise the full envelope is sent.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSettingsBody {
    /// If present, only the calling status is written (quick toggle path).
    #[serde(default)]
    pub quick_status: Option<String>,

    // -- full-save fields (used iff quick_status is None) --
    #[serde(default)]
    pub call_icon_visibility: Option<String>,
    #[serde(default)]
    pub restrict_to_user_countries: Option<Vec<String>>,
    #[serde(default)]
    pub callback_permission_status: Option<String>,
    #[serde(default)]
    pub call_hours: Option<CallHours>,
    #[serde(default)]
    pub sip: Option<SipSettings>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

// ---------------------------------------------------------------------------
// Meta calls
// ---------------------------------------------------------------------------

/// `GET /{phone-number-id}?fields=calling`. The TS function returned
/// `{ settings: response.data.calling }` — we pass the inner `calling` object
/// through verbatim so the browser-side TS retains the exact `CallingSettings`
/// shape.
pub async fn get_settings(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
) -> Result<GetSettingsResponse> {
    let path = format!("{phone_number_id}?fields=calling");
    let resp: Value = meta.get_json(&path, token_for(project)?).await?;
    let calling = resp.get("calling").cloned().unwrap_or(Value::Null);
    Ok(GetSettingsResponse { settings: calling })
}

/// `POST /{phone-number-id}` with `{messaging_product:"whatsapp", calling:{...}}`.
///
/// Two payload shapes:
///
/// - **Quick toggle**: `{calling: {status}}`. The TS short-circuits on
///   `formData.get('status')` truthy.
/// - **Full save**: every nested object included. Mirrors the legacy
///   `payload.calling = { ... }` block at line 55.
pub async fn save_settings(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: SaveSettingsBody,
) -> Result<()> {
    let calling: Value = if let Some(status) = body.quick_status {
        json!({ "status": status })
    } else {
        let mut obj = Map::new();
        obj.insert(
            "status".into(),
            // The legacy TS reads `formData.get('call_hours_status')` as the
            // top-level calling.status here — preserved verbatim. If absent
            // we fall back to "DISABLED" (matches the TS `|| 'DISABLED'`).
            Value::String(
                body.call_hours
                    .as_ref()
                    .map(|h| h.status.clone())
                    .unwrap_or_else(|| "DISABLED".to_owned()),
            ),
        );
        if let Some(v) = body.call_icon_visibility {
            obj.insert("call_icon_visibility".into(), Value::String(v));
        }
        if let Some(countries) = body.restrict_to_user_countries {
            if !countries.is_empty() {
                obj.insert(
                    "call_icons".into(),
                    json!({ "restrict_to_user_countries": countries }),
                );
            }
        }
        if let Some(v) = body.callback_permission_status {
            obj.insert("callback_permission_status".into(), Value::String(v));
        }
        if let Some(hours) = body.call_hours {
            obj.insert(
                "call_hours".into(),
                serde_json::to_value(hours).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?,
            );
        }
        if let Some(sip) = body.sip {
            obj.insert(
                "sip".into(),
                serde_json::to_value(sip).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?,
            );
        }
        Value::Object(obj)
    };

    let payload = json!({
        "messaging_product": "whatsapp",
        "calling": calling,
    });

    let _: Value = meta
        .post_json(phone_number_id, token_for(project)?, &payload)
        .await?;
    Ok(())
}
