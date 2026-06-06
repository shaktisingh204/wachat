//! Scheduled analytics reports.
//!
//! Net-new surface (Wave D) backing the response-time-tracker page's
//! "schedule report" controls. A scheduled report says "email `recipient`
//! an analytics digest every `frequency`". Rows live in the net-new
//! `wa_scheduled_reports` collection.
//!
//! - `GET    /projects/{project_id}/scheduled-reports`
//! - `POST   /projects/{project_id}/scheduled-reports`
//! - `DELETE /scheduled-reports/{report_id}`

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::instrument;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

const COLL: &str = "wa_scheduled_reports";

#[derive(Debug, Serialize)]
pub struct ReportsResp {
    pub reports: Value,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

/// Body for `POST /projects/{project_id}/scheduled-reports`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    /// Email address (or other delivery handle) the digest is sent to.
    pub recipient: String,
    /// One of `daily` | `weekly` | `monthly`.
    pub frequency: String,
}

fn valid_frequency(f: &str) -> bool {
    matches!(f, "daily" | "weekly" | "monthly")
}

/// List the project's scheduled reports, newest first.
#[instrument(skip_all)]
pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ReportsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_scheduled_reports.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_scheduled_reports.find")))?;
    Ok(Json(ReportsResp {
        reports: docs_to_json(docs),
    }))
}

/// Create a scheduled report for the project.
#[instrument(skip_all)]
pub async fn create(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<MsgResp>> {
    let recipient = body.recipient.trim();
    if recipient.is_empty() {
        return Err(ApiError::BadRequest("recipient is required.".to_owned()));
    }
    let frequency = body.frequency.trim().to_lowercase();
    if !valid_frequency(&frequency) {
        return Err(ApiError::BadRequest(
            "frequency must be one of: daily, weekly, monthly.".to_owned(),
        ));
    }

    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.insert_one(doc! {
        "projectId": project.id,
        "recipient": recipient,
        "frequency": &frequency,
        "active": true,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("wa_scheduled_reports.insert_one"))
    })?;
    Ok(Json(MsgResp {
        message: "Scheduled report created.".to_owned(),
    }))
}

/// Delete a scheduled report by id.
#[instrument(skip_all)]
pub async fn delete(
    _user: AuthUser,
    Path(report_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&report_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("wa_scheduled_reports.delete_one"))
        })?;
    Ok(Json(OkResp { success: true }))
}
