use axum::{
    Json,
    extract::{Path, Query, State},
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
use serde_json::Value;
use tracing::instrument;

use crate::dto::{AckCommandResponse, IssueCommandInput, IssueCommandResponse, ListQuery};
use crate::types::SabopsMdmCommand;

const COLL: &str = "sabops_mdm_commands";

const VALID_KINDS: &[&str] = &[
    "lock",
    "wipe",
    "locate",
    "install_app",
    "reboot",
    "sync_settings",
];
const VALID_STATUS: &[&str] = &["queued", "sent", "acknowledged", "failed"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsMdmCommand>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_commands(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(e) = q
        .endpoint_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("endpointId", e);
    }
    if let Some(s) = q.status.as_deref() {
        if VALID_STATUS.contains(&s) {
            filter.insert("status", s);
        }
    }
    if let Some(k) = q.kind.as_deref() {
        if VALID_KINDS.contains(&k) {
            filter.insert("kind", k);
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "issuedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsMdmCommand>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_commands.find"))
    })?;
    let mut rows: Vec<SabopsMdmCommand> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_commands.collect"))
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
pub async fn issue_command(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IssueCommandInput>,
) -> Result<Json<IssueCommandResponse>> {
    let user_id = user_oid(&user)?;
    let endpoint_oid = oid_from_str(&input.endpoint_id)?;
    if !VALID_KINDS.contains(&input.kind.as_str()) {
        return Err(ApiError::Validation(format!(
            "kind must be one of {:?}",
            VALID_KINDS
        )));
    }
    let mut entity = SabopsMdmCommand {
        id: None,
        user_id,
        endpoint_id: endpoint_oid,
        kind: input.kind,
        status: "queued".to_owned(),
        payload_json: input.payload_json.unwrap_or(Value::Null),
        issued_by: user.user_id.to_string(),
        issued_at: BsonDateTime::from_chrono(Utc::now()),
        acked_at: None,
    };
    let coll = mongo.collection::<SabopsMdmCommand>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_commands.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(IssueCommandResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, command_id = %command_id))]
pub async fn acknowledge_command(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(command_id): Path<String>,
) -> Result<Json<AckCommandResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&command_id)?;
    let coll = mongo.collection::<SabopsMdmCommand>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$set": {
                    "status": "acknowledged",
                    "ackedAt": BsonDateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_mdm_commands.ack"))
        })?;
    Ok(Json(AckCommandResponse {
        acknowledged: result.matched_count > 0,
    }))
}
