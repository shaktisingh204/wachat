//! HTTP handlers for the lead-capture Form entity.

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
    CreateFormInput, CreateFormResponse, DeleteFormResponse, ListQuery, UpdateFormInput,
};
use crate::types::CrmForm;

const COLL: &str = "crm_forms";
const ENTITY_KIND: &str = "form";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
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
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn form_from_create(input: CreateFormInput, user_id: ObjectId) -> Result<CrmForm> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmForm {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        slug: input
            .slug
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        url: input
            .url
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        fields: input.fields.unwrap_or_default(),
        settings: input.settings,
        submission_count: 0,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFormInput) -> Document {
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
    if let Some(v) = patch.url {
        set.insert("url", v);
    }
    if let Some(v) = patch.fields {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|f| bson::to_document(&f).ok())
            .collect();
        set.insert("fields", arr);
    }
    if let Some(v) = patch.settings {
        if let Ok(bson_val) = bson::to_bson(&v) {
            set.insert("settings", bson_val);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmForm) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmForm>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_forms(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "url"]);
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
    let coll = mongo.collection::<CrmForm>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find")))?;
    let mut rows: Vec<CrmForm> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn get_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<CrmForm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFormInput>,
) -> Result<Json<CreateFormResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = form_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateFormResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn update_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Json(patch): Json<UpdateFormInput>,
) -> Result<Json<CrmForm>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.refetch")))?
        .ok_or_else(|| ApiError::NotFound("form".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn delete_form(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<DeleteFormResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_forms.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteFormResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
        // Default should exclude archived (via $ne), not pin a specific value.
        let status = f.get("status").unwrap();
        assert!(status.as_document().is_some());
    }

    #[test]
    fn form_from_create_defaults_status_and_submission_count() {
        let user_id = ObjectId::new();
        let input = CreateFormInput {
            name: "Contact Us".into(),
            ..Default::default()
        };
        let f = form_from_create(input, user_id).unwrap();
        assert_eq!(f.status, "draft");
        assert_eq!(f.submission_count, 0);
        assert!(f.fields.is_empty());
        assert!(f.id.is_none());
    }

    #[test]
    fn form_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateFormInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(form_from_create(input, user_id).is_err());
    }
}
