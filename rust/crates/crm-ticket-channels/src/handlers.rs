//! HTTP handlers for the Ticket Channel entity.

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
    CreateChannelInput, CreateChannelResponse, DeleteChannelResponse, ListQuery, UpdateChannelInput,
};
use crate::types::CrmTicketChannel;

const COLL: &str = "crm_ticket_channels";
const ENTITY_KIND: &str = "ticket_channel";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    channel_type: Option<&str>,
    is_active: Option<bool>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = channel_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("channelType", t);
    }
    if let Some(active) = is_active {
        filter.insert("isActive", active);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn channel_from_create(input: CreateChannelInput, user_id: ObjectId) -> Result<CrmTicketChannel> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.channel_type.trim().is_empty() {
        return Err(ApiError::Validation("channelType is required".to_owned()));
    }
    Ok(CrmTicketChannel {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        channel_type: input.channel_type.trim().to_owned(),
        inbox_email: input.inbox_email,
        webhook_url: input.webhook_url,
        assigned_agent_group: input
            .assigned_agent_group
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        default_priority: input.default_priority,
        default_sla_id: input
            .default_sla_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        auto_assign: input.auto_assign.unwrap_or(false),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        settings: input.settings,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateChannelInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.channel_type {
        set.insert("channelType", v);
    }
    if let Some(v) = patch.inbox_email {
        set.insert("inboxEmail", v);
    }
    if let Some(v) = patch.webhook_url {
        set.insert("webhookUrl", v);
    }
    if let Some(v) = patch
        .assigned_agent_group
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assignedAgentGroup", v);
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
    if let Some(v) = patch.auto_assign {
        set.insert("autoAssign", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.settings {
        set.insert("settings", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTicketChannel) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTicketChannel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_channels(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.channel_type.as_deref(),
        q.is_active,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "inboxEmail", "webhookUrl"]);
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
    let coll = mongo.collection::<CrmTicketChannel>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.find"))
    })?;
    let mut rows: Vec<CrmTicketChannel> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %channel_id))]
pub async fn get_channel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(channel_id): Path<String>,
) -> Result<Json<CrmTicketChannel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&channel_id)?;
    let coll = mongo.collection::<CrmTicketChannel>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_channel".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_channel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateChannelInput>,
) -> Result<Json<CreateChannelResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = channel_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTicketChannel>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.insert"))
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
    Ok(Json(CreateChannelResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %channel_id))]
pub async fn update_channel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(channel_id): Path<String>,
    Json(patch): Json<UpdateChannelInput>,
) -> Result<Json<CrmTicketChannel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&channel_id)?;
    let coll = mongo.collection::<CrmTicketChannel>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_channel".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_channel".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket_channel".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %channel_id))]
pub async fn delete_channel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(channel_id): Path<String>,
) -> Result<Json<DeleteChannelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&channel_id)?;
    let coll = mongo.collection::<CrmTicketChannel>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_ticket_channels.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("ticket_channel".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteChannelResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn channel_from_create_defaults_status_and_flags() {
        let user_id = ObjectId::new();
        let input = CreateChannelInput {
            name: "Support Inbox".into(),
            channel_type: "email".into(),
            ..Default::default()
        };
        let c = channel_from_create(input, user_id).unwrap();
        assert_eq!(c.status, "active");
        assert_eq!(c.channel_type, "email");
        assert!(!c.auto_assign);
        assert!(c.is_active);
    }

    #[test]
    fn channel_from_create_rejects_empty_name_or_type() {
        let user_id = ObjectId::new();
        let empty_name = CreateChannelInput {
            name: "   ".into(),
            channel_type: "email".into(),
            ..Default::default()
        };
        assert!(channel_from_create(empty_name, user_id).is_err());

        let empty_type = CreateChannelInput {
            name: "Inbox".into(),
            channel_type: "".into(),
            ..Default::default()
        };
        assert!(channel_from_create(empty_type, user_id).is_err());
    }
}
