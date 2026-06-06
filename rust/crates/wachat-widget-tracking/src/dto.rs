//! Wire DTOs for the widget-tracking endpoints. `camelCase` to match the
//! JSON the `/wachat/integrations/whatsapp-widget-generator` page sends
//! and the `widgetSettings` shape on the `projects` collection.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Response for `GET /{project_id}/stats` — the project's widget
/// analytics. Defaults to zeros when the project has never recorded an
/// event (mirrors the page's `|| { loads: 0, opens: 0, clicks: 0 }`).
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WidgetStats {
    pub loads: i64,
    pub opens: i64,
    pub clicks: i64,
}

/// Body for `POST /{project_id}/track` — record a single widget event.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TrackEventBody {
    /// One of `"load"`, `"open"`, `"click"`. Anything else is a 422.
    pub event_type: String,
}

/// Body for `PUT /{project_id}/advanced-settings` — the new behaviour
/// knobs stored under `widgetSettings.advanced`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSettingsBody {
    /// Delay (ms) before the widget auto-opens. `0` disables auto-open.
    pub auto_open_delay: i64,
    /// Whether A/B style testing is enabled for this widget.
    pub ab_test_enabled: bool,
    /// Active style variant identifier (e.g. `"a"`, `"b"`, `"classic"`).
    pub style_variant: String,
}

/// `{ success: true }` envelope for mutations (track / advanced-settings).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
