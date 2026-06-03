use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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

use crate::dto::{ListQuery, UpsertAdGroupInput, UpsertAdGroupResponse};
use crate::types::SabopsAdGroup;

const COLL: &str = "sabops_ad_groups";
const VALID_KIND: &[&str] = &["security", "distribution"];

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsAdGroup>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_ad_groups(
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
    if let Some(k) = q.kind.as_deref() {
        if VALID_KIND.contains(&k) {
            filter.insert("kind", k);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabopsAdGroup>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_groups.find"))
        })?;
    let mut rows: Vec<SabopsAdGroup> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_groups.collect"))
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
pub async fn upsert_ad_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertAdGroupInput>,
) -> Result<Json<UpsertAdGroupResponse>> {
    let user_id = user_oid(&user)?;
    let domain_oid = oid_from_str(&input.domain_id)?;
    if !VALID_KIND.contains(&input.kind.as_str()) {
        return Err(ApiError::Validation(format!(
            "kind must be one of {:?}",
            VALID_KIND
        )));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let members_bson = bson::to_bson(&input.members)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("members encode")))?;

    let set: Document = doc! {
        "userId": user_id,
        "domainId": domain_oid,
        "name": &input.name,
        "kind": &input.kind,
        "members": members_bson,
        "lastSyncAt": now,
    };
    let filter = doc! {
        "userId": user_id,
        "domainId": domain_oid,
        "name": &input.name,
    };
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let coll = mongo.collection::<SabopsAdGroup>(COLL);
    let entity = coll
        .find_one_and_update(filter, doc! { "$set": set })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabops_ad_groups.upsert")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned None")))?;
    let id_hex = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(UpsertAdGroupResponse { id: id_hex, entity }))
}
