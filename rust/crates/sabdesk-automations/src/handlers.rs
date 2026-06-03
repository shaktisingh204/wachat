use crate::dto::{AutomationDto, CreateAutomationDto, UpdateAutomationDto};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

const COLLECTION: &str = "sabdesk_automations";

fn to_dto(doc: &Document) -> Result<AutomationDto> {
    Ok(AutomationDto {
        id: doc
            .get_object_id("_id")
            .unwrap_or_else(|_| ObjectId::new())
            .to_hex(),
        name: doc.get_str("name").unwrap_or("").to_string(),
        trigger: doc.get_str("trigger").unwrap_or("").to_string(),
        action: doc.get_str("action").unwrap_or("").to_string(),
        enabled: doc.get_bool("enabled").unwrap_or(true),
    })
}

pub async fn list(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<Vec<AutomationDto>>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let mut cursor = coll
        .find(doc! { "user_id": &user.user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let mut items = Vec::new();
    while cursor
        .advance()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        if let Ok(doc) = cursor.deserialize_current() {
            if let Ok(dto) = to_dto(&doc) {
                items.push(dto);
            }
        }
    }
    Ok(Json(items))
}

pub async fn create(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(payload): Json<CreateAutomationDto>,
) -> Result<Json<AutomationDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "user_id": &user.user_id,
        "name": payload.name,
        "trigger": payload.trigger,
        "action": payload.action,
        "enabled": payload.enabled.unwrap_or(true),
    };
    coll.insert_one(doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(to_dto(&doc)?))
}

pub async fn get(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<AutomationDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid id".to_string()))?;
    let doc = coll
        .find_one(doc! { "_id": oid, "user_id": &user.user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("automation".to_string()))?;
    Ok(Json(to_dto(&doc)?))
}

pub async fn update(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateAutomationDto>,
) -> Result<Json<AutomationDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid id".to_string()))?;
    let mut update_doc = doc! {};
    if let Some(t) = payload.name {
        update_doc.insert("name", t);
    }
    if let Some(d) = payload.trigger {
        update_doc.insert("trigger", d);
    }
    if let Some(s) = payload.action {
        update_doc.insert("action", s);
    }
    if let Some(e) = payload.enabled {
        update_doc.insert("enabled", e);
    }

    if update_doc.is_empty() {
        return get(user, State(mongo), Path(id)).await;
    }

    coll.update_one(
        doc! { "_id": oid, "user_id": &user.user_id },
        doc! { "$set": update_doc },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    get(user, State(mongo), Path(id)).await
}

pub async fn delete(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid id".to_string()))?;
    coll.delete_one(doc! { "_id": oid, "user_id": &user.user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(serde_json::json!({ "success": true })))
}
