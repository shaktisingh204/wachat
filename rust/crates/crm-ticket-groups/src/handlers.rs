//! HTTP handlers for the TicketGroup entity.

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

use crate::dto::{
    CreateTicketGroupInput, CreateTicketGroupResponse, DeleteTicketGroupResponse, ListQuery,
    UpdateTicketGroupInput,
};
use crate::types::CrmTicketGroup;

const COLL: &str = "crm_ticket_groups";
const ENTITY_KIND: &str = "ticket_group";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    is_active: Option<bool>,
    parent_group_id: Option<ObjectId>,
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
    if let Some(active) = is_active {
        filter.insert("isActive", active);
    }
    if let Some(parent) = parent_group_id {
        filter.insert("parentGroupId", parent);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Non-archived doc with the same name for this tenant — used for unique-name
/// enforcement on create and rename.
fn duplicate_name_filter(user_id: ObjectId, name: &str, exclude: Option<ObjectId>) -> Document {
    let mut filter = doc! {
        "userId": user_id,
        "name": name,
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    filter
}

fn parse_optional_oid(value: Option<&str>, field: &str) -> Result<Option<ObjectId>> {
    match value.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(s) => ObjectId::parse_str(s)
            .map(Some)
            .map_err(|_| ApiError::Validation(format!("{field} must be a valid ObjectId"))),
    }
}

fn group_from_create(input: CreateTicketGroupInput, user_id: ObjectId) -> Result<CrmTicketGroup> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent_group_id = parse_optional_oid(input.parent_group_id.as_deref(), "parentGroupId")?;
    let default_assignee_id =
        parse_optional_oid(input.default_assignee_id.as_deref(), "defaultAssigneeId")?;
    let default_sla_id = parse_optional_oid(input.default_sla_id.as_deref(), "defaultSlaId")?;

    Ok(CrmTicketGroup {
        id: None,
        user_id,
        name: name.to_owned(),
        description: input.description,
        parent_group_id,
        default_assignee_id,
        default_sla_id,
        color: input.color,
        icon: input.icon,
        is_active: input.is_active.unwrap_or(true),
        tickets_count: 0,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

/// Map a string patch field to either an ObjectId or explicit `null` for
/// clearing. Empty string also clears.
fn oid_or_unset(value: &str, field: &str) -> Result<Bson> {
    let s = value.trim();
    if s.is_empty() {
        return Ok(Bson::Null);
    }
    ObjectId::parse_str(s)
        .map(Bson::ObjectId)
        .map_err(|_| ApiError::Validation(format!("{field} must be a valid ObjectId")))
}

fn build_update_doc(patch: UpdateTicketGroupInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.parent_group_id {
        set.insert("parentGroupId", oid_or_unset(&v, "parentGroupId")?);
    }
    if let Some(v) = patch.default_assignee_id {
        set.insert("defaultAssigneeId", oid_or_unset(&v, "defaultAssigneeId")?);
    }
    if let Some(v) = patch.default_sla_id {
        set.insert("defaultSlaId", oid_or_unset(&v, "defaultSlaId")?);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmTicketGroup) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTicketGroup>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ticket_groups(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let parent = parse_optional_oid(q.parent_group_id.as_deref(), "parentGroupId")?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_active, parent);
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

    let coll = mongo.collection::<CrmTicketGroup>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.find"))
        })?;
    let mut rows: Vec<CrmTicketGroup> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, group_id = %group_id))]
