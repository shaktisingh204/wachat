//! Wire-format DTOs for the SabChat **shift presence** endpoints.
//!
//! Mirrors the document shape of `sabchat_shift_rules` (see crate docs)
//! plus the small JSON envelopes returned by `/sync` and `/preview`.
//! Every body uses `#[serde(rename_all = "camelCase")]` so JSON requests
//! and responses round-trip with the TS clients exactly like the sibling
//! routers do.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Shift-rule whitelists
// ---------------------------------------------------------------------------

/// Accepted values for `whenStatus` on a shift rule. Mirrors the three
/// attendance phases the HRM module emits.
pub const VALID_WHEN_STATUSES: &[&str] = &["checked_in", "on_break", "checked_out"];

/// Accepted values for `setPresence` on a shift rule. Matches the
/// `VALID_PRESENCE_STATUSES` list in `sabchat-teams` so a rule can only
/// produce a presence row the inbox UI already understands.
pub const VALID_PRESENCE_STATUSES: &[&str] = &["online", "away", "busy", "offline"];

// ---------------------------------------------------------------------------
// POST /v1/sabchat/shifts/rules — create_rule
// ---------------------------------------------------------------------------

/// Body for `POST /rules` — create a new tenant-scoped shift rule.
///
/// `active` defaults to `true` because the typical caller (the rules UI)
/// creates rules in the active state; pass `false` explicitly to stage a
/// disabled rule.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleBody {
    pub name: String,
    pub when_status: String,
    pub set_presence: String,
    #[serde(default = "default_true")]
    pub active: bool,
}

/// Response body for `POST /rules`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleResponse {
    pub rule_id: String,
}

fn default_true() -> bool {
    true
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/shifts/rules — list_rules
// ---------------------------------------------------------------------------

/// Response body for `GET /rules`. Returns raw stored documents so the
/// caller drives existing UI that already understands the rule shape.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRulesResponse {
    #[schema(value_type = Vec<Object>)]
    pub rules: Vec<Value>,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/shifts/rules/:id — get_rule
// ---------------------------------------------------------------------------

/// Response body for `GET /rules/:id`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetRuleResponse {
    #[schema(value_type = Object)]
    pub rule: Value,
}

// ---------------------------------------------------------------------------
// PATCH /v1/sabchat/shifts/rules/:id — update_rule
// ---------------------------------------------------------------------------

/// Body for `PATCH /rules/:id`. Every field is optional — only the
/// fields explicitly set are applied; `updatedAt` is always refreshed.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub when_status: Option<String>,
    #[serde(default)]
    pub set_presence: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

impl UpdateRuleBody {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.name.is_none()
            && self.when_status.is_none()
            && self.set_presence.is_none()
            && self.active.is_none()
    }
}

// ---------------------------------------------------------------------------
// POST /v1/sabchat/shifts/sync — sync
// ---------------------------------------------------------------------------

/// Empty body for `POST /sync`. Kept as a struct so the OpenAPI surface
/// is stable when future flags get added (e.g. dry-run, window override).
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncBody {}

/// Response body for `POST /sync`. Also returned by the public
/// `sync_tenant` helper so the cron runner can log the result.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    /// Total `crm_attendance` rows considered for the tenant's "today"
    /// window. Includes rows whose employee did not map to an agent.
    pub scanned: u64,
    /// Number of `sabchat_agent_presence` rows written (insert or update)
    /// during this run.
    pub updated: u64,
}

// ---------------------------------------------------------------------------
// GET /v1/sabchat/shifts/preview — preview
// ---------------------------------------------------------------------------

/// Query string for `GET /preview`. Single-agent preview path.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PreviewQuery {
    /// Hex `ObjectId` of the agent (user id stored on `crm_employees.userId`).
    pub agent_id: String,
}

/// Response body for `GET /preview`. Mirrors the source-of-truth fields
/// the inbox UI needs to render a "what would happen on next sync" hint.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    /// What the next `/sync` would write for this agent.
    pub effective_presence: String,
    /// Where the answer came from. One of `"hrm-rule"`, `"hrm-default"`,
    /// `"no-employee"`, `"no-attendance"`.
    pub source: String,
    /// Optional pointer to the rule that produced `effectivePresence`.
    /// Hex `ObjectId`. Absent when no rule matched.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_rule: Option<String>,
    /// Optional last-seen attendance status (`checked_in`/`on_break`/
    /// `checked_out`) for the agent's employee row today — useful for
    /// the UI to explain *why* the rule fired.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendance_status: Option<String>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by PATCH / DELETE endpoints —
/// matches the legacy TS server-action return type used elsewhere in the
/// workspace.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rule_defaults_active_true() {
        let body: CreateRuleBody = serde_json::from_value(serde_json::json!({
            "name": "On duty",
            "whenStatus": "checked_in",
            "setPresence": "online",
        }))
        .unwrap();
        assert!(body.active);
    }

    #[test]
    fn update_rule_is_empty_detects_all_unset() {
        let empty = UpdateRuleBody::default();
        assert!(empty.is_empty());
        let touched = UpdateRuleBody {
            active: Some(false),
            ..Default::default()
        };
        assert!(!touched.is_empty());
    }

    #[test]
    fn whitelists_match_sibling_router() {
        // Mirrors `sabchat-teams`. Any drift here would let `/sync`
        // produce a presence value the inbox doesn't render.
        assert_eq!(
            VALID_PRESENCE_STATUSES,
            &["online", "away", "busy", "offline"]
        );
    }
}
