//! HTTP handlers for the §6.2 Account/Client entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log`.

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
    CreateAccountInput, CreateAccountResponse, DeleteAccountResponse, ListQuery, UpdateAccountInput,
};
use crate::types::CrmAccount;

const ACCOUNTS_COLL: &str = "crm_accounts";
const ENTITY_KIND: &str = "account";

// ─── Filter helpers ──────────────────────────────────────────────────────

/// Base tenant filter. Defaults to **active** (non-archived) accounts; the
/// `status` query param can override to `archived` or `all`.
fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
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
    filter
}

/// Bare tenant filter — used for get_one / update / delete which should
/// see archived rows too (so an archived doc can still be unarchived).
fn ownership_filter(user_id: ObjectId, account_oid: ObjectId) -> Document {
    doc! { "_id": account_oid, "userId": user_id }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn account_from_create(input: CreateAccountInput, user_id: ObjectId) -> CrmAccount {
    CrmAccount {
        id: None,
        user_id,
        name: input.name,
        industry: input.industry,
        website: input.website,
        phone: input.phone,
        address: input.address,
        country: input.country,
        state: input.state,
        city: input.city,
        gstin: input.gstin,
        pan: input.pan,
        billing_address: input.billing_address,
        shipping_address: input.shipping_address,
        annual_revenue: input.annual_revenue,
        employee_count: input.employee_count,
        currency: input.currency,
        payment_terms: input.payment_terms,
        category: input.category,
        contact_ids: Vec::new(),
        deal_ids: Vec::new(),
        logo_url: input.logo_url,
        attachments: input.attachments,
        notes: Vec::new(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateAccountInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.industry {
        set.insert("industry", v);
    }
    if let Some(v) = patch.website {
        set.insert("website", v);
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.address {
        set.insert("address", v);
    }
    if let Some(v) = patch.country {
        set.insert("country", v);
    }
    if let Some(v) = patch.state {
        set.insert("state", v);
    }
    if let Some(v) = patch.city {
        set.insert("city", v);
    }
    if let Some(v) = patch.gstin {
        set.insert("gstin", v);
    }
    if let Some(v) = patch.pan {
        set.insert("pan", v);
    }
    if let Some(v) = patch.billing_address {
        set.insert("billingAddress", v);
    }
    if let Some(v) = patch.shipping_address {
        set.insert("shippingAddress", v);
    }
    if let Some(v) = patch.annual_revenue {
        set.insert("annualRevenue", v);
    }
    if let Some(v) = patch.employee_count {
        set.insert("employeeCount", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.payment_terms {
        set.insert("paymentTerms", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.logo_url {
        set.insert("logoUrl", v);
    }
    if let Some(v) = patch.attachments {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("attachments", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(account: &CrmAccount) -> Document {
    bson::to_document(account).unwrap_or_default()
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_accounts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;

    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "industry", "website"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1) // +1 to infer hasMore without a count
        .build();

    let coll = mongo.collection::<CrmAccount>(ACCOUNTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.find")))?;
    let mut rows: Vec<CrmAccount> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.collect")))?;

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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAccount>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn get_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
) -> Result<Json<CrmAccount>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;

    let coll = mongo.collection::<CrmAccount>(ACCOUNTS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("account".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAccountInput>,
) -> Result<Json<CreateAccountResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut account = account_from_create(input, user_id);
    let coll = mongo.collection::<CrmAccount>(ACCOUNTS_COLL);
    let inserted = coll
        .insert_one(&account)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    account.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&account)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateAccountResponse {
        id: new_id.to_hex(),
        entity: account,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn update_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
    Json(patch): Json<UpdateAccountInput>,
) -> Result<Json<CrmAccount>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;

    let coll = mongo.collection::<CrmAccount>(ACCOUNTS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("account".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("account".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("account".to_owned()))?;

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

// ─── DELETE /:id ────────────────────────────────────────────────────────

/// Soft delete — flips `status: "archived"`. Matches the existing TS
/// `archiveCrmAccount` behavior so the row stays referenceable by lineage.
#[instrument(skip_all, fields(user_id = %user.user_id, account_id = %account_id))]
pub async fn delete_account(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(account_id): Path<String>,
) -> Result<Json<DeleteAccountResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&account_id)?;

    let coll = mongo.collection::<CrmAccount>(ACCOUNTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_accounts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("account".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteAccountResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn list_filter_defaults_to_active() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        // active excludes status == 'archived'
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn list_filter_archived_matches_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("archived"));
        assert_eq!(f.get_str("status").unwrap(), "archived");
    }

    #[test]
    fn build_update_doc_omits_unset_fields() {
        let patch = UpdateAccountInput {
            name: Some("Acme".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch);
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("name").unwrap(), "Acme");
        assert!(!set.contains_key("industry"));
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn account_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateAccountInput {
            name: "Acme".into(),
            ..Default::default()
        };
        let acc = account_from_create(input, user_id);
        assert_eq!(acc.status.as_deref(), Some("active"));
        assert_eq!(acc.user_id, user_id);
        assert!(acc.id.is_none());
    }
}
