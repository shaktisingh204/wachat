//! Wire DTOs for the wachat integrations-hub OAuth-connection surface.
//!
//! `camelCase` everywhere to match the JSON the `/wachat/integrations`
//! page (OAuth Connections tab) consumes.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// One row in the `GET /oauth` response — the connection state for a
/// single provider, scoped to the calling user.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OauthConnection {
    /// Provider slug: `facebook` | `shopify` | `google-analytics`.
    pub provider: String,
    /// Whether the caller currently has an active connection record.
    pub connected: bool,
    /// Human label for the connected account (e.g. WABA / store name).
    /// `None` when no connection exists yet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_label: Option<String>,
    /// ISO-8601 timestamp of when the connection was recorded.
    /// `None` when not connected.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<String>,
}

/// Response envelope for `GET /oauth`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListConnectionsResponse {
    pub connections: Vec<OauthConnection>,
}

/// Optional body for `POST /oauth/{provider}/connect`. The real OAuth
/// handoff happens in Next; this just records an initiated intent, so an
/// account label is the only thing worth carrying through.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConnectBody {
    /// Optional label for the account being connected.
    #[serde(default)]
    pub account_label: Option<String>,
}

/// `{ success: true }` envelope for the connect / disconnect mutations.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
