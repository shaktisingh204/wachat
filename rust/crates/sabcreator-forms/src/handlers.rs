//! HTTP handlers for the Form entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
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
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateFormInput, CreateFormResponse, DeleteFormResponse, ListQuery, UpdateFormInput,
};
use crate::types::SabcreatorForm;

const COLL: &str = "sabcreator_forms";

fn list_filter(user_id: ObjectId, app_id: Option<ObjectId>, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(a) = app_id {
        filter.insert("appId", a);
    }
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "published" => {
            filter.insert("status", "published");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn json_to_bson(v: &Value, ctx: &'static str) -> Result<bson::Bson> {
    to_bson(v).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorForm>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_forms(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let app_oid = match q.app_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let mut filter = list_filter(user_id, app_oid, q.status.as_deref());
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
    let coll = mongo.collection::<SabcreatorForm>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.find"))
        })?;
    let mut rows: Vec<SabcreatorForm> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn get_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<SabcreatorForm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<SabcreatorForm>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFormInput>,
) -> Result<Json<CreateFormResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let app_oid = oid_from_str(&input.app_id)?;
    let table_oid = match input.sabtables_table_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let workflow_oid = match input.submit_workflow_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorForm {
        id: None,
        user_id,
        app_id: app_oid,
        name: input.name.trim().to_owned(),
        description: input.description,
        sabtables_table_id: table_oid,
        fields_json: input.fields_json.unwrap_or_else(|| Value::Array(Vec::new())),
        layout_json: input.layout_json,
        submit_action: input.submit_action.unwrap_or_else(|| "createRecord".to_owned()),
        submit_workflow_id: workflow_oid,
        status: "draft".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabcreatorForm>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateFormResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn update_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Json(patch): Json<UpdateFormInput>,
) -> Result<Json<SabcreatorForm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<SabcreatorForm>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.sabtables_table_id.filter(|s| !s.is_empty()) {
        set.insert("sabtablesTableId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.fields_json {
        set.insert("fieldsJson", json_to_bson(&v, "fieldsJson")?);
    }
    if let Some(v) = patch.layout_json {
        set.insert("layoutJson", json_to_bson(&v, "layoutJson")?);
    }
    if let Some(v) = patch.submit_action {
        set.insert("submitAction", v);
    }
    if let Some(v) = patch.submit_workflow_id.filter(|s| !s.is_empty()) {
        set.insert("submitWorkflowId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn delete_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<DeleteFormResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<SabcreatorForm>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_forms.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    Ok(Json(DeleteFormResponse { deleted: true }))
}
