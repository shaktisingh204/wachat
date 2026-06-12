//! HTTP handlers for the Gift Card entity.

use axum::{
    Extension, Json,
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
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateGiftCardInput, CreateGiftCardResponse, DeleteGiftCardResponse, ListQuery, ScopeQuery,
    UpdateGiftCardInput,
};
use crate::types::CrmGiftCard;

const COLL: &str = "crm_gift_cards";
const ENTITY_KIND: &str = "gift_card";

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId`.
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

fn parse_iso(s: &str) -> Option<BsonDateTime> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn list_filter(scope: &TenantScope, status: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "redeemed" => {
            filter.insert("status", "redeemed");
        }
        "expired" => {
            filter.insert("status", "expired");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

fn gift_card_from_create(input: CreateGiftCardInput, user_id: ObjectId) -> Result<CrmGiftCard> {
    if input.value <= 0.0 {
        return Err(ApiError::Validation("value must be positive".to_owned()));
    }
    let code = input
        .code
        .unwrap_or_else(|| format!("GC-{}", Utc::now().timestamp_millis()));
    Ok(CrmGiftCard {
        id: None,
        user_id,
        project_id: None,
        code: code.trim().to_uppercase(),
        value: input.value,
        balance: input.value,
        issued_to: input.issued_to,
        issued_to_email: input.issued_to_email,
        expiry_date: input.expiry_date.as_deref().and_then(parse_iso),
        transferable: input.transferable.unwrap_or(false),
        status: Some("active".to_owned()),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateGiftCardInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.code {
        set.insert("code", v.trim().to_uppercase());
    }
    if let Some(v) = patch.value {
        set.insert("value", v);
    }
    if let Some(v) = patch.balance {
        set.insert("balance", v);
    }
    if let Some(v) = patch.issued_to {
        set.insert("issuedTo", v);
    }
    if let Some(v) = patch.issued_to_email {
        set.insert("issuedToEmail", v);
    }
    if let Some(v) = patch.expiry_date.as_deref().and_then(parse_iso) {
        set.insert("expiryDate", v);
    }
    if let Some(v) = patch.transferable {
        set.insert("transferable", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmGiftCard) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmGiftCard>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_gift_cards(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["code", "issuedTo", "issuedToEmail"]);
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

    let coll = mongo.collection::<CrmGiftCard>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.find"))
        })?;
    let mut rows: Vec<CrmGiftCard> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %card_id))]
pub async fn get_gift_card(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(card_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmGiftCard>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&card_id)?;
    let coll = mongo.collection::<CrmGiftCard>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.find_one")))?
        .ok_or_else(|| ApiError::NotFound("gift_card".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_gift_card(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGiftCardInput>,
) -> Result<Json<CreateGiftCardResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    let mut entity = gift_card_from_create(input, user_id)?;
    if let TenantScope::Project(project_oid) = scope {
        entity.project_id = Some(project_oid);
    }
    let coll = mongo.collection::<CrmGiftCard>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateGiftCardResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %card_id))]
pub async fn update_gift_card(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(card_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateGiftCardInput>,
) -> Result<Json<CrmGiftCard>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&card_id)?;

    let coll = mongo.collection::<CrmGiftCard>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.find_one")))?
        .ok_or_else(|| ApiError::NotFound("gift_card".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("gift_card".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.refetch")))?
        .ok_or_else(|| ApiError::NotFound("gift_card".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %card_id))]
pub async fn delete_gift_card(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(card_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteGiftCardResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&card_id)?;

    let coll = mongo.collection::<CrmGiftCard>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_gift_cards.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("gift_card".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteGiftCardResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_scopes_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::Project(oid), None);
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn gift_card_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateGiftCardInput {
            code: Some("xmas100".into()),
            value: 100.0,
            ..Default::default()
        };
        let c = gift_card_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("active"));
        assert_eq!(c.code, "XMAS100");
        assert_eq!(c.balance, 100.0);
    }

    #[test]
    fn gift_card_from_create_rejects_zero_value() {
        let user_id = ObjectId::new();
        let input = CreateGiftCardInput {
            value: 0.0,
            ..Default::default()
        };
        assert!(gift_card_from_create(input, user_id).is_err());
    }

    #[test]
    fn gift_card_from_create_auto_generates_code() {
        let user_id = ObjectId::new();
        let input = CreateGiftCardInput {
            value: 50.0,
            ..Default::default()
        };
        let c = gift_card_from_create(input, user_id).unwrap();
        assert!(c.code.starts_with("GC-"));
    }
}
