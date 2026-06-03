use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, FindOptions, ReturnDocument};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, UpsertAdUserInput, UpsertAdUserResponse};
use crate::types::SabopsAdUser;

const COLL: &str = "sabops_ad_users";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsAdUser>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ad_users(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(d) = q
        .domain_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("domainId", d);
    }
    if let Some(e) = q.enabled {
        filter.insert("enabled", e);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["displayName", "upn", "samAccountName", "email"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "displayName": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsAdUser>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_users.find"))
        })?;
    let mut rows: Vec<SabopsAdUser> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_users.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_ad_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertAdUserInput>,
) -> Result<Json<UpsertAdUserResponse>> {
    let user_id = user_oid(&user)?;
    let domain_oid = oid_from_str(&input.domain_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let groups: Vec<Bson> = input.groups.into_iter().map(Bson::String).collect();
    let mut set: Document = doc! {
        "userId": user_id,
        "domainId": domain_oid,
        "samAccountName": &input.sam_account_name,
        "upn": &input.upn,
        "displayName": &input.display_name,
        "groups": groups,
        "enabled": input.enabled.unwrap_or(true),
        "lastSyncAt": now,
    };
    if let Some(e) = input.email {
        set.insert("email", e);
    }
    let filter = doc! {
        "userId": user_id,
        "domainId": domain_oid,
        "samAccountName": &input.sam_account_name,
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let coll = mongo.collection::<SabopsAdUser>(COLL);
    let entity = coll
        .find_one_and_update(filter, doc! { "$set": set })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_users.upsert")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned None")))?;
    let id_hex = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(UpsertAdUserResponse { id: id_hex, entity }))
}
