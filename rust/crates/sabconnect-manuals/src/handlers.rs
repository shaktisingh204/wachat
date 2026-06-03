//! HTTP handlers for SabConnect manuals.

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
    CreateManualInput, CreateManualResponse, DeleteManualResponse, ListQuery, UpdateManualInput,
};
use crate::types::SabConnectManual;

const COLL: &str = "sabconnect_manuals";
const ENTITY_KIND: &str = "sabconnect_manual";

fn slugify(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_dash = false;
    for c in s.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_owned()
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(
    user_id: ObjectId,
    group_id: Option<&str>,
    parent_id: Option<&str>,
    published: Option<bool>,
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
    if let Some(g) = group_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("groupId", g);
    }
    if let Some(p) = parent_id {
        if p == "root" {
            filter.insert("parentId", doc! { "$exists": false });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
        }
    }
    if let Some(p) = published {
        filter.insert("published", p);
    }
    filter
}

fn manual_from_create(input: CreateManualInput, user_id: ObjectId) -> Result<SabConnectManual> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let title = input.title.trim().to_owned();
    let slug = input
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(&title));
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabConnectManual {
        id: None,
        user_id,
        title,
        slug,
        body: input.body,
        group_id: input
            .group_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        published: input.published.unwrap_or(false),
        author_id: input
            .author_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        author_name: input.author_name,
        version: 1,
        tags: input.tags.unwrap_or_default(),
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateManualInput, bump_version: bool) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", slugify(&v));
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch
        .group_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("groupId", v);
    }
    if let Some(v) = patch
        .parent_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentId", v);
    }
    if let Some(v) = patch.published {
        set.insert("published", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if bump_version {
        return doc! { "$set": set, "$inc": { "version": 1 } };
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabConnectManual) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabConnectManual>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_manuals(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.group_id.as_deref(),
        q.parent_id.as_deref(),
        q.published,
        q.status.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "body", "tags"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "title": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabConnectManual>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.find"))
    })?;
    let mut rows: Vec<SabConnectManual> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %manual_id))]
pub async fn get_manual(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(manual_id): Path<String>,
) -> Result<Json<SabConnectManual>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&manual_id)?;
    let coll = mongo.collection::<SabConnectManual>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("manual".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_manual(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateManualInput>,
) -> Result<Json<CreateManualResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = manual_from_create(input, user_id)?;
    let coll = mongo.collection::<SabConnectManual>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateManualResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %manual_id))]
pub async fn update_manual(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(manual_id): Path<String>,
    Json(patch): Json<UpdateManualInput>,
) -> Result<Json<SabConnectManual>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&manual_id)?;
    let coll = mongo.collection::<SabConnectManual>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("manual".to_owned()))?;
    let bump_version = patch.body.is_some();
    let update = build_update_doc(patch, bump_version);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("manual".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("manual".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %manual_id))]
pub async fn delete_manual(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(manual_id): Path<String>,
) -> Result<Json<DeleteManualResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&manual_id)?;
    let coll = mongo.collection::<SabConnectManual>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_manuals.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("manual".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteManualResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_handles_spaces_and_specials() {
        assert_eq!(slugify("Hello World!"), "hello-world");
        assert_eq!(slugify("  Onboarding 101  "), "onboarding-101");
    }

    #[test]
    fn create_assigns_default_slug_from_title() {
        let user_id = ObjectId::new();
        let m = manual_from_create(
            CreateManualInput {
                title: "Engineering Handbook".into(),
                body: "Intro".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        assert_eq!(m.slug, "engineering-handbook");
        assert_eq!(m.version, 1);
        assert!(!m.published);
    }
}
