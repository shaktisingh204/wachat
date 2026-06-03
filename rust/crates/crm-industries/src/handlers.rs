//! HTTP handlers for the Industry classification entity.

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
    CreateIndustryInput, CreateIndustryResponse, DeleteIndustryResponse, ListQuery,
    UpdateIndustryInput,
};
use crate::types::CrmIndustry;

const COLL: &str = "crm_industries";
const ENTITY_KIND: &str = "industry";

fn list_filter(user_id: ObjectId, status: Option<&str>, parent_id: Option<&str>) -> Document {
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
    // `parent_id=null` (the literal string) means "match top-level rows
    // only" — covers both missing fields and explicit nulls.
    if let Some(raw) = parent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if raw.eq_ignore_ascii_case("null") {
            filter.insert(
                "$or",
                vec![
                    Bson::Document(doc! { "parentId": { "$exists": false } }),
                    Bson::Document(doc! { "parentId": Bson::Null }),
                ],
            );
        } else if let Ok(oid) = ObjectId::parse_str(raw) {
            filter.insert("parentId", oid);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn industry_from_create(input: CreateIndustryInput, user_id: ObjectId) -> Result<CrmIndustry> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmIndustry {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        slug: input
            .slug
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        description: input.description,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateIndustryInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.slug {
        set.insert("slug", v);
    }
    if let Some(raw) = patch.parent_id.as_deref().map(str::trim) {
        if raw.is_empty() || raw.eq_ignore_ascii_case("null") {
            set.insert("parentId", Bson::Null);
        } else if let Ok(oid) = ObjectId::parse_str(raw) {
            set.insert("parentId", oid);
        }
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmIndustry) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmIndustry>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_industries(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.parent_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            // Don't clobber a possible parent-id `$or` clause — wrap both
            // in an `$and`.
            if filter.contains_key("$or") {
                let existing = filter.remove("$or").unwrap_or(Bson::Null);
                filter.insert(
                    "$and",
                    vec![
                        Bson::Document(doc! { "$or": existing }),
                        Bson::Document(doc! { "$or": arr.clone() }),
                    ],
                );
            } else {
                filter.insert("$or", arr.clone());
            }
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmIndustry>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_industries.find"))
        })?;
    let mut rows: Vec<CrmIndustry> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, industry_id = %industry_id))]
pub async fn get_industry(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(industry_id): Path<String>,
) -> Result<Json<CrmIndustry>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&industry_id)?;

    let coll = mongo.collection::<CrmIndustry>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.find_one")))?
        .ok_or_else(|| ApiError::NotFound("industry".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_industry(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateIndustryInput>,
) -> Result<Json<CreateIndustryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = industry_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmIndustry>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateIndustryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, industry_id = %industry_id))]
pub async fn update_industry(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(industry_id): Path<String>,
    Json(patch): Json<UpdateIndustryInput>,
) -> Result<Json<CrmIndustry>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&industry_id)?;

    let coll = mongo.collection::<CrmIndustry>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.find_one")))?
        .ok_or_else(|| ApiError::NotFound("industry".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("industry".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.refetch")))?
        .ok_or_else(|| ApiError::NotFound("industry".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, industry_id = %industry_id))]
pub async fn delete_industry(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(industry_id): Path<String>,
) -> Result<Json<DeleteIndustryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&industry_id)?;

    let coll = mongo.collection::<CrmIndustry>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_industries.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("industry".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteIndustryResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        // `all` should strip the status clause entirely.
        let f_all = list_filter(oid, Some("all"), None);
        assert!(!f_all.contains_key("status"));
    }

    #[test]
    fn industry_from_create_defaults_status_and_active() {
        let user_id = ObjectId::new();
        let input = CreateIndustryInput {
            name: "  Manufacturing  ".into(),
            ..Default::default()
        };
        let ind = industry_from_create(input, user_id).unwrap();
        assert_eq!(ind.name, "Manufacturing"); // trimmed
        assert_eq!(ind.status, "active");
        assert!(ind.is_active);
        assert!(ind.parent_id.is_none());
    }

    #[test]
    fn industry_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateIndustryInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(industry_from_create(input, user_id).is_err());
    }
}
