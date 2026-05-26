//! Read-only handler for the stage action timeline.
//!
//! Writes happen *exclusively* via `requests-instances::decide_request`.
//! This crate intentionally exposes only `GET /` so the audit log
//! can't drift from the instance state.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{DEFAULT_LIMIT, ListQuery, MAX_LIMIT, StageAction};

const COLL: &str = "requests_stage_actions";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// `GET /v1/sabrequests/stage-actions?requestId=…` — paginated audit
/// timeline, ascending by `ts` (oldest first — the UI renders the
/// timeline top-down).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_actions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<StageAction>>> {
    let user_id = user_oid(&user)?;
    let req_id = q
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::Validation("requestId is required.".to_owned()))?;
    let req_oid = oid_from_str(req_id)?;

    let mut filter: Document = doc! { "userId": user_id, "requestId": req_oid };
    if let Some(actor) = q.actor_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("actorId", oid_from_str(actor)?);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;
    let opts = FindOptions::builder()
        .sort(doc! { "ts": 1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<StageAction>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("stage_actions.find")))?;
    let docs: Vec<StageAction> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("stage_actions.collect")))?;
    Ok(Json(docs))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clamp_limit_default() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }
}
