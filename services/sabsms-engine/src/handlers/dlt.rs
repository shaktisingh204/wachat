//! India DLT endpoints (V2.8) — service-token-protected.
//!
//!   - `POST /v1/dlt/scrub-preview` — live "Will this pass DLT?" for
//!     the template editor panel
//!   - `POST /v1/internal/dlt/invalidate` — drop the cached registry
//!     for a workspace after Next-side CRUD

use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    compliance::{dlt, dlt_store},
    errors::{EngineError, EngineResult},
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrubPreviewBody {
    pub workspace_id: String,
    /// Final (rendered) message body to scrub.
    pub body: String,
    /// Registered content-template id to scrub against, when known.
    #[serde(default)]
    pub dlt_template_id: Option<String>,
    /// Sender header the message would use.
    #[serde(default)]
    pub header: Option<String>,
}

/// POST /v1/dlt/scrub-preview — run the full DLT scrub without sending.
///
/// Response:
/// ```json
/// {
///   "trace": [ { "check": "dlt_template_match", "verdict": "allow" }, … ],
///   "templateFound": true,
///   "templateCategory": "promotional",
///   "predictedSuffix": "P",
///   "predictedCategory": { "category": "promotional", "confidence": 0.83 },
///   "wouldBlock": false,
///   "blockCheck": null
/// }
/// ```
///
/// `predictedSuffix` comes from the REGISTERED category when the
/// template resolves; otherwise from the content classifier's hint
/// (promotional→P, transactional→T, service→S, unknown→null).
pub async fn scrub_preview(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ScrubPreviewBody>,
) -> EngineResult<Json<Value>> {
    if body.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }

    let registry = dlt_store::load_registry(&state, &body.workspace_id).await;

    let template = body
        .dlt_template_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .and_then(|tid| registry.find_template(tid));
    let header = body.header.as_deref().filter(|s| !s.is_empty());
    let registered_header = header.and_then(|h| registry.find_header(h));

    let ctx = dlt::FullScrubContext {
        body: &body.body,
        header,
        registered_header,
        template,
        chain: registry.chain.as_ref(),
    };
    let trace = dlt::full_scrub(&ctx);
    let block = dlt::first_block(&trace).map(|(check, _)| check.to_string());

    let (predicted_category, confidence) = dlt::classify_content(&body.body);
    let predicted_suffix: Option<String> = match template {
        Some(t) => Some(dlt::predict_suffix(t.category).to_string()),
        None => match predicted_category {
            dlt::PredictedCategory::Promotional => Some("P".into()),
            dlt::PredictedCategory::Transactional => Some("T".into()),
            dlt::PredictedCategory::Service => Some("S".into()),
            dlt::PredictedCategory::Unknown => None,
        },
    };

    Ok(Json(json!({
        "trace": trace,
        "templateFound": template.is_some(),
        "templateCategory": template.map(|t| t.category.as_str()),
        "registryConfigured": registry.configured,
        "predictedSuffix": predicted_suffix,
        "predictedCategory": {
            "category": predicted_category.as_str(),
            "confidence": confidence,
        },
        "wouldBlock": block.is_some(),
        "blockCheck": block,
    })))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateDltBody {
    pub workspace_id: String,
}

/// POST /v1/internal/dlt/invalidate — drop the cached DLT registry for
/// a workspace (the TS side calls this after every registry write).
pub async fn invalidate(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<InvalidateDltBody>,
) -> EngineResult<Json<Value>> {
    dlt_store::invalidate_workspace(&body.workspace_id).await;
    Ok(Json(json!({ "ok": true })))
}
