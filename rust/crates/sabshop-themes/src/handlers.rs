//! HTTP handlers for SabShop themes.

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
use tracing::instrument;

use crate::dto::*;
use crate::types::SabshopTheme;

const COLL: &str = "sabshop_themes";
const ENTITY_KIND: &str = "sabshop_theme";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn value_to_bson(v: serde_json::Value) -> Bson {
    bson::to_bson(&v).unwrap_or(Bson::Null)
}

fn entity_from_create(input: CreateThemeInput, user_id: ObjectId) -> Result<SabshopTheme> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(SabshopTheme {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        config_json: input
            .config_json
            .map(value_to_bson)
            .unwrap_or(Bson::Document(Document::new())),
        system: false,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateThemeInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.config_json {
        set.insert("configJson", value_to_bson(v));
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopTheme) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopTheme>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_themes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(n) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(n, &["name", "description"]);
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
    let coll = mongo.collection::<SabshopTheme>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.find"))
        })?;
    let mut rows: Vec<SabshopTheme> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, theme_id = %theme_id))]
pub async fn get_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(theme_id): Path<String>,
) -> Result<Json<SabshopTheme>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&theme_id)?;
    let coll = mongo.collection::<SabshopTheme>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("theme".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateThemeInput>,
) -> Result<Json<CreateThemeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<SabshopTheme>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateThemeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, theme_id = %theme_id))]
pub async fn update_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(theme_id): Path<String>,
    Json(patch): Json<UpdateThemeInput>,
) -> Result<Json<SabshopTheme>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&theme_id)?;
    let coll = mongo.collection::<SabshopTheme>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("theme".to_owned()))?;
    let update = build_update_doc(patch);
    let r = coll
        .update_one(ownership(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.update")))?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("theme".to_owned()));
    }
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.refetch")))?
        .ok_or_else(|| ApiError::NotFound("theme".to_owned()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, theme_id = %theme_id))]
pub async fn delete_theme(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(theme_id): Path<String>,
) -> Result<Json<DeleteThemeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&theme_id)?;
    let coll = mongo.collection::<SabshopTheme>(COLL);
    let r = coll
        .delete_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabshop_themes.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("theme".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteThemeResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_empty_name() {
        let u = ObjectId::new();
        assert!(
            entity_from_create(
                CreateThemeInput {
                    name: " ".into(),
                    ..Default::default()
                },
                u
            )
            .is_err()
        );
    }
}
