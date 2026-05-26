//! HTTP handlers for BugHistoryEntry.

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
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{CreateHistoryInput, CreateHistoryResponse, ListQuery};
use crate::types::BugHistoryEntry;

const COLL: &str = "sabbugs_history";

fn entry_from_create(
    input: CreateHistoryInput,
    user_id: ObjectId,
    actor_id: ObjectId,
) -> Result<BugHistoryEntry> {
    let field = input.field.trim().to_owned();
    if field.is_empty() {
        return Err(ApiError::Validation("field is required".to_owned()));
    }
    let bug_id = ObjectId::parse_str(input.bug_id.trim())
        .map_err(|_| ApiError::Validation("invalid bugId".to_owned()))?;
    Ok(BugHistoryEntry {
        id: None,
        user_id,
        bug_id,
        ts: BsonDateTime::from_chrono(Utc::now()),
        actor_id,
        field,
        old_value: input.old_value,
        new_value: input.new_value,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BugHistoryEntry>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_history(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let bug_id = ObjectId::parse_str(q.bug_id.trim())
        .map_err(|_| ApiError::Validation("invalid bugId".to_owned()))?;
    let mut filter: Document = doc! { "userId": user_id, "bugId": bug_id };
    if let Some(f) = q.field.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("field", f);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BugHistoryEntry>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_history.find"))
    })?;
    let mut rows: Vec<BugHistoryEntry> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_history.collect"))
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
pub async fn create_history(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateHistoryInput>,
) -> Result<Json<CreateHistoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entry_from_create(input, user_id, user_id)?;
    let coll = mongo.collection::<BugHistoryEntry>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_history.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateHistoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_from_create_requires_field() {
        let user_id = ObjectId::new();
        let bug_id = ObjectId::new();
        assert!(
            entry_from_create(
                CreateHistoryInput {
                    bug_id: bug_id.to_hex(),
                    field: " ".into(),
                    ..Default::default()
                },
                user_id,
                user_id,
            )
            .is_err()
        );
    }

    #[test]
    fn entry_from_create_rejects_bad_bug_id() {
        let user_id = ObjectId::new();
        assert!(
            entry_from_create(
                CreateHistoryInput {
                    bug_id: "not-an-oid".into(),
                    field: "status".into(),
                    ..Default::default()
                },
                user_id,
                user_id,
            )
            .is_err()
        );
    }
}
