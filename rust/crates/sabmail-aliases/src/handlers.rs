//! HTTP handlers for SabMail aliases.

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
    CreateAliasInput, CreateAliasResponse, DeleteAliasResponse, ListQuery, UpdateAliasInput,
};
use crate::types::SabmailAlias;

const COLL: &str = "sabmail_aliases";
const ENTITY_KIND: &str = "sabmail_alias";

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
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_oid_vec(v: &[String]) -> Result<Vec<ObjectId>> {
    v.iter().map(|s| oid_from_str(s)).collect()
}

fn build_update_doc(patch: UpdateAliasInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.source_address {
        set.insert("sourceAddress", v.trim().to_lowercase());
    }
    if let Some(v) = patch.target_account_ids {
        let oids = parse_oid_vec(&v)?;
        let arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
        set.insert("targetAccountIds", arr);
    }
    if let Some(v) = patch.external_targets {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("externalTargets", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(a: &SabmailAlias) -> Document {
    bson::to_document(a).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabmailAlias>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_aliases(
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
        let or = build_q_filter(needle, &["sourceAddress"]);
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
    let coll = mongo.collection::<SabmailAlias>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.find"))
        })?;
    let mut rows: Vec<SabmailAlias> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, alias_id = %alias_id))]
pub async fn get_alias(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(alias_id): Path<String>,
) -> Result<Json<SabmailAlias>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&alias_id)?;
    let coll = mongo.collection::<SabmailAlias>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_alias".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_alias(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAliasInput>,
) -> Result<Json<CreateAliasResponse>> {
    let user_id = user_oid(&user)?;
    if input.source_address.trim().is_empty() {
        return Err(ApiError::Validation("sourceAddress is required".to_owned()));
    }
    let domain_oid = oid_from_str(&input.domain_id)?;
    let targets = parse_oid_vec(&input.target_account_ids)?;
    let mut entity = SabmailAlias {
        id: None,
        user_id,
        domain_id: domain_oid,
        source_address: input.source_address.trim().to_lowercase(),
        target_account_ids: targets,
        external_targets: input.external_targets,
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmailAlias>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateAliasResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, alias_id = %alias_id))]
pub async fn update_alias(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(alias_id): Path<String>,
    Json(patch): Json<UpdateAliasInput>,
) -> Result<Json<SabmailAlias>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&alias_id)?;
    let coll = mongo.collection::<SabmailAlias>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_alias".to_owned()))?;
    let update = build_update_doc(patch)?;
    coll.update_one(ownership(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.update")))?;
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_alias".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, alias_id = %alias_id))]
pub async fn delete_alias(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(alias_id): Path<String>,
) -> Result<Json<DeleteAliasResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&alias_id)?;
    let coll = mongo.collection::<SabmailAlias>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_aliases.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabmail_alias".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteAliasResponse { deleted: true }))
}
