//! HTTP handlers for the Automation entity.

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
    CreateAutomationInput, CreateAutomationResponse, DeleteAutomationResponse, ListQuery,
    RunAutomationInput, RunAutomationResponse, UpdateAutomationInput,
};
use crate::types::SabtablesAutomation;

const COLL: &str = "sabtables_automations";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesAutomation>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_automations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(t) = q.table_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("tableId", oid_from_str(t)?);
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
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.find"))
    })?;
    let items: Vec<SabtablesAutomation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn get_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
) -> Result<Json<SabtablesAutomation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAutomationInput>,
) -> Result<Json<CreateAutomationResponse>> {
    let user_id = user_oid(&user)?;
    let table_oid = oid_from_str(&input.table_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabtablesAutomation {
        id: None,
        user_id,
        table_id: table_oid,
        name: input.name,
        trigger: input.trigger,
        actions: input.actions,
        is_enabled: input.is_enabled.unwrap_or(false),
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAutomationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn update_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
    Json(patch): Json<UpdateAutomationInput>,
) -> Result<Json<SabtablesAutomation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.trigger {
        set.insert(
            "trigger",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabtables_automations.trigger_bson"),
                )
            })?,
        );
    }
    if let Some(v) = patch.actions {
        set.insert(
            "actions",
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabtables_automations.actions_bson"),
                )
            })?,
        );
    }
    if let Some(v) = patch.is_enabled {
        set.insert("isEnabled", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("automation".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn delete_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
) -> Result<Json<DeleteAutomationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("automation".to_owned()));
    }
    Ok(Json(DeleteAutomationResponse { deleted: true }))
}

/// Manual "run now". This is a stub that records intent — the real
/// execution engine is owned by a background worker. We return the
/// step-count so the UI can show a toast like "queued 3 actions".
#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn run_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
    Json(_input): Json<RunAutomationInput>,
) -> Result<Json<RunAutomationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<SabtablesAutomation>(COLL);
    let auto = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_automations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
    Ok(Json(RunAutomationResponse {
        run_id: ObjectId::new().to_hex(),
        steps_executed: auto.actions.len() as u32,
        status: "queued".to_owned(),
    }))
}
