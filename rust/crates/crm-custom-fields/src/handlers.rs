//! HTTP handlers for the CustomField entity.

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
    CreateCustomFieldInput, CreateCustomFieldResponse, DeleteCustomFieldResponse, ListQuery,
    UpdateCustomFieldInput,
};
use crate::types::CrmCustomField;

const COLL: &str = "crm_custom_fields";
const ENTITY_KIND: &str = "custom_field";

const VALID_FIELD_TYPES: &[&str] = &[
    "text",
    "textarea",
    "number",
    "currency",
    "date",
    "datetime",
    "boolean",
    "select",
    "multiselect",
    "url",
    "email",
    "phone",
    "file",
];

fn is_valid_field_type(s: &str) -> bool {
    VALID_FIELD_TYPES.contains(&s)
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    entity_kind: Option<&str>,
    field_type: Option<&str>,
    section: Option<&str>,
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
    if let Some(ek) = entity_kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("entityKind", ek);
    }
    if let Some(ft) = field_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("fieldType", ft);
    }
    if let Some(sc) = section.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("section", sc);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn field_from_create(input: CreateCustomFieldInput, user_id: ObjectId) -> Result<CrmCustomField> {
    let entity_kind = input.entity_kind.trim().to_owned();
    if entity_kind.is_empty() {
        return Err(ApiError::Validation("entityKind is required".to_owned()));
    }
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let label = input.label.trim().to_owned();
    if label.is_empty() {
        return Err(ApiError::Validation("label is required".to_owned()));
    }
    let field_type = input.field_type.trim().to_owned();
    if !is_valid_field_type(&field_type) {
        return Err(ApiError::Validation(format!(
            "fieldType must be one of: {}",
            VALID_FIELD_TYPES.join(", ")
        )));
    }
    Ok(CrmCustomField {
        id: None,
        user_id,
        entity_kind,
        name,
        label,
        field_type,
        help_text: input.help_text,
        placeholder: input.placeholder,
        default_value: input.default_value,
        required: input.required.unwrap_or(false),
        unique: input.unique.unwrap_or(false),
        options: input.options.unwrap_or_default(),
        validation: input.validation,
        display_order: input.display_order.unwrap_or(0),
        section: input.section,
        visible_in_list: input.visible_in_list.unwrap_or(false),
        visible_in_form: input.visible_in_form.unwrap_or(true),
        editable_in_form: input.editable_in_form.unwrap_or(true),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCustomFieldInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.entity_kind {
        let v = v.trim().to_owned();
        if v.is_empty() {
            return Err(ApiError::Validation(
                "entityKind cannot be empty".to_owned(),
            ));
        }
        set.insert("entityKind", v);
    }
    if let Some(v) = patch.name {
        let v = v.trim().to_owned();
        if v.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", v);
    }
    if let Some(v) = patch.label {
        let v = v.trim().to_owned();
        if v.is_empty() {
            return Err(ApiError::Validation("label cannot be empty".to_owned()));
        }
        set.insert("label", v);
    }
    if let Some(v) = patch.field_type {
        let v = v.trim().to_owned();
        if !is_valid_field_type(&v) {
            return Err(ApiError::Validation(format!(
                "fieldType must be one of: {}",
                VALID_FIELD_TYPES.join(", ")
            )));
        }
        set.insert("fieldType", v);
    }
    if let Some(v) = patch.help_text {
        set.insert("helpText", v);
    }
    if let Some(v) = patch.placeholder {
        set.insert("placeholder", v);
    }
    if let Some(v) = patch.default_value {
        set.insert("defaultValue", v);
    }
    if let Some(v) = patch.required {
        set.insert("required", v);
    }
    if let Some(v) = patch.unique {
        set.insert("unique", v);
    }
    if let Some(v) = patch.options {
        set.insert("options", v);
    }
    if let Some(v) = patch.validation {
        set.insert("validation", v);
    }
    if let Some(v) = patch.display_order {
        set.insert("displayOrder", v);
    }
    if let Some(v) = patch.section {
        set.insert("section", v);
    }
    if let Some(v) = patch.visible_in_list {
        set.insert("visibleInList", v);
    }
    if let Some(v) = patch.visible_in_form {
        set.insert("visibleInForm", v);
    }
    if let Some(v) = patch.editable_in_form {
        set.insert("editableInForm", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmCustomField) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

/// Per-tenant uniqueness on (entityKind, name) for non-archived rows.
async fn ensure_unique(
    coll: &mongodb::Collection<CrmCustomField>,
    user_id: ObjectId,
    entity_kind: &str,
    name: &str,
    exclude_id: Option<ObjectId>,
) -> Result<()> {
    let mut filter = doc! {
        "userId": user_id,
        "entityKind": entity_kind,
        "name": name,
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude_id {
        filter.insert("_id", doc! { "$ne": oid });
    }
    let existing = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.unique_check"))
    })?;
    if existing.is_some() {
        return Err(ApiError::Validation(format!(
            "a custom field with name '{name}' already exists for entityKind '{entity_kind}'"
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCustomField>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_custom_fields(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.entity_kind.as_deref(),
        q.field_type.as_deref(),
        q.section.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "label", "helpText", "section"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "displayOrder": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmCustomField>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.find"))
        })?;
    let mut rows: Vec<CrmCustomField> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %field_id))]
pub async fn get_custom_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(field_id): Path<String>,
) -> Result<Json<CrmCustomField>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&field_id)?;
    let coll = mongo.collection::<CrmCustomField>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("custom_field".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_custom_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCustomFieldInput>,
) -> Result<Json<CreateCustomFieldResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = field_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCustomField>(COLL);
    ensure_unique(&coll, user_id, &entity.entity_kind, &entity.name, None).await?;
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.insert"))
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
    Ok(Json(CreateCustomFieldResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %field_id))]
pub async fn update_custom_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(field_id): Path<String>,
    Json(patch): Json<UpdateCustomFieldInput>,
) -> Result<Json<CrmCustomField>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&field_id)?;
    let coll = mongo.collection::<CrmCustomField>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("custom_field".to_owned()))?;

    // If entityKind or name is being changed, re-check uniqueness.
    let next_entity_kind = patch
        .entity_kind
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_owned())
        .unwrap_or_else(|| before.entity_kind.clone());
    let next_name = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_owned())
        .unwrap_or_else(|| before.name.clone());
    if next_entity_kind != before.entity_kind || next_name != before.name {
        ensure_unique(&coll, user_id, &next_entity_kind, &next_name, Some(oid)).await?;
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("custom_field".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("custom_field".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %field_id))]
pub async fn delete_custom_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(field_id): Path<String>,
) -> Result<Json<DeleteCustomFieldResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&field_id)?;
    let coll = mongo.collection::<CrmCustomField>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_custom_fields.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("custom_field".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCustomFieldResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default_and_applies_entity_kind() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("contact"), None, None);
        assert!(f.contains_key("status"));
        assert_eq!(f.get_str("entityKind").ok(), Some("contact"));
    }

    #[test]
    fn field_from_create_defaults_and_required_inputs() {
        let user_id = ObjectId::new();
        let input = CreateCustomFieldInput {
            entity_kind: "contact".into(),
            name: "passport_number".into(),
            label: "Passport Number".into(),
            field_type: "text".into(),
            ..Default::default()
        };
        let f = field_from_create(input, user_id).unwrap();
        assert_eq!(f.entity_kind, "contact");
        assert_eq!(f.name, "passport_number");
        assert_eq!(f.label, "Passport Number");
        assert_eq!(f.field_type, "text");
        assert_eq!(f.status, "active");
        assert!(!f.required);
        assert!(!f.unique);
        assert!(!f.visible_in_list);
        assert!(f.visible_in_form);
        assert!(f.editable_in_form);
        assert!(f.is_active);
        assert_eq!(f.display_order, 0);
    }

    #[test]
    fn field_from_create_rejects_empty_and_invalid_inputs() {
        let user_id = ObjectId::new();

        // Empty entityKind.
        let bad_kind = CreateCustomFieldInput {
            entity_kind: "  ".into(),
            name: "foo".into(),
            label: "Foo".into(),
            field_type: "text".into(),
            ..Default::default()
        };
        assert!(field_from_create(bad_kind, user_id).is_err());

        // Empty name.
        let bad_name = CreateCustomFieldInput {
            entity_kind: "contact".into(),
            name: "".into(),
            label: "Foo".into(),
            field_type: "text".into(),
            ..Default::default()
        };
        assert!(field_from_create(bad_name, user_id).is_err());

        // Empty label.
        let bad_label = CreateCustomFieldInput {
            entity_kind: "contact".into(),
            name: "foo".into(),
            label: "".into(),
            field_type: "text".into(),
            ..Default::default()
        };
        assert!(field_from_create(bad_label, user_id).is_err());

        // Invalid fieldType.
        let bad_type = CreateCustomFieldInput {
            entity_kind: "contact".into(),
            name: "foo".into(),
            label: "Foo".into(),
            field_type: "rich_text".into(),
            ..Default::default()
        };
        assert!(field_from_create(bad_type, user_id).is_err());
    }
}
