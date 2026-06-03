//! HTTP handlers for the Coupon promotional entity.

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
    CreateCouponInput, CreateCouponResponse, DeleteCouponResponse, ListQuery, UpdateCouponInput,
};
use crate::types::CrmCoupon;

const COLL: &str = "crm_coupons";
const ENTITY_KIND: &str = "coupon";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "expired" => {
            filter.insert("status", "expired");
        }
        "draft" => {
            filter.insert("status", "draft");
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

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_iso(s: &str) -> Option<BsonDateTime> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn coupon_from_create(input: CreateCouponInput, user_id: ObjectId) -> Result<CrmCoupon> {
    if input.code.trim().is_empty() {
        return Err(ApiError::Validation("code is required".to_owned()));
    }
    Ok(CrmCoupon {
        id: None,
        user_id,
        code: input.code.trim().to_uppercase(),
        kind: input.kind.unwrap_or_else(|| "percent".to_owned()),
        value: input.value,
        min_cart: input.min_cart,
        max_uses: input.max_uses,
        per_customer_limit: input.per_customer_limit,
        valid_from: input.valid_from.as_deref().and_then(parse_iso),
        valid_to: input.valid_to.as_deref().and_then(parse_iso),
        applicable_products: input.applicable_products,
        stackable: input.stackable.unwrap_or(false),
        status: Some("draft".to_owned()),
        used_count: 0,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCouponInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.code {
        set.insert("code", v.trim().to_uppercase());
    }
    if let Some(v) = patch.kind {
        set.insert("type", v);
    }
    if let Some(v) = patch.value {
        set.insert("value", v);
    }
    if let Some(v) = patch.min_cart {
        set.insert("minCart", v);
    }
    if let Some(v) = patch.max_uses {
        set.insert("maxUses", v);
    }
    if let Some(v) = patch.per_customer_limit {
        set.insert("perCustomerLimit", v);
    }
    if let Some(v) = patch.valid_from.as_deref().and_then(parse_iso) {
        set.insert("validFrom", v);
    }
    if let Some(v) = patch.valid_to.as_deref().and_then(parse_iso) {
        set.insert("validTo", v);
    }
    if let Some(v) = patch.applicable_products {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("applicableProducts", arr);
    }
    if let Some(v) = patch.stackable {
        set.insert("stackable", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmCoupon) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCoupon>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_coupons(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["code", "notes"]);
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

    let coll = mongo.collection::<CrmCoupon>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.find")))?;
    let mut rows: Vec<CrmCoupon> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, coupon_id = %coupon_id))]
pub async fn get_coupon(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(coupon_id): Path<String>,
) -> Result<Json<CrmCoupon>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&coupon_id)?;

    let coll = mongo.collection::<CrmCoupon>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.find_one")))?
        .ok_or_else(|| ApiError::NotFound("coupon".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_coupon(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCouponInput>,
) -> Result<Json<CreateCouponResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = coupon_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCoupon>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateCouponResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, coupon_id = %coupon_id))]
pub async fn update_coupon(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(coupon_id): Path<String>,
    Json(patch): Json<UpdateCouponInput>,
) -> Result<Json<CrmCoupon>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&coupon_id)?;

    let coll = mongo.collection::<CrmCoupon>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.find_one")))?
        .ok_or_else(|| ApiError::NotFound("coupon".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("coupon".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.refetch")))?
        .ok_or_else(|| ApiError::NotFound("coupon".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, coupon_id = %coupon_id))]
pub async fn delete_coupon(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(coupon_id): Path<String>,
) -> Result<Json<DeleteCouponResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&coupon_id)?;

    let coll = mongo.collection::<CrmCoupon>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_coupons.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("coupon".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteCouponResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn coupon_from_create_stamps_draft_status_and_uppercases_code() {
        let user_id = ObjectId::new();
        let input = CreateCouponInput {
            code: "summer50".into(),
            value: 50.0,
            ..Default::default()
        };
        let c = coupon_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("draft"));
        assert_eq!(c.code, "SUMMER50");
        assert_eq!(c.user_id, user_id);
        assert_eq!(c.used_count, 0);
    }

    #[test]
    fn coupon_from_create_rejects_empty_code() {
        let user_id = ObjectId::new();
        let input = CreateCouponInput {
            code: "  ".into(),
            value: 10.0,
            ..Default::default()
        };
        assert!(coupon_from_create(input, user_id).is_err());
    }
}
