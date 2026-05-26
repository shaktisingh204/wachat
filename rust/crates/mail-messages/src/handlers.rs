//! HTTP handlers for mail messages.

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
    CreateMessageInput, CreateMessageResponse, DeleteMessageResponse, ListQuery,
    UpdateMessageInput,
};
use crate::types::MailMessage;

const COLL: &str = "mail_messages";
const ENTITY_KIND: &str = "mail_message";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<MailMessage>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_messages(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(aid) = q
        .account_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?
    {
        filter.insert("accountId", aid);
    }
    if let Some(fid) = q
        .folder_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?
    {
        filter.insert("folderId", fid);
    }
    if q.unread_only.unwrap_or(false) {
        filter.insert("unread", true);
    }
    if q.starred_only.unwrap_or(false) {
        filter.insert("starred", true);
    }
    if let Some(label) = q.label.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("labels", label);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["subject", "snippet", "fromAddr.email"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "receivedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<MailMessage>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.find")))?;
    let mut rows: Vec<MailMessage> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, message_id = %message_id))]
pub async fn get_message(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(message_id): Path<String>,
) -> Result<Json<MailMessage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&message_id)?;
    let coll = mongo.collection::<MailMessage>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.find_one")))?
        .ok_or_else(|| ApiError::NotFound("mail_message".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_message(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateMessageInput>,
) -> Result<Json<CreateMessageResponse>> {
    let user_id = user_oid(&user)?;
    let account_oid = oid_from_str(&input.account_id)?;
    let folder_oid = oid_from_str(&input.folder_id)?;

    let mut entity = MailMessage {
        id: None,
        user_id,
        account_id: account_oid,
        folder_id: folder_oid,
        uid: None,
        message_id: None,
        subject: input.subject,
        from_addr: input.from_addr,
        to_addrs: input.to_addrs,
        cc: input.cc,
        bcc: input.bcc,
        reply_to: Vec::new(),
        received_at: None,
        sent_at: None,
        body_file_id: input.body_file_id,
        attachment_file_ids: input.attachment_file_ids,
        snippet: input.snippet,
        unread: input.unread.unwrap_or(true),
        starred: false,
        labels: input.labels,
        thread_id: input.thread_id,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<MailMessage>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(ev) = audit_for_create(
        &user,
        ENTITY_KIND,
        new_id,
        Some(bson::to_document(&entity).unwrap_or_default()),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateMessageResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, message_id = %message_id))]
pub async fn update_message(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(message_id): Path<String>,
    Json(patch): Json<UpdateMessageInput>,
) -> Result<Json<MailMessage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&message_id)?;
    let coll = mongo.collection::<MailMessage>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.find_one")))?
        .ok_or_else(|| ApiError::NotFound("mail_message".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.folder_id {
        set.insert("folderId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.unread {
        set.insert("unread", v);
    }
    if let Some(v) = patch.starred {
        set.insert("starred", v);
    }
    if let Some(v) = patch.labels {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("labels", arr);
    }
    coll.update_one(ownership(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.update")))?;
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.refetch")))?
        .ok_or_else(|| ApiError::NotFound("mail_message".to_owned()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(bson::to_document(&before).unwrap_or_default()),
        Some(bson::to_document(&after).unwrap_or_default()),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, message_id = %message_id))]
pub async fn delete_message(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(message_id): Path<String>,
) -> Result<Json<DeleteMessageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&message_id)?;
    let coll = mongo.collection::<MailMessage>(COLL);
    let res = coll
        .delete_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("mail_messages.delete")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("mail_message".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteMessageResponse { deleted: true }))
}
