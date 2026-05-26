//! HTTP handlers for SabMail rules.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateRuleInput, CreateRuleResponse, DeleteRuleResponse, ListQuery, UpdateRuleInput,
};
use crate::types::SabmailRule;

const COLL: &str = "sabmail_rules";
const ENTITY_KIND: &str = "sabmail_rule";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabmailRule>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rules(
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
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "priority": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmailRule>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.find")))?;
    let mut rows: Vec<SabmailRule> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, rule_id = %rule_id))]
pub async fn get_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
) -> Result<Json<SabmailRule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<SabmailRule>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_rule".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRuleInput>,
) -> Result<Json<CreateRuleResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let account_oid = oid_from_str(&input.account_id)?;
    let mut entity = SabmailRule {
        id: None,
        user_id,
        account_id: account_oid,
        name: input.name.trim().to_owned(),
        priority: input.priority.or(Some(100)),
        match_mode: input.match_mode.or_else(|| Some("all".to_owned())),
        conditions: input.conditions,
        actions: input.actions,
        enabled: input.enabled.or(Some(true)),
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmailRule>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.insert")))?;
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
    Ok(Json(CreateRuleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, rule_id = %rule_id))]
pub async fn update_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
    Json(patch): Json<UpdateRuleInput>,
) -> Result<Json<SabmailRule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<SabmailRule>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_rule".to_owned()))?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.match_mode {
        set.insert("matchMode", v);
    }
    if let Some(v) = patch.conditions {
        set.insert(
            "conditions",
            bson::to_bson(&v).unwrap_or(bson::Bson::Array(Vec::new())),
        );
    }
    if let Some(v) = patch.actions {
        set.insert(
            "actions",
            bson::to_bson(&v).unwrap_or(bson::Bson::Array(Vec::new())),
        );
    }
    if let Some(v) = patch.enabled {
        set.insert("enabled", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    coll.update_one(ownership(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.update")))?;
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_rule".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, rule_id = %rule_id))]
pub async fn delete_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
) -> Result<Json<DeleteRuleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<SabmailRule>(COLL);
    let res = coll
        .update_one(
            ownership(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_rules.archive")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabmail_rule".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteRuleResponse { deleted: true }))
}
