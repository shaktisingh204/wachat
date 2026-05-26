//! HTTP handlers for SabConnect groups.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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

use crate::dto::{
    CreateGroupInput, CreateGroupResponse, DeleteGroupResponse, ListQuery, MembershipInput,
    UpdateGroupInput,
};
use crate::types::SabConnectGroup;

const COLL: &str = "sabconnect_groups";
const ENTITY_KIND: &str = "sabconnect_group";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_oid_vec(ids: &[String]) -> Vec<ObjectId> {
    ids.iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

fn list_filter(
    user_id: ObjectId,
    visibility: Option<&str>,
    status: Option<&str>,
    member_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(v) = visibility.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("visibility", v);
    }
    if let Some(m) = member_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("memberIds", m);
    }
    filter
}

fn group_from_create(input: CreateGroupInput, user_id: ObjectId) -> Result<SabConnectGroup> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let visibility = input.visibility.unwrap_or_else(|| "open".to_owned());
    if !matches!(visibility.as_str(), "open" | "closed" | "secret") {
        return Err(ApiError::Validation(
            "visibility must be open|closed|secret".to_owned(),
        ));
    }
    let member_ids: Vec<ObjectId> = input
        .member_ids
        .as_deref()
        .map(parse_oid_vec)
        .unwrap_or_default();
    let member_count = member_ids.len() as i64;
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabConnectGroup {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        visibility,
        cover_file_id: input.cover_file_id,
        member_ids,
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        admin_ids: input
            .admin_ids
            .as_deref()
            .map(parse_oid_vec)
            .unwrap_or_default(),
        member_count,
        status: "active".to_owned(),
        tags: input.tags.unwrap_or_default(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateGroupInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.visibility {
        set.insert("visibility", v);
    }
    if let Some(v) = patch.cover_file_id {
        set.insert("coverFileId", v);
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.admin_ids.as_deref().map(parse_oid_vec) {
        set.insert("adminIds", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabConnectGroup) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabConnectGroup>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_groups(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.visibility.as_deref(),
        q.status.as_deref(),
        q.member_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "tags"]);
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
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.find")))?;
    let mut rows: Vec<SabConnectGroup> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn get_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<SabConnectGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("group".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGroupInput>,
) -> Result<Json<CreateGroupResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = group_from_create(input, user_id)?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.insert"))
        })?;
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
    Ok(Json(CreateGroupResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn update_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Json(patch): Json<UpdateGroupInput>,
) -> Result<Json<SabConnectGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("group".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("group".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("group".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn delete_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<DeleteGroupResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("group".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteGroupResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn join_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Json(input): Json<MembershipInput>,
) -> Result<Json<SabConnectGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let member = ObjectId::parse_str(&input.member_id)
        .map_err(|_| ApiError::Validation("memberId must be ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! {
            "$addToSet": { "memberIds": member },
            "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) },
        },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.join")))?;
    // Recompute count
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "memberCount": 0 } },
    )
    .await
    .ok();
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("group".to_owned()))?;
    // Patch memberCount once we know length
    let count = after.member_ids.len() as i64;
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "memberCount": count } },
    )
    .await
    .ok();
    let mut refreshed = after;
    refreshed.member_count = count;
    Ok(Json(refreshed))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn leave_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Json(input): Json<MembershipInput>,
) -> Result<Json<SabConnectGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let member = ObjectId::parse_str(&input.member_id)
        .map_err(|_| ApiError::Validation("memberId must be ObjectId".to_owned()))?;
    let coll = mongo.collection::<SabConnectGroup>(COLL);
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! {
            "$pull": { "memberIds": member },
            "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) },
        },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.leave")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_groups.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("group".to_owned()))?;
    let count = after.member_ids.len() as i64;
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "memberCount": count } },
    )
    .await
    .ok();
    let mut refreshed = after;
    refreshed.member_count = count;
    Ok(Json(refreshed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_visibility() {
        let user_id = ObjectId::new();
        let input = CreateGroupInput {
            name: "Eng".into(),
            visibility: Some("private".into()),
            ..Default::default()
        };
        assert!(group_from_create(input, user_id).is_err());
    }

    #[test]
    fn defaults_visibility_to_open() {
        let user_id = ObjectId::new();
        let input = CreateGroupInput {
            name: "Eng".into(),
            ..Default::default()
        };
        let g = group_from_create(input, user_id).unwrap();
        assert_eq!(g.visibility, "open");
        assert_eq!(g.status, "active");
        assert_eq!(g.member_count, 0);
    }
}
