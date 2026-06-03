//! HTTP handlers for the KB Article entity.

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
    CreateArticleInput, CreateArticleResponse, DeleteArticleResponse, ListQuery, UpdateArticleInput,
};
use crate::types::CrmKbArticle;

const COLL: &str = "crm_kb_articles";
const ENTITY_KIND: &str = "kb_article";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    visibility: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "published" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(v) = visibility.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("visibility", v);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn slugify(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut last_dash = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

fn article_from_create(input: CreateArticleInput, user_id: ObjectId) -> Result<CrmKbArticle> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let slug = input
        .slug
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            let base = slugify(&input.title);
            let suffix = Utc::now().timestamp_millis().to_string();
            let tail = suffix.chars().rev().take(4).collect::<String>();
            format!("{}-{}", base, tail.chars().rev().collect::<String>())
        });
    Ok(CrmKbArticle {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        slug,
        body: input.body,
        category: input.category,
        tags: input.tags,
        visibility: Some(input.visibility.unwrap_or_else(|| "internal".to_owned())),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        owner_id: Some(input.owner_id.unwrap_or_else(|| user_id.to_hex())),
        helpful_count: 0,
        view_count: 0,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateArticleInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = patch.visibility {
        set.insert("visibility", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.owner_id {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.helpful_count {
        set.insert("helpfulCount", v);
    }
    if let Some(v) = patch.view_count {
        set.insert("viewCount", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmKbArticle) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmKbArticle>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_articles(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.visibility.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "body", "slug", "category"]);
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
    let coll = mongo.collection::<CrmKbArticle>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.find"))
        })?;
    let mut rows: Vec<CrmKbArticle> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %article_id))]
pub async fn get_article(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(article_id): Path<String>,
) -> Result<Json<CrmKbArticle>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&article_id)?;
    let coll = mongo.collection::<CrmKbArticle>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("kb_article".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_article(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateArticleInput>,
) -> Result<Json<CreateArticleResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = article_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmKbArticle>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateArticleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %article_id))]
pub async fn update_article(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(article_id): Path<String>,
    Json(patch): Json<UpdateArticleInput>,
) -> Result<Json<CrmKbArticle>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&article_id)?;
    let coll = mongo.collection::<CrmKbArticle>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("kb_article".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kb_article".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.refetch")))?
        .ok_or_else(|| ApiError::NotFound("kb_article".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %article_id))]
pub async fn delete_article(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(article_id): Path<String>,
) -> Result<Json<DeleteArticleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&article_id)?;
    let coll = mongo.collection::<CrmKbArticle>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_kb_articles.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kb_article".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteArticleResponse { deleted: true }))
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
    fn article_from_create_defaults_and_slug_generation() {
        let user_id = ObjectId::new();
        let input = CreateArticleInput {
            title: "How To Refund".into(),
            body: "Steps...".into(),
            ..Default::default()
        };
        let a = article_from_create(input, user_id).unwrap();
        assert_eq!(a.status, "draft");
        assert_eq!(a.visibility.as_deref(), Some("internal"));
        assert!(a.slug.starts_with("how-to-refund-"));
    }

    #[test]
    fn article_from_create_rejects_empty_body() {
        let user_id = ObjectId::new();
        let input = CreateArticleInput {
            title: "Title".into(),
            body: "".into(),
            ..Default::default()
        };
        assert!(article_from_create(input, user_id).is_err());
    }
}
