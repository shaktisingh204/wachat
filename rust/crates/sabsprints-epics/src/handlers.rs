//! HTTP handlers for the Epic entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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

use crate::dto::{
    CreateEpicInput, CreateEpicResponse, DeleteEpicResponse, ListQuery, UpdateEpicInput,
};
use crate::types::SabsprintsEpic;

const COLL: &str = "sabsprints_epics";
const ENTITY_KIND: &str = "sabsprints_epic";

fn list_filter(user_id: ObjectId, status: Option<&str>, project_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "planned" | "in_progress" | "completed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn epic_from_create(input: CreateEpicInput, user_id: ObjectId) -> Result<SabsprintsEpic> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let project_id = ObjectId::parse_str(input.project_id.trim())
        .map_err(|_| ApiError::Validation("projectId must be a valid ObjectId".to_owned()))?;
    Ok(SabsprintsEpic {
        id: None,
        user_id,
        project_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        color: input.color,
        start_date: input.start_date.as_deref().and_then(parse_date),
        end_date: input.end_date.as_deref().and_then(parse_date),
        status: input.status.unwrap_or_else(|| "planned".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEpicInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_date) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.end_date.as_deref().and_then(parse_date) {
        set.insert("endDate", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabsprintsEpic) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsprintsEpic>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_epics(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.project_id.as_deref());
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
    let coll = mongo.collection::<SabsprintsEpic>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.find"))
    })?;
    let mut rows: Vec<SabsprintsEpic> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %epic_id))]
pub async fn get_epic(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(epic_id): Path<String>,
) -> Result<Json<SabsprintsEpic>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&epic_id)?;
    let coll = mongo.collection::<SabsprintsEpic>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.find_one")))?
        .ok_or_else(|| ApiError::NotFound("epic".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_epic(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEpicInput>,
) -> Result<Json<CreateEpicResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = epic_from_create(input, user_id)?;
    let coll = mongo.collection::<SabsprintsEpic>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateEpicResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %epic_id))]
pub async fn update_epic(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(epic_id): Path<String>,
    Json(patch): Json<UpdateEpicInput>,
) -> Result<Json<SabsprintsEpic>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&epic_id)?;
    let coll = mongo.collection::<SabsprintsEpic>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.find_one")))?
        .ok_or_else(|| ApiError::NotFound("epic".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("epic".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.refetch")))?
        .ok_or_else(|| ApiError::NotFound("epic".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %epic_id))]
pub async fn delete_epic(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(epic_id): Path<String>,
) -> Result<Json<DeleteEpicResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&epic_id)?;
    let coll = mongo.collection::<SabsprintsEpic>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_epics.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("epic".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteEpicResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epic_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateEpicInput {
            project_id: ObjectId::new().to_hex(),
            name: "".into(),
            ..Default::default()
        };
        assert!(epic_from_create(input, user_id).is_err());
    }

    #[test]
    fn epic_from_create_defaults_status_planned() {
        let user_id = ObjectId::new();
        let input = CreateEpicInput {
            project_id: ObjectId::new().to_hex(),
            name: "Launch".into(),
            ..Default::default()
        };
        let e = epic_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "planned");
    }
}
