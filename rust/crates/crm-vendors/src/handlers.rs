//! HTTP handlers for the Vendor entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log` as
//! `entityKind: "vendor"`.

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
    CreateVendorInput, CreateVendorResponse, DeleteVendorResponse, ListQuery, UpdateVendorInput,
};
use crate::types::CrmVendor;

const VENDORS_COLL: &str = "crm_vendors";
const ENTITY_KIND: &str = "vendor";

// ─── Filter helpers ──────────────────────────────────────────────────────

/// Base tenant filter. `CrmVendor` has no status/archived column, so this
/// is the bare tenant scope.
fn list_filter(user_id: ObjectId) -> Document {
    doc! { "userId": user_id }
}

/// Filter targeting a single owned doc.
fn ownership_filter(user_id: ObjectId, vendor_oid: ObjectId) -> Document {
    doc! { "_id": vendor_oid, "userId": user_id }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn vendor_from_create(input: CreateVendorInput, user_id: ObjectId) -> Result<CrmVendor> {
    let industry_id = match input
        .industry_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(hex) => Some(oid_from_str(hex)?),
        None => None,
    };

    Ok(CrmVendor {
        id: None,
        user_id,
        name: input.name,
        display_name: input.display_name,
        industry: input.industry,
        industry_id,
        logo_url: input.logo_url,
        email: input.email,
        phone: input.phone,
        country: input.country,
        state: input.state,
        city: input.city,
        pincode: input.pincode,
        street: input.street,
        gstin: input.gstin,
        pan: input.pan,
        pan_name: input.pan_name,
        vendor_type: input.vendor_type,
        tax_treatment: input.tax_treatment,
        subject: input.subject,
        bank_account_details: input.bank_account_details,
        show_email_in_invoice: input.show_email_in_invoice,
        show_phone_in_invoice: input.show_phone_in_invoice,
        attachments: input.attachments,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateVendorInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.display_name {
        set.insert("displayName", v);
    }
    if let Some(v) = patch.industry {
        set.insert("industry", v);
    }
    if let Some(hex) = patch.industry_id {
        let trimmed = hex.trim();
        if trimmed.is_empty() {
            set.insert("industryId", Bson::Null);
        } else {
            set.insert("industryId", oid_from_str(trimmed)?);
        }
    }
    if let Some(v) = patch.logo_url {
        set.insert("logoUrl", v);
    }
    if let Some(v) = patch.email {
        set.insert("email", v);
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
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
    if let Some(v) = patch.pincode {
        set.insert("pincode", v);
    }
    if let Some(v) = patch.street {
        set.insert("street", v);
    }
    if let Some(v) = patch.gstin {
        set.insert("gstin", v);
    }
    if let Some(v) = patch.pan {
        set.insert("pan", v);
    }
    if let Some(v) = patch.pan_name {
        set.insert("panName", v);
    }
    if let Some(v) = patch.vendor_type {
        set.insert("vendorType", v);
    }
    if let Some(v) = patch.tax_treatment {
        set.insert("taxTreatment", v);
    }
    if let Some(v) = patch.subject {
        set.insert("subject", v);
    }
    if let Some(v) = patch.bank_account_details {
        let bson_val = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("serialize bankAccountDetails"))
        })?;
        set.insert("bankAccountDetails", bson_val);
    }
    if let Some(v) = patch.show_email_in_invoice {
        set.insert("showEmailInInvoice", v);
    }
    if let Some(v) = patch.show_phone_in_invoice {
        set.insert("showPhoneInInvoice", v);
    }
    if let Some(v) = patch.attachments {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("attachments", arr);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(vendor: &CrmVendor) -> Document {
    bson::to_document(vendor).unwrap_or_default()
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_vendors(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;

    let mut filter = list_filter(user_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "gstin", "email", "phone"]);
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

    let coll = mongo.collection::<CrmVendor>(VENDORS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.find")))?;
    let mut rows: Vec<CrmVendor> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.collect")))?;

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
    pub items: Vec<CrmVendor>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, vendor_id = %vendor_id))]
pub async fn get_vendor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_id): Path<String>,
) -> Result<Json<CrmVendor>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_id)?;

    let coll = mongo.collection::<CrmVendor>(VENDORS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.find_one")))?
        .ok_or_else(|| ApiError::NotFound("vendor".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_vendor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVendorInput>,
) -> Result<Json<CreateVendorResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut vendor = vendor_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmVendor>(VENDORS_COLL);
    let inserted = coll
        .insert_one(&vendor)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    vendor.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&vendor)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateVendorResponse {
        id: new_id.to_hex(),
        entity: vendor,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, vendor_id = %vendor_id))]
