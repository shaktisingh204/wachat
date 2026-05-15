//! `/group-categories` — user-defined groupings of WhatsApp groups.
//!
//! Categories live on the SabNode side only — they never round-trip to WA —
//! and they're scoped per-session so two sessions inside the same project can
//! organise their groups independently.
//!
//! Backing collection: `sabwa_group_categories`.
//!
//! Routes:
//! - `GET    /v1/group-categories?sessionId=<sess>` — list categories
//! - `POST   /v1/group-categories`                  — create
//! - `PATCH  /v1/group-categories/:id`              — partial update
//! - `DELETE /v1/group-categories/:id`              — hard delete (204)

use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime, Document};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

const COLLECTION: &str = "sabwa_group_categories";

/// Build the `/group-categories` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_categories).post(create_category))
        .route(
            "/:id",
            axum::routing::patch(update_category).delete(delete_category),
        )
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupCategoryDto {
    pub id: String,
    pub session_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub order: i32,
    pub group_jids: Vec<String>,
    pub group_count: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesResponse {
    pub categories: Vec<GroupCategoryDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryEnvelope {
    pub category: GroupCategoryDto,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryRequest {
    pub session_id: String,
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub group_jids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    // Accepted but optional — PATCH may omit it.
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub group_jids: Option<Vec<String>>,
}

// ---------- Handlers ----------

async fn list_categories(
    State(state): State<AppState>,
    Query(q): Query<ListCategoriesQuery>,
) -> Result<Json<ListCategoriesResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, "group_categories: list");

    let col = state.db.collection::<Document>(COLLECTION);
    let filter = doc! { "sessionId": session_filter(&q.session_id) };
    let cursor = col
        .find(filter)
        .sort(doc! { "order": 1i32, "createdAt": 1i32 })
        .await
        .context("sabwa_group_categories.list")?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .context("collect sabwa_group_categories")?;

    let categories = docs.into_iter().filter_map(doc_to_dto).collect();
    Ok(Json(ListCategoriesResponse { categories }))
}

async fn create_category(
    State(state): State<AppState>,
    Json(body): Json<CreateCategoryRequest>,
) -> Result<Json<CategoryEnvelope>, AppError> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if body.session_id.trim().is_empty() {
        return Err(AppError::BadRequest("sessionId is required".into()));
    }

    tracing::info!(
        session_id = %body.session_id,
        name = %body.name,
        "group_categories: create"
    );

    let col = state.db.collection::<Document>(COLLECTION);
    let now = BsonDateTime::now();
    let id = ObjectId::new();
    let group_jids = body.group_jids.unwrap_or_default();
    let jids_bson: Vec<Bson> = group_jids.iter().map(|s| Bson::String(s.clone())).collect();

    let mut doc = doc! {
        "_id": id,
        "sessionId": session_filter(&body.session_id),
        "name": body.name.trim(),
        "order": body.order.unwrap_or(0),
        "groupJids": jids_bson,
        "createdAt": Bson::DateTime(now),
        "updatedAt": Bson::DateTime(now),
    };
    if let Some(project_id) = body.project_id.as_deref() {
        doc.insert("projectId", project_id_bson(project_id));
    }
    if let Some(color) = body.color.as_deref() {
        doc.insert("color", color);
    }
    if let Some(icon) = body.icon.as_deref() {
        doc.insert("icon", icon);
    }

    col.insert_one(&doc)
        .await
        .context("sabwa_group_categories.insert")?;

    let dto = doc_to_dto(doc).ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("failed to render created category"))
    })?;
    Ok(Json(CategoryEnvelope { category: dto }))
}

async fn update_category(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCategoryRequest>,
) -> Result<Json<CategoryEnvelope>, AppError> {
    tracing::info!(category_id = %id, "group_categories: update");

    let oid = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest(format!("invalid category id: {id}")))?;

    let mut set = Document::new();
    if let Some(name) = body.name.as_deref() {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("name cannot be empty".into()));
        }
        set.insert("name", trimmed);
    }
    if let Some(color) = body.color.as_deref() {
        set.insert("color", color);
    }
    if let Some(icon) = body.icon.as_deref() {
        set.insert("icon", icon);
    }
    if let Some(order) = body.order {
        set.insert("order", order);
    }
    if let Some(jids) = body.group_jids.as_ref() {
        let jids_bson: Vec<Bson> = jids.iter().map(|s| Bson::String(s.clone())).collect();
        set.insert("groupJids", jids_bson);
    }
    set.insert("updatedAt", Bson::DateTime(BsonDateTime::now()));

    let col = state.db.collection::<Document>(COLLECTION);
    col.update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await
        .context("sabwa_group_categories.update")?;

    let updated = col
        .find_one(doc! { "_id": oid })
        .await
        .context("sabwa_group_categories.find after update")?
        .ok_or(AppError::NotFound)?;

    let dto = doc_to_dto(updated)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("failed to decode updated category")))?;
    Ok(Json(CategoryEnvelope { category: dto }))
}

async fn delete_category(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    tracing::info!(category_id = %id, "group_categories: delete");

    let oid = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest(format!("invalid category id: {id}")))?;

    let col = state.db.collection::<Document>(COLLECTION);
    col.delete_one(doc! { "_id": oid })
        .await
        .context("sabwa_group_categories.delete")?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------- helpers ----------

/// Sessions are stored as `ObjectId` in newer rows but the engine has older
/// string-keyed rows in the wild — accept either by falling back to a string.
fn session_filter(session_id: &str) -> Bson {
    match ObjectId::parse_str(session_id) {
        Ok(oid) => Bson::ObjectId(oid),
        Err(_) => Bson::String(session_id.to_string()),
    }
}

fn project_id_bson(project_id: &str) -> Bson {
    match ObjectId::parse_str(project_id) {
        Ok(oid) => Bson::ObjectId(oid),
        Err(_) => Bson::String(project_id.to_string()),
    }
}

fn doc_to_dto(d: Document) -> Option<GroupCategoryDto> {
    let id = match d.get("_id") {
        Some(Bson::ObjectId(o)) => o.to_hex(),
        Some(Bson::String(s)) => s.clone(),
        _ => return None,
    };
    let session_id = match d.get("sessionId") {
        Some(Bson::ObjectId(o)) => o.to_hex(),
        Some(Bson::String(s)) => s.clone(),
        _ => String::new(),
    };
    let name = d.get_str("name").unwrap_or("").to_string();
    let color = d.get_str("color").ok().map(|s| s.to_string());
    let icon = d.get_str("icon").ok().map(|s| s.to_string());
    let order = d
        .get_i32("order")
        .ok()
        .or_else(|| d.get_i64("order").ok().map(|v| v as i32))
        .unwrap_or(0);
    let group_jids: Vec<String> = match d.get("groupJids") {
        Some(Bson::Array(a)) => a
            .iter()
            .filter_map(|b| match b {
                Bson::String(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    };
    let group_count = group_jids.len() as u32;
    let created_at = match d.get("createdAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => chrono::Utc::now(),
    };
    let updated_at = match d.get("updatedAt") {
        Some(Bson::DateTime(dt)) => dt.to_chrono(),
        _ => created_at,
    };

    Some(GroupCategoryDto {
        id,
        session_id,
        name,
        color,
        icon,
        order,
        group_jids,
        group_count,
        created_at,
        updated_at,
    })
}
