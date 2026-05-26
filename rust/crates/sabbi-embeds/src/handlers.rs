//! HTTP handlers for the SabBI Embed entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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
    CreateEmbedInput, CreateEmbedResponse, DeleteEmbedResponse, ListQuery, ResolvedEmbed,
    UpdateEmbedInput,
};
use crate::types::BiEmbed;

pub(crate) const COLL: &str = "sabbi_embeds";
const WORKBOOKS_COLL: &str = "sabbi_workbooks";

fn list_filter(user_id: ObjectId, status: Option<&str>, workbook_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "revoked" => {
            filter.insert("status", "revoked");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "revoked" });
        }
    }
    if let Some(s) = workbook_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("workbookId", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Generate a 32-char URL-safe random token using ObjectId-derived bytes.
/// This is a pragmatic choice — no extra rand-crate dep needed at the
/// crate level. The token is opaque to callers.
fn new_token() -> String {
    let a = ObjectId::new().to_hex();
    let b = ObjectId::new().to_hex();
    // 24 + 24 = 48 hex chars → trim to 32 for compactness.
    let mut s = String::with_capacity(32);
    s.push_str(&a);
    s.push_str(&b);
    s.truncate(32);
    s
}

fn embed_from_create(input: CreateEmbedInput, user_id: ObjectId) -> Result<BiEmbed> {
    let workbook_id = ObjectId::parse_str(&input.workbook_id)
        .map_err(|_| ApiError::Validation("workbookId is not a valid ObjectId".to_owned()))?;
    Ok(BiEmbed {
        id: None,
        user_id,
        workbook_id,
        token: new_token(),
        expires_at: input.expires_at.map(BsonDateTime::from_chrono),
        allow_origins: input
            .allow_origins
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect(),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEmbedInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.expires_at {
        set.insert("expiresAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.allow_origins {
        let cleaned: Vec<String> = v
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect();
        set.insert("allowOrigins", cleaned);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiEmbed>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_embeds(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, q.status.as_deref(), q.workbook_id.as_deref());
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BiEmbed>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.find")))?;
    let mut rows: Vec<BiEmbed> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.collect")))?;
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
pub async fn create_embed(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEmbedInput>,
) -> Result<Json<CreateEmbedResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = embed_from_create(input, user_id)?;
    let coll = mongo.collection::<BiEmbed>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    let public_path = format!("/embed/bi/{}", entity.token);
    Ok(Json(CreateEmbedResponse {
        id: new_id.to_hex(),
        entity,
        public_path,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %embed_id))]
pub async fn update_embed(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(embed_id): Path<String>,
    Json(patch): Json<UpdateEmbedInput>,
) -> Result<Json<BiEmbed>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&embed_id)?;
    let coll = mongo.collection::<BiEmbed>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("embed".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.refetch")))?
        .ok_or_else(|| ApiError::NotFound("embed".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %embed_id))]
pub async fn delete_embed(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(embed_id): Path<String>,
) -> Result<Json<DeleteEmbedResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&embed_id)?;
    let coll = mongo.collection::<BiEmbed>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "revoked",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.revoke")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("embed".to_owned()));
    }
    Ok(Json(DeleteEmbedResponse { deleted: true }))
}

/// Public token resolution — **no auth**. Looks up an embed by token,
/// enforces expiry / revocation, and returns the minimal payload the
/// public renderer needs.
#[instrument(skip_all, fields(token = %token))]
pub async fn resolve_public_embed(
    State(mongo): State<MongoHandle>,
    Path(token): Path<String>,
) -> Result<Json<ResolvedEmbed>> {
    if token.is_empty() {
        return Err(ApiError::NotFound("embed".to_owned()));
    }
    let coll = mongo.collection::<BiEmbed>(COLL);
    let embed = coll
        .find_one(doc! { "token": &token, "status": "active" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.resolve")))?
        .ok_or_else(|| ApiError::NotFound("embed".to_owned()))?;

    if let Some(expires) = embed.expires_at
        && expires.to_chrono() < Utc::now()
    {
        return Err(ApiError::NotFound("embed expired".to_owned()));
    }

    let workbooks = mongo.collection::<Document>(WORKBOOKS_COLL);
    let workbook = workbooks
        .find_one(doc! { "_id": embed.workbook_id, "userId": embed.user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_embeds.workbook")))?
        .ok_or_else(|| ApiError::NotFound("workbook".to_owned()))?;

    let name = workbook.get_str("name").unwrap_or("").to_owned();
    let description = workbook
        .get_str("description")
        .ok()
        .map(str::to_owned)
        .filter(|s| !s.is_empty());
    let charts = workbook
        .get_array("chartsJson")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_document().cloned())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Json(ResolvedEmbed {
        workbook_id: embed.workbook_id.to_hex(),
        name,
        description,
        charts,
        allow_origins: embed.allow_origins,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_32_chars() {
        let t = new_token();
        assert_eq!(t.len(), 32);
    }
}
