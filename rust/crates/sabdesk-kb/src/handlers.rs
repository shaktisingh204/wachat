use crate::dto::{CreateKbArticleDto, KbArticleDto, UpdateKbArticleDto};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

const COLLECTION: &str = "sabdesk_kb_articles";

fn to_dto(doc: &Document) -> Result<KbArticleDto> {
    Ok(KbArticleDto {
        id: doc
            .get_object_id("_id")
            .unwrap_or_else(|_| ObjectId::new())
            .to_hex(),
        title: doc.get_str("title").unwrap_or("").to_string(),
        content: doc.get_str("content").unwrap_or("").to_string(),
        published: doc.get_bool("published").unwrap_or(false),
    })
}

pub async fn list(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<Vec<KbArticleDto>>> {
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
    Json(payload): Json<CreateKbArticleDto>,
) -> Result<Json<KbArticleDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "user_id": &user.user_id,
        "title": payload.title,
        "content": payload.content,
        "published": payload.published.unwrap_or(false),
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
) -> Result<Json<KbArticleDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid id".to_string()))?;
    let doc = coll
        .find_one(doc! { "_id": oid, "user_id": &user.user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("kb_article".to_string()))?;
    Ok(Json(to_dto(&doc)?))
}

pub async fn update(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateKbArticleDto>,
) -> Result<Json<KbArticleDto>> {
    let coll = mongo.collection::<Document>(COLLECTION);
    let oid =
        ObjectId::parse_str(&id).map_err(|_| ApiError::BadRequest("invalid id".to_string()))?;
    let mut update_doc = doc! {};
    if let Some(t) = payload.title {
        update_doc.insert("title", t);
    }
    if let Some(c) = payload.content {
        update_doc.insert("content", c);
    }
    if let Some(p) = payload.published {
        update_doc.insert("published", p);
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
