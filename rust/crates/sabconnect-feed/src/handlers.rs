//! HTTP handlers for the SabConnect feed.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateFeedItemInput, CreateFeedItemResponse, DeleteFeedItemResponse, ListQuery,
    UpdateFeedItemInput,
};
use crate::types::SabConnectFeedItem;

const COLL: &str = "sabconnect_feed";
const ENTITY_KIND: &str = "sabconnect_feed_item";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(
    user_id: ObjectId,
    kind: Option<&str>,
    group_id: Option<&str>,
    author_id: Option<&str>,
    status: Option<&str>,
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
    if let Some(k) = kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(g) = group_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("groupId", g);
    }
    if let Some(a) = author_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("authorId", a);
    }
    filter
}

fn feed_from_create(input: CreateFeedItemInput, user_id: ObjectId) -> Result<SabConnectFeedItem> {
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let author_id = ObjectId::parse_str(&input.author_id)
        .map_err(|_| ApiError::Validation("authorId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabConnectFeedItem {
        id: None,
        user_id,
        author_id,
        author_name: input.author_name,
        author_avatar_url: input.author_avatar_url,
        kind: input.kind.unwrap_or_else(|| "post".to_owned()),
        body: input.body.trim().to_owned(),
        attachment_ids: input.attachment_ids.unwrap_or_default(),
        ref_id: input
            .ref_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        group_id: input
            .group_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        pinned_until: input.pinned_until.as_deref().and_then(parse_date),
        reaction_count: 0,
        comment_count: 0,
        tags: input.tags.unwrap_or_default(),
        status: "published".to_owned(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFeedItemInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.attachment_ids {
        set.insert("attachmentIds", v);
    }
    if let Some(v) = patch.pinned_until.as_deref().and_then(parse_date) {
        set.insert("pinnedUntil", v);
    }
    if let Some(v) = patch.reaction_count {
        set.insert("reactionCount", v);
    }
    if let Some(v) = patch.comment_count {
        set.insert("commentCount", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabConnectFeedItem) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabConnectFeedItem>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_feed(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.kind.as_deref(),
        q.group_id.as_deref(),
        q.author_id.as_deref(),
        q.status.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["body", "authorName", "tags"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "pinnedUntil": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabConnectFeedItem>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.find")))?;
    let mut rows: Vec<SabConnectFeedItem> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn get_feed_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<SabConnectFeedItem>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<SabConnectFeedItem>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.find_one")))?
        .ok_or_else(|| ApiError::NotFound("feed item".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_feed_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFeedItemInput>,
) -> Result<Json<CreateFeedItemResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = feed_from_create(input, user_id)?;
    let coll = mongo.collection::<SabConnectFeedItem>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateFeedItemResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn update_feed_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
    Json(patch): Json<UpdateFeedItemInput>,
) -> Result<Json<SabConnectFeedItem>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<SabConnectFeedItem>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.find_one")))?
        .ok_or_else(|| ApiError::NotFound("feed item".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("feed item".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.refetch")))?
        .ok_or_else(|| ApiError::NotFound("feed item".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %item_id))]
pub async fn delete_feed_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(item_id): Path<String>,
) -> Result<Json<DeleteFeedItemResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&item_id)?;
    let coll = mongo.collection::<SabConnectFeedItem>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabconnect_feed.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("feed item".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteFeedItemResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feed_from_create_requires_body() {
        let user_id = ObjectId::new();
        let input = CreateFeedItemInput {
            author_id: ObjectId::new().to_hex(),
            body: "   ".into(),
            ..Default::default()
        };
        assert!(feed_from_create(input, user_id).is_err());
    }

    #[test]
    fn feed_from_create_defaults_kind_to_post() {
        let user_id = ObjectId::new();
        let input = CreateFeedItemInput {
            author_id: ObjectId::new().to_hex(),
            body: "Hello team".into(),
            ..Default::default()
        };
        let item = feed_from_create(input, user_id).unwrap();
        assert_eq!(item.kind, "post");
        assert_eq!(item.status, "published");
        assert_eq!(item.reaction_count, 0);
    }
}