pub async fn update_vendor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_id): Path<String>,
    Json(patch): Json<UpdateVendorInput>,
) -> Result<Json<CrmVendor>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_id)?;

    let coll = mongo.collection::<CrmVendor>(VENDORS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.find_one")))?
        .ok_or_else(|| ApiError::NotFound("vendor".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("vendor".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.refetch")))?
        .ok_or_else(|| ApiError::NotFound("vendor".to_owned()))?;

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

/// Hard delete — the legacy `CrmVendor` TS type has no `status` field, so
/// there is no archive state to flip to. Matches the existing TS
/// `deleteCrmVendor` behavior.
#[instrument(skip_all, fields(user_id = %user.user_id, vendor_id = %vendor_id))]
pub async fn delete_vendor(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vendor_id): Path<String>,
) -> Result<Json<DeleteVendorResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vendor_id)?;

    let coll = mongo.collection::<CrmVendor>(VENDORS_COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_vendors.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("vendor".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteVendorResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn list_filter_is_scoped_to_tenant() {
        let oid = ObjectId::new();
        let f = list_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        // Vendor has no status column — filter has no status clause.
        assert!(!f.contains_key("status"));
        assert!(!f.contains_key("archived"));
    }

    #[test]
    fn ownership_filter_pins_both_id_and_user() {
        let user_id = ObjectId::new();
        let vendor_id = ObjectId::new();
        let f = ownership_filter(user_id, vendor_id);
        assert_eq!(f.get_object_id("userId").unwrap(), user_id);
        assert_eq!(f.get_object_id("_id").unwrap(), vendor_id);
    }

    #[test]
    fn build_update_doc_omits_unset_fields() {
        let patch = UpdateVendorInput {
            name: Some("Acme Supplies".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch).expect("ok");
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("name").unwrap(), "Acme Supplies");
        assert!(!set.contains_key("email"));
        assert!(!set.contains_key("gstin"));
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn build_update_doc_camel_cases_keys() {
        let patch = UpdateVendorInput {
            display_name: Some("ACME".into()),
            pan_name: Some("ACME PVT LTD".into()),
            tax_treatment: Some("registered".into()),
            show_email_in_invoice: Some(true),
            ..Default::default()
        };
        let d = build_update_doc(patch).expect("ok");
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("displayName").unwrap(), "ACME");
        assert_eq!(set.get_str("panName").unwrap(), "ACME PVT LTD");
        assert_eq!(set.get_str("taxTreatment").unwrap(), "registered");
        assert!(set.get_bool("showEmailInInvoice").unwrap());
    }

    #[test]
    fn build_update_doc_industry_id_null_clears_value() {
        let patch = UpdateVendorInput {
            industry_id: Some("".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch).expect("ok");
        let set = d.get_document("$set").unwrap();
        // Empty string => $set: { industryId: null } so the field is cleared.
        assert!(matches!(set.get("industryId"), Some(Bson::Null)));
    }

    #[test]
    fn build_update_doc_rejects_invalid_industry_id() {
        let patch = UpdateVendorInput {
            industry_id: Some("not-an-oid".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }

    #[test]
    fn vendor_from_create_persists_user_id_and_no_id() {
        let user_id = ObjectId::new();
        let input = CreateVendorInput {
            name: "Acme".into(),
            email: Some("ops@acme.test".into()),
            ..Default::default()
        };
        let v = vendor_from_create(input, user_id).expect("ok");
        assert_eq!(v.user_id, user_id);
        assert!(v.id.is_none());
        assert_eq!(v.email.as_deref(), Some("ops@acme.test"));
        assert!(v.updated_at.is_none());
    }

    #[test]
    fn vendor_from_create_parses_industry_id() {
        let user_id = ObjectId::new();
        let industry_oid = ObjectId::new();
        let input = CreateVendorInput {
            name: "Acme".into(),
            industry_id: Some(industry_oid.to_hex()),
            ..Default::default()
        };
        let v = vendor_from_create(input, user_id).expect("ok");
        assert_eq!(v.industry_id, Some(industry_oid));
    }

    #[test]
    fn vendor_from_create_rejects_invalid_industry_id() {
        let user_id = ObjectId::new();
        let input = CreateVendorInput {
            name: "Acme".into(),
            industry_id: Some("garbage".into()),
            ..Default::default()
        };
        assert!(vendor_from_create(input, user_id).is_err());
    }
}
