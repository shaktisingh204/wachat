//! HTTP handlers for the SabMail mailbox account entity.

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
    CreateAccountInput, CreateAccountResponse, DeleteAccountResponse, ListQuery, UpdateAccountInput,
};
use crate::types::SabmailAccount;

const COLL: &str = "sabmail_accounts";
const DOMAINS_COLL: &str = "sabmail_domains";
const ENTITY_KIND: &str = "sabmail_account";

fn list_filter(user_id: ObjectId, status: Option<&str>, domain_id: Option<ObjectId>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(did) = domain_id {
        filter.insert("domainId", did);
    }
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "suspended" => {
            filter.insert("status", "suspended");
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

async fn lookup_domain_name(
    mongo: &MongoHandle,
    user_id: ObjectId,
    domain_id: ObjectId,
) -> Option<String> {
    let coll = mongo.collection::<bson::Document>(DOMAINS_COLL);
    let row = coll
        .find_one(doc! { "_id": domain_id, "userId": user_id })
        .await
        .ok()
        .flatten()?;
    row.get_str("domain").ok().map(|s| s.to_owned())
}

fn build_update_doc(patch: UpdateAccountInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.password {
        // TODO: hash via the provider — placeholder stores the raw value.
        set.insert("passwordHash", v);
    }
    if let Some(v) = patch.quota_mb {
        set.insert("quotaMb", v as i64);
    }
    if let Some(v) = patch.forwarding_address {
        set.insert("forwardingAddress", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(a: &SabmailAccount) -> Document {
    bson::to_document(a).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabmailAccount>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_accounts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let domain_oid = q
        .domain_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?;
    let mut filter = list_filter(user_id, q.status.as_deref(), domain_oid);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["localPart", "displayName", "emailAddress"]);
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

    let coll = mongo.collection::<SabmailAccount>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.find"))
        })?;
    let mut rows: Vec<SabmailAccount> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn get_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
) -> Result<Json<SabmailAccount>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<SabmailAccount>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabmail_account".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAccountInput>,
) -> Result<Json<CreateAccountResponse>> {
    let user_id = user_oid(&user)?;
    if input.local_part.trim().is_empty() {
        return Err(ApiError::Validation("localPart is required".to_owned()));
    }
    let domain_oid = oid_from_str(&input.domain_id)?;
    let domain_name = lookup_domain_name(&mongo, user_id, domain_oid).await;

    let email = domain_name
        .as_deref()
        .map(|d| format!("{}@{}", input.local_part.trim().to_lowercase(), d));

    let mut entity = SabmailAccount {
        id: None,
        user_id,
        domain_id: domain_oid,
        local_part: input.local_part.trim().to_lowercase(),
        display_name: input.display_name,
        // TODO: hash via provider.
        password_hash: input.password,
        quota_mb: input.quota_mb.or(Some(1024)),
        status: Some("active".to_owned()),
        email_address: email,
        forwarding_address: input.forwarding_address,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<SabmailAccount>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateAccountResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn update_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
    Json(patch): Json<UpdateAccountInput>,
) -> Result<Json<SabmailAccount>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<SabmailAccount>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabmail_account".to_owned()))?;
    coll.update_one(ownership_filter(user_id, oid), build_update_doc(patch))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.update"))
        })?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_account".to_owned()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn delete_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
) -> Result<Json<DeleteAccountResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;
    let coll = mongo.collection::<SabmailAccount>(COLL);
    let res = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_accounts.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabmail_account".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteAccountResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_default_excludes_archived() {
        let f = list_filter(ObjectId::new(), None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_with_domain_includes_domain_id() {
        let d = ObjectId::new();
        let f = list_filter(ObjectId::new(), None, Some(d));
        assert!(f.contains_key("domainId"));
    }
}
