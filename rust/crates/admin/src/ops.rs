//! Admin-gated operational endpoints — cron triggers and other one-off
//! maintenance buttons surfaced on `/admin/dashboard/system`.

use std::sync::Arc;

use axum::{Json, Router, extract::FromRef, routing::post};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;
use serde::Serialize;
use utoipa::ToSchema;

use crate::guard::require_admin;

#[derive(Debug, Serialize, ToSchema)]
pub struct CronTriggerResponse {
    pub ok: bool,
    pub message: String,
}

/// `POST /v1/admin/run-cron` — placeholder cron trigger. Mirrors
/// `handleRunCron` in `user.actions.ts` which is itself a stub. Kept as an
/// endpoint so the admin UI button can hit a stable URL once real cron
/// runners come online.
pub async fn run_cron(user: AuthUser) -> Result<Json<CronTriggerResponse>> {
    require_admin(&user)?;
    Ok(Json(CronTriggerResponse {
        ok: true,
        message: "Cron jobs triggered.".to_owned(),
    }))
}

pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/run-cron", post(run_cron))
}
