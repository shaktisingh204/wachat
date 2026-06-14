//! HTTP handlers for the Voice IVR entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::{Value as JsonValue, json};
use tracing::instrument;

use crate::dto::{CreateIvrInput, CreateIvrResponse, DeleteIvrResponse, ListQuery, UpdateIvrInput};
use crate::types::VoiceIvr;

const COLL: &str = "sabcall_ivrs";
const ENTITY_KIND: &str = "voice_ivr";
const VALID_STATUS: &[&str] = &["draft", "active", "archived"];
const VALID_NODE_TYPES: &[&str] = &[
    "menu",
    "playback",
    "forward",
    "voicemail",
    "hangup",
    "conditional",
];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUS:?}"
        )))
    }
}

/// Walk the JSON tree and reject any unknown node `type`.
fn validate_node_tree(node: &JsonValue) -> Result<()> {
    let obj = node
        .as_object()
        .ok_or_else(|| ApiError::Validation("ivr node must be an object".to_owned()))?;
    let ty = obj
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::Validation("ivr node missing 'type'".to_owned()))?;
    if !VALID_NODE_TYPES.contains(&ty) {
        return Err(ApiError::Validation(format!(
            "unknown ivr node type {ty:?}"
        )));
    }
    if let Some(children) = obj.get("children").and_then(|v| v.as_array()) {
        for c in children {
            validate_node_tree(c)?;
        }
    }
    Ok(())
}

fn json_to_bson(v: JsonValue) -> Result<Bson> {
    bson::to_bson(&v)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("ivr json->bson")))
}

fn default_root_node() -> JsonValue {
    json!({
        "type": "menu",
        "prompt": "Press 1 for sales, 2 for support.",
        "children": [],
    })
}

fn ivr_from_create(input: CreateIvrInput, user_id: ObjectId) -> Result<VoiceIvr> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "draft".to_owned());
    validate_status(&status)?;
    let root = input.root_node.unwrap_or_else(default_root_node);
    validate_node_tree(&root)?;
    Ok(VoiceIvr {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status,
        root_node: json_to_bson(root)?,
        greeting_file_id: input.greeting_file_id,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateIvrInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", t);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.root_node {
        validate_node_tree(&v)?;
        set.insert("rootNode", json_to_bson(v)?);
    }
    if let Some(v) = patch.greeting_file_id {
        set.insert("greetingFileId", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceIvr) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceIvr>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ivrs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<VoiceIvr>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.find")))?;
    let mut rows: Vec<VoiceIvr> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %ivr_id))]
pub async fn get_ivr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ivr_id): Path<String>,
) -> Result<Json<VoiceIvr>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&ivr_id)?;
    let coll = mongo.collection::<VoiceIvr>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_ivr".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_ivr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateIvrInput>,
) -> Result<Json<CreateIvrResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = ivr_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceIvr>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateIvrResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %ivr_id))]
pub async fn update_ivr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ivr_id): Path<String>,
    Json(patch): Json<UpdateIvrInput>,
) -> Result<Json<VoiceIvr>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&ivr_id)?;
    let coll = mongo.collection::<VoiceIvr>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_ivr".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_ivr".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voice_ivr".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %ivr_id))]
pub async fn delete_ivr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ivr_id): Path<String>,
) -> Result<Json<DeleteIvrResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&ivr_id)?;
    let coll = mongo.collection::<VoiceIvr>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_ivrs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_ivr".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteIvrResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ivr_from_create_defaults_to_draft_with_menu_root() {
        let user_id = ObjectId::new();
        let input = CreateIvrInput {
            name: "Main".into(),
            ..Default::default()
        };
        let ivr = ivr_from_create(input, user_id).unwrap();
        assert_eq!(ivr.status, "draft");
        assert_eq!(ivr.name, "Main");
    }

    #[test]
    fn rejects_unknown_node_type() {
        let bad = json!({ "type": "wormhole", "children": [] });
        assert!(validate_node_tree(&bad).is_err());
    }

    #[test]
    fn accepts_nested_known_nodes() {
        let good = json!({
            "type": "menu",
            "children": [
                { "type": "playback", "children": [] },
                { "type": "forward", "to": "agent", "children": [] },
            ],
        });
        assert!(validate_node_tree(&good).is_ok());
    }
}
