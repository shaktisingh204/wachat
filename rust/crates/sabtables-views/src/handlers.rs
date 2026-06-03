//! HTTP handlers for the View entity.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateViewInput, CreateViewResponse, DeleteViewResponse, ListQuery, UpdateViewInput,
};
use crate::types::{SabtablesView, SabtablesViewKind};

const COLL: &str = "sabtables_views";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn json_map_to_doc(map: &HashMap<String, serde_json::Value>) -> Result<Document> {
    let mut out = Document::new();
    for (k, v) in map.iter() {
        let bson = bson::to_bson(v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.json_to_bson"))
        })?;
        out.insert(k.clone(), bson);
    }
    Ok(out)
}

fn gen_form_token() -> String {
    format!("frm_{}", ObjectId::new().to_hex())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesView>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_views(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(t) = q.table_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("tableId", oid_from_str(t)?);
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    match q.status.as_deref().unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    let opts = FindOptions::builder().sort(doc! { "createdAt": 1 }).build();
    let coll = mongo.collection::<SabtablesView>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.find"))
        })?;
    let items: Vec<SabtablesView> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn get_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
) -> Result<Json<SabtablesView>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<SabtablesView>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.find_one")))?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateViewInput>,
) -> Result<Json<CreateViewResponse>> {
    let user_id = user_oid(&user)?;
    let table_oid = oid_from_str(&input.table_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let form_token = matches!(input.kind, SabtablesViewKind::Form).then(gen_form_token);
    let mut entity = SabtablesView {
        id: None,
        user_id,
        table_id: table_oid,
        name: input.name,
        kind: input.kind,
        config_json: json_map_to_doc(&input.config_json)?,
        form_token,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabtablesView>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateViewResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn update_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
    Json(patch): Json<UpdateViewInput>,
) -> Result<Json<SabtablesView>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<SabtablesView>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(cfg) = patch.config_json {
        set.insert("configJson", json_map_to_doc(&cfg)?);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("view".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.refetch")))?
        .ok_or_else(|| ApiError::NotFound("view".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn delete_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
) -> Result<Json<DeleteViewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<SabtablesView>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("view".to_owned()));
    }
    Ok(Json(DeleteViewResponse { deleted: true }))
}

/// Public lookup by form-token. Used by the `/sabtables/form/[formToken]`
/// public page on the Next.js side. Returns only the form view; the
/// table-schema fetch is done on the server alongside this.
#[instrument(skip_all, fields(token = %form_token))]
pub async fn get_form_view_public(
    State(mongo): State<MongoHandle>,
    Path(form_token): Path<String>,
) -> Result<Json<SabtablesView>> {
    let coll = mongo.collection::<SabtablesView>(COLL);
    let row = coll
        .find_one(doc! { "formToken": &form_token, "status": "active", "kind": "form" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_views.find_one_form"))
        })?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    Ok(Json(row))
}