pub async fn get_ticket_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<CrmTicketGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;

    let coll = mongo.collection::<CrmTicketGroup>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_group".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_ticket_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTicketGroupInput>,
) -> Result<Json<CreateTicketGroupResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = group_from_create(input, user_id)?;

    let coll = mongo.collection::<CrmTicketGroup>(COLL);

    // Unique-name guard (scoped to non-archived groups for this tenant).
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "ticket group '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTicketGroupResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, group_id = %group_id))]
pub async fn update_ticket_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Json(patch): Json<UpdateTicketGroupInput>,
) -> Result<Json<CrmTicketGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;

    let coll = mongo.collection::<CrmTicketGroup>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_group".to_owned()))?;

    // Validate name (non-empty + unique among non-archived groups excluding self).
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name != before.name {
            let dup = coll
                .find_one(duplicate_name_filter(user_id, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.dup_check"))
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "ticket group '{new_name}' already exists"
                )));
            }
        }
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_group".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_group".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, group_id = %group_id))]
pub async fn delete_ticket_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<DeleteTicketGroupResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;

    let coll = mongo.collection::<CrmTicketGroup>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_groups.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_group".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTicketGroupResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default_and_scopes_user() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
        assert!(!f.contains_key("parentGroupId"));
    }

    #[test]
    fn list_filter_applies_parent_and_is_active() {
        let user_id = ObjectId::new();
        let parent = ObjectId::new();
        let f = list_filter(user_id, Some("archived"), Some(false), Some(parent));
        assert_eq!(f.get_str("status").unwrap(), "archived");
        assert_eq!(f.get_bool("isActive").unwrap(), false);
        assert_eq!(f.get_object_id("parentGroupId").unwrap(), parent);
    }

    #[test]
    fn group_from_create_trims_name_and_defaults() {
        let user_id = ObjectId::new();
        let input = CreateTicketGroupInput {
            name: "  Billing  ".into(),
            ..Default::default()
        };
        let g = group_from_create(input, user_id).unwrap();
        assert_eq!(g.name, "Billing");
        assert_eq!(g.status, "active");
        assert!(g.is_active);
        assert_eq!(g.tickets_count, 0);
        assert!(g.parent_group_id.is_none());
        assert!(g.default_assignee_id.is_none());
        assert!(g.default_sla_id.is_none());
    }

    #[test]
    fn group_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateTicketGroupInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(group_from_create(input, user_id).is_err());
    }

    #[test]
    fn group_from_create_rejects_invalid_oid_refs() {
        let user_id = ObjectId::new();
        let input = CreateTicketGroupInput {
            name: "Billing".into(),
            parent_group_id: Some("not-an-oid".into()),
            ..Default::default()
        };
        assert!(group_from_create(input, user_id).is_err());
    }

    #[test]
    fn duplicate_name_filter_scopes_and_excludes_archived() {
        let user_id = ObjectId::new();
        let f = duplicate_name_filter(user_id, "Billing", None);
        assert_eq!(f.get_object_id("userId").unwrap(), user_id);
        assert_eq!(f.get_str("name").unwrap(), "Billing");
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
        assert!(!f.contains_key("_id"));
    }

    #[test]
    fn duplicate_name_filter_excludes_self_on_rename() {
        let user_id = ObjectId::new();
        let self_id = ObjectId::new();
        let f = duplicate_name_filter(user_id, "Billing", Some(self_id));
        let id_clause = f.get_document("_id").unwrap();
        assert_eq!(id_clause.get_object_id("$ne").unwrap(), self_id);
    }

    #[test]
    fn oid_or_unset_clears_on_empty() {
        let v = oid_or_unset("   ", "x").unwrap();
        assert!(matches!(v, Bson::Null));
    }

    #[test]
    fn oid_or_unset_parses_valid_hex() {
        let oid = ObjectId::new();
        let v = oid_or_unset(&oid.to_hex(), "x").unwrap();
        match v {
            Bson::ObjectId(o) => assert_eq!(o, oid),
            _ => panic!("expected ObjectId"),
        }
    }

    #[test]
    fn build_update_doc_sets_updated_at_and_fields() {
        let patch = UpdateTicketGroupInput {
            name: Some("Renamed".into()),
            color: Some("#000".into()),
            is_active: Some(false),
            ..Default::default()
        };
        let upd = build_update_doc(patch).unwrap();
        let set = upd.get_document("$set").unwrap();
        assert!(set.contains_key("updatedAt"));
        assert_eq!(set.get_str("name").unwrap(), "Renamed");
        assert_eq!(set.get_str("color").unwrap(), "#000");
        assert_eq!(set.get_bool("isActive").unwrap(), false);
    }
}
