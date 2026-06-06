//! Wire DTOs for the wachat auto-reply-settings endpoints.
//!
//! `camelCase` to match the JSON the `/wachat/auto-reply` page sends and
//! the exact sub-document shapes stored on the `projects` doc under
//! `autoReplySettings.*` and `optInOutSettings` (see
//! `src/lib/definitions.ts` — `AutoReplySettings` / `OptInOutSettings`).
//!
//! Each PUT/PATCH body maps 1:1 to one `$set` on the project document,
//! mirroring `src/app/actions/project.actions.ts`:
//!
//! | Endpoint              | TS source                       | `$set` path                       |
//! |-----------------------|---------------------------------|-----------------------------------|
//! | PATCH `/master-switch`| `handleUpdateMasterSwitch`      | `autoReplySettings.masterEnabled` |
//! | PUT `/welcome-message`| `handleUpdateAutoReplySettings` | `autoReplySettings.welcomeMessage`|
//! | PUT `/inactive-hours` | `handleUpdateAutoReplySettings` | `autoReplySettings.inactiveHours` |
//! | PUT `/general`        | `handleUpdateAutoReplySettings` | `autoReplySettings.general`       |
//! | PUT `/ai-assistant`   | `handleUpdateAutoReplySettings` | `autoReplySettings.aiAssistant`   |
//! | PUT `/opt-in-out`     | `handleUpdateOptInOutSettings`  | `optInOutSettings`                |

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /{project_id}` — the project's auto-reply + opt-in/out sub-docs.
///
/// Both fields are cleaned-JSON projections of the stored sub-documents,
/// or `null` when the project has never saved them.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    /// `projects.autoReplySettings` sub-document (or `null`).
    #[schema(value_type = Object, nullable)]
    pub auto_reply_settings: Value,
    /// `projects.optInOutSettings` sub-document (or `null`).
    #[schema(value_type = Object, nullable)]
    pub opt_in_out_settings: Value,
}

/// Body for `PATCH /{project_id}/master-switch`.
///
/// Mirrors `handleUpdateMasterSwitch(projectId, isEnabled)` → `$set`
/// `{ "autoReplySettings.masterEnabled": enabled }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MasterSwitchBody {
    pub enabled: bool,
}

/// Body for `PUT /{project_id}/welcome-message`.
///
/// Mirrors the `welcomeMessage` branch: `{ enabled, message }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WelcomeMessageBody {
    pub enabled: bool,
    #[serde(default)]
    pub message: String,
}

/// Body for `PUT /{project_id}/inactive-hours`.
///
/// Mirrors the `inactiveHours` branch:
/// `{ enabled, message, startTime, endTime, timezone, days }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InactiveHoursBody {
    pub enabled: bool,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub start_time: String,
    #[serde(default)]
    pub end_time: String,
    #[serde(default)]
    pub timezone: String,
    /// Active weekdays — `0` = Sunday … `6` = Saturday.
    #[serde(default)]
    pub days: Vec<i32>,
}

/// One keyword-matched general reply rule. Mirrors `GeneralReplyRule`
/// in `src/lib/definitions.ts`.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GeneralReplyRule {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub keywords: String,
    #[serde(default)]
    pub reply: String,
    /// `"contains"` or `"exact"`.
    #[serde(default)]
    pub match_type: String,
}

/// Body for `PUT /{project_id}/general`.
///
/// Mirrors the `general` branch: `{ enabled, replies }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GeneralBody {
    pub enabled: bool,
    #[serde(default)]
    pub replies: Vec<GeneralReplyRule>,
}

/// Body for `PUT /{project_id}/ai-assistant`.
///
/// Mirrors the `aiAssistant` branch: `{ enabled, context, autoTranslate }`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AiAssistantBody {
    pub enabled: bool,
    #[serde(default)]
    pub context: String,
    #[serde(default)]
    pub auto_translate: bool,
}

/// Body for `PUT /{project_id}/opt-in-out`.
///
/// Mirrors `handleUpdateOptInOutSettings` → `$set` the whole
/// `optInOutSettings` sub-document. The TS shim split comma-strings into
/// arrays in the action; here the page sends ready-made arrays.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OptInOutBody {
    pub enabled: bool,
    #[serde(default)]
    pub opt_in_keywords: Vec<String>,
    #[serde(default)]
    pub opt_out_keywords: Vec<String>,
    #[serde(default)]
    pub opt_in_response: String,
    #[serde(default)]
    pub opt_out_response: String,
}

/// `{ success: true }` envelope for the mutation endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
