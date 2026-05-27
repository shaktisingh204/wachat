//! HTTP handlers for `/v1/sabshow/themes/*`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    CreateThemeInput, ListThemesQuery, ThemeEnvelope, ThemeListResponse, UpdateThemeInput,
};
use crate::types::SabshowTheme;

const THEMES_COLL: &str = "sabshow_themes";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

#[instrument(skip(mongo, auth))]
pub async fn list_themes(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListThemesQuery>,
) -> Result<Json<ThemeListResponse>> {
    let me = user_oid(&auth)?;
    let include_built_in = q.include_built_in.unwrap_or(true);
    let filter = if include_built_in {
        doc! { "$or": [{ "userId": me }, { "builtIn": true }] }
    } else {
        doc! { "userId": me }
    };
    let coll = mongo.db().collection::<SabshowTheme>(THEMES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "builtIn": -1, "name": 1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowTheme> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(ThemeListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_theme(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateThemeInput>,
) -> Result<Json<ThemeEnvelope>> {
    let me = user_oid(&auth)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let theme = SabshowTheme {
        id: None,
        user_id: Some(me),
        name: input.name,
        config_json: input.config_json.unwrap_or(serde_json::Value::Null),
        preview_file_id: input.preview_file_id,
        built_in: false,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.db().collection::<SabshowTheme>(THEMES_COLL);
    let res = coll
        .insert_one(&theme)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = theme;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(ThemeEnvelope { theme: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn get_theme(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(theme_id): Path<String>,
) -> Result<Json<ThemeEnvelope>> {
    let me = user_oid(&auth)?;
    let tid = oid(&theme_id, "themeId")?;
    let coll = mongo.db().collection::<SabshowTheme>(THEMES_COLL);
    let theme = coll
        .find_one(doc! {
            "_id": tid,
            "$or": [{ "userId": me }, { "builtIn": true }],
        })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("theme not found".into()))?;
    Ok(Json(ThemeEnvelope { theme }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_theme(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(theme_id): Path<String>,
    Json(patch): Json<UpdateThemeInput>,
) -> Result<Json<ThemeEnvelope>> {
    let me = user_oid(&auth)?;
    let tid = oid(&theme_id, "themeId")?;
    let coll = mongo.db().collection::<SabshowTheme>(THEMES_COLL);
    // Only the owner can mutate. Built-ins are read-only.
    let filter = doc! { "_id": tid, "userId": me };
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.config_json {
        set.insert(
            "configJson",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    if let Some(v) = patch.preview_file_id {
        set.insert("previewFileId", v);
    }
    coll.update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let theme = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("theme not found".into()))?;
    Ok(Json(ThemeEnvelope { theme }))
}

#[instrument(skip(mongo, auth))]
pub async fn delete_theme(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(theme_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let tid = oid(&theme_id, "themeId")?;
    let coll = mongo.db().collection::<SabshowTheme>(THEMES_COLL);
    let res = coll
        .delete_one(doc! { "_id": tid, "userId": me, "builtIn": { "$ne": true } })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "deleted": res.deleted_count > 0 })))
}
