//! HTTP handlers for mail contacts sync.

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
    CreateContactInput, CreateContactResponse, DeleteContactResponse, ListQuery,
    UpdateContactInput,
};
use crate::types::MailContact;

const COLL: &str = "mail_contacts_sync";
const ENTITY_KIND: &str = "mail_contact";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<MailContact>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_contacts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id, "status": { "$ne": "archived" } };
    if let Some(aid) = q
        .account_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?
    {
        filter.insert("accountId", aid);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["displayName", "emails"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "lastUsedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<MailContact>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.find"))
        })?;
    let mut rows: Vec<MailContact> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn get_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
) -> Result<Json<MailContact>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;
    let coll = mongo.collection::<MailContact>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("mail_contact".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateContactInput>,
) -> Result<Json<CreateContactResponse>> {
    let user_id = user_oid(&user)?;
    let account_oid = oid_from_str(&input.account_id)?;
    if input.emails.is_empty() {
        return Err(ApiError::Validation(
            "at least one email is required".to_owned(),
        ));
    }
    let mut entity = MailContact {
        id: None,
        user_id,
        account_id: account_oid,
        display_name: input.display_name,
        emails: input
            .emails
            .into_iter()
            .map(|e| e.trim().to_lowercase())
            .collect(),
        last_used_at: None,
        send_count: Some(0),
        receive_count: Some(0),
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<MailContact>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.insert"))
    })?;
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
    Ok(Json(CreateContactResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn update_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
    Json(patch): Json<UpdateContactInput>,
) -> Result<Json<MailContact>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;
    let coll = mongo.collection::<MailContact>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("mail_contact".to_owned()))?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.emails {
        let arr: Vec<Bson> = v
            .into_iter()
            .map(|s| Bson::String(s.trim().to_lowercase()))
            .collect();
        set.insert("emails", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    coll.update_one(ownership(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.update"))
        })?;
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("mail_contact".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn delete_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
) -> Result<Json<DeleteContactResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;
    let coll = mongo.collection::<MailContact>(COLL);
    let res = coll
        .update_one(
            ownership(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("mail_contacts_sync.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("mail_contact".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteContactResponse { deleted: true }))
}
