//! HTTP handlers for the TicketType entity.

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
    CreateTicketTypeInput, CreateTicketTypeResponse, DeleteTicketTypeResponse, ListQuery,
    UpdateTicketTypeInput,
};
use crate::types::CrmTicketType;

const COLL: &str = "crm_ticket_types";
const ENTITY_KIND: &str = "ticket_type";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    is_active: Option<bool>,
    is_default: Option<bool>,
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
    if let Some(def) = is_default {
        filter.insert("isDefault", def);
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

fn type_from_create(input: CreateTicketTypeInput, user_id: ObjectId) -> Result<CrmTicketType> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmTicketType {
        id: None,
        user_id,
        name: name.to_owned(),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        color: input
            .color
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        icon: input
            .icon
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        default_priority: input
            .default_priority
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        default_sla_id: input
            .default_sla_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        default_group_id: input
            .default_group_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        required_fields: input.required_fields.unwrap_or_default(),
        is_active: input.is_active.unwrap_or(true),
        is_default: input.is_default.unwrap_or(false),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTicketTypeInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.default_priority {
        set.insert("defaultPriority", v);
    }
    if let Some(v) = patch
        .default_sla_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("defaultSlaId", v);
    }
    if let Some(v) = patch
        .default_group_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("defaultGroupId", v);
    }
    if let Some(v) = patch.required_fields {
        set.insert("requiredFields", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTicketType) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTicketType>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ticket_types(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_active, q.is_default);
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

    let coll = mongo.collection::<CrmTicketType>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.find"))
        })?;
    let mut rows: Vec<CrmTicketType> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %type_id))]
pub async fn get_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
) -> Result<Json<CrmTicketType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&type_id)?;

    let coll = mongo.collection::<CrmTicketType>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_type".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTicketTypeInput>,
) -> Result<Json<CreateTicketTypeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = type_from_create(input, user_id)?;

    let coll = mongo.collection::<CrmTicketType>(COLL);

    // Unique-name guard (scoped to non-archived types for this tenant).
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "ticket type '{}' already exists",
            entity.name
        )));
    }

    // At most one default per tenant — demote peers before inserting a new default.
    if entity.is_default {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.insert"))
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

    Ok(Json(CreateTicketTypeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %type_id))]
pub async fn update_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
    Json(patch): Json<UpdateTicketTypeInput>,
) -> Result<Json<CrmTicketType>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&type_id)?;

    let coll = mongo.collection::<CrmTicketType>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_type".to_owned()))?;

    // Validate name (non-empty + unique among non-archived types excluding self).
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name != before.name {
            let dup = coll
                .find_one(duplicate_name_filter(user_id, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.dup_check"))
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "ticket type '{new_name}' already exists"
                )));
            }
        }
    }

    // Promoting this row to default — demote all other tenant defaults first.
    if matches!(patch.is_default, Some(true)) {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true, "_id": { "$ne": oid } },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_type".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.refetch")))?
        .ok_or_else(|| ApiError::NotFound("ticket_type".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %type_id))]
pub async fn delete_ticket_type(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(type_id): Path<String>,
) -> Result<Json<DeleteTicketTypeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&type_id)?;

    let coll = mongo.collection::<CrmTicketType>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isDefault": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_types.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_type".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTicketTypeResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn type_from_create_trims_and_defaults() {
        let user_id = ObjectId::new();
        let input = CreateTicketTypeInput {
            name: "  Bug  ".into(),
            ..Default::default()
        };
        let t = type_from_create(input, user_id).unwrap();
        // Name is trimmed.
        assert_eq!(t.name, "Bug");
        assert_eq!(t.status, "active");
        assert!(t.is_active);
        assert!(!t.is_default);
        assert!(t.required_fields.is_empty());
    }

    #[test]
    fn type_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateTicketTypeInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(type_from_create(input, user_id).is_err());
    }

    #[test]
    fn duplicate_name_filter_scopes_to_tenant_and_excludes_archived() {
        let user_id = ObjectId::new();
        let f = duplicate_name_filter(user_id, "Bug", None);
        assert_eq!(f.get_object_id("userId").unwrap(), user_id);
        assert_eq!(f.get_str("name").unwrap(), "Bug");
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
        assert!(!f.contains_key("_id"));
    }

    #[test]
    fn duplicate_name_filter_excludes_self_when_renaming() {
        let user_id = ObjectId::new();
        let self_id = ObjectId::new();
        let f = duplicate_name_filter(user_id, "Bug", Some(self_id));
        let id_clause = f.get_document("_id").unwrap();
        assert_eq!(id_clause.get_object_id("$ne").unwrap(), self_id);
    }
}
