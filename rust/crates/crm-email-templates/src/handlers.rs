//! HTTP handlers for the Email Template entity.

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
    CreateEmailTemplateInput, CreateEmailTemplateResponse, DeleteEmailTemplateResponse, ListQuery,
    UpdateEmailTemplateInput,
};
use crate::types::CrmEmailTemplate;

const COLL: &str = "crm_email_templates";
const ENTITY_KIND: &str = "email_template";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    is_active: Option<bool>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(a) = is_active {
        filter.insert("isActive", a);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn template_from_create(
    input: CreateEmailTemplateInput,
    user_id: ObjectId,
) -> Result<CrmEmailTemplate> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.subject.trim().is_empty() {
        return Err(ApiError::Validation("subject is required".to_owned()));
    }
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let is_active = input.is_active.unwrap_or(true);
    Ok(CrmEmailTemplate {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        subject: input.subject.trim().to_owned(),
        body: input.body,
        text_body: input.text_body,
        category: input.category,
        variables: input.variables.unwrap_or_default(),
        is_active,
        status: if is_active { "active" } else { "archived" }.to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEmailTemplateInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.subject {
        set.insert("subject", v);
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.text_body {
        set.insert("textBody", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.variables {
        set.insert("variables", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmEmailTemplate) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmEmailTemplate>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_templates(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.is_active,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "subject", "body", "category"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmEmailTemplate>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.find"))
    })?;
    let mut rows: Vec<CrmEmailTemplate> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn get_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<CrmEmailTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<CrmEmailTemplate>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEmailTemplateInput>,
) -> Result<Json<CreateEmailTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = template_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmEmailTemplate>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.insert"))
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
    Ok(Json(CreateEmailTemplateResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn update_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
    Json(patch): Json<UpdateEmailTemplateInput>,
) -> Result<Json<CrmEmailTemplate>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<CrmEmailTemplate>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(ENTITY_KIND.to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound(ENTITY_KIND.to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %template_id))]
pub async fn delete_template(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(template_id): Path<String>,
) -> Result<Json<DeleteEmailTemplateResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&template_id)?;
    let coll = mongo.collection::<CrmEmailTemplate>(COLL);
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
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_email_templates.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound(ENTITY_KIND.to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteEmailTemplateResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        // Default should be the $ne archived branch, not literal "archived".
        let status = f.get("status").expect("status present");
        assert!(
            matches!(status, bson::Bson::Document(_)),
            "default status filter should be a doc with $ne, got: {status:?}"
        );
    }

    #[test]
    fn template_from_create_defaults_variables_and_active() {
        let user_id = ObjectId::new();
        let input = CreateEmailTemplateInput {
            name: "Welcome".into(),
            subject: "Hi there".into(),
            body: "<p>Hello</p>".into(),
            ..Default::default()
        };
        let t = template_from_create(input, user_id).unwrap();
        assert!(t.variables.is_empty());
        assert!(t.is_active);
        assert_eq!(t.status, "active");
        assert!(t.text_body.is_none());
        assert!(t.category.is_none());
    }

    #[test]
    fn template_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateEmailTemplateInput {
            name: "   ".into(),
            subject: "Subject".into(),
            body: "Body".into(),
            ..Default::default()
        };
        assert!(template_from_create(input, user_id).is_err());
    }
}
