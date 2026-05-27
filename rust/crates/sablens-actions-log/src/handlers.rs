//! HTTP handlers for SabLens action log entries.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{AppendActionInput, AppendActionResponse, ListQuery};
use crate::types::SablensActionLog;

const COLL: &str = "sablens_actions_log";

fn is_valid_action(a: &str) -> bool {
    matches!(
        a,
        "join" | "leave" | "annotate" | "snapshot" | "chat" | "elevate" | "file_transfer"
    )
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SablensActionLog>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_actions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(s) = q.session_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(s)?;
        filter.insert("sessionId", oid);
    }
    if let Some(a) = q.action.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("action", a);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SablensActionLog>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_actions_log.find"))
        })?;
    let mut rows: Vec<SablensActionLog> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_actions_log.collect"))
        })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn append_action(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<AppendActionInput>,
) -> Result<Json<AppendActionResponse>> {
    let user_id = user_oid(&user)?;
    if !is_valid_action(&input.action) {
        return Err(ApiError::Validation(format!(
            "invalid action \"{}\"",
            input.action
        )));
    }
    let session_oid = oid_from_str(&input.session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let actor_kind = input.actor_kind.unwrap_or_else(|| "user".to_owned());
    let actor_user_id: Option<ObjectId> = if actor_kind == "guest" {
        None
    } else {
        Some(user_id)
    };
    let mut entity = SablensActionLog {
        id: None,
        user_id,
        session_id: session_oid,
        ts: now,
        actor_user_id,
        actor_kind,
        action: input.action,
        payload_json: input.payload_json,
    };
    let coll = mongo.collection::<SablensActionLog>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_actions_log.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(AppendActionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_actions() {
        for a in [
            "join",
            "leave",
            "annotate",
            "snapshot",
            "chat",
            "elevate",
            "file_transfer",
        ] {
            assert!(is_valid_action(a));
        }
        assert!(!is_valid_action("torch_on"));
    }
}
