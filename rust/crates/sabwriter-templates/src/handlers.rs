//! HTTP handlers for sabwriter-templates.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateTemplateInput, CreateTemplateResponse, DeleteTemplateResponse, ListQuery, ListResponse,
    UpdateTemplateInput,
};
use crate::types::SabwriterTemplate;

const COLL: &str = "sabwriter_templates";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, scope: Option<&str>, category: Option<&str>) -> Document {
    let mut filter = match scope.unwrap_or("all") {
        "mine" => doc! { "userId": user_id, "status": "active" },
        "public" => doc! { "public": true, "status": "active" },
        _ => doc! {
            "status": "active",
            "$or": [
                { "userId": user_id },
                { "public": true },
            ]
        },
    };
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    filter
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_templates(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.scope.as_deref(), q.category.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "category"]);
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

    let coll = mongo.collection::<SabwriterTemplate>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.find"))
    })?;
    let mut rows: Vec<SabwriterTemplate> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn get_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<SabwriterTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<SabwriterTemplate>(COLL);
    let row = coll
        .find_one(doc! {
            "_id": oid,
            "$or": [
                { "userId": user_id },
                { "public": true },
            ]
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_template".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTemplateInput>,
) -> Result<Json<CreateTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut entity = SabwriterTemplate {
        id: None,
        user_id,
        name,
        description: input.description,
        category: input.category,
        content_json: input.content_json,
        public: input.public.unwrap_or(false),
        status: "active".into(),
        created_at: now_bson(),
        updated_at: None,
    };
    let coll = mongo.collection::<SabwriterTemplate>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTemplateResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn update_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
    Json(patch): Json<UpdateTemplateInput>,
) -> Result<Json<SabwriterTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<SabwriterTemplate>(COLL);

    let mut set = doc! { "updatedAt": now_bson() };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.content_json {
        set.insert("contentJson", bson::to_bson(&v).unwrap_or(bson::Bson::Null));
    }
    if let Some(v) = patch.public {
        set.insert("public", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let res = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.update"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabwriter_template".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_template".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn delete_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<DeleteTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<SabwriterTemplate>(COLL);
    let res = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "status": "archived", "updatedAt": now_bson() }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_templates.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabwriter_template".to_owned()));
    }
    Ok(Json(DeleteTemplateResponse { deleted: true }))
}
