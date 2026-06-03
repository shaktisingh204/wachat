//! HTTP handlers for the Currency master entity.

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
    CreateCurrencyInput, CreateCurrencyResponse, DeleteCurrencyResponse, ListQuery,
    UpdateCurrencyInput,
};
use crate::types::CrmCurrency;

const COLL: &str = "crm_currencies";
const ENTITY_KIND: &str = "currency";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    is_base: Option<bool>,
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
    if let Some(b) = is_base {
        filter.insert("isBase", b);
    }
    if let Some(a) = is_active {
        filter.insert("isActive", a);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Non-archived doc with the same code for this tenant — used for unique-code
/// enforcement on create and rename. Code is compared in canonical (uppercase)
/// form, matching what we persist.
fn duplicate_code_filter(user_id: ObjectId, code: &str, exclude: Option<ObjectId>) -> Document {
    let mut filter = doc! {
        "userId": user_id,
        "code": code,
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    filter
}

/// Validate and normalize a currency code: trim, uppercase, must be exactly
/// 3 ASCII alphabetic characters (ISO 4217 alpha-3).
fn normalize_code(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ApiError::Validation("code is required".to_owned()));
    }
    let upper = trimmed.to_ascii_uppercase();
    if upper.chars().count() != 3 || !upper.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err(ApiError::Validation(
            "code must be a 3-letter ISO 4217 alpha code".to_owned(),
        ));
    }
    Ok(upper)
}

fn currency_from_create(input: CreateCurrencyInput, user_id: ObjectId) -> Result<CrmCurrency> {
    let code = normalize_code(&input.code)?;
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let decimal_places = input.decimal_places.unwrap_or(2);
    if !(0..=8).contains(&decimal_places) {
        return Err(ApiError::Validation(
            "decimalPlaces must be between 0 and 8".to_owned(),
        ));
    }
    let exchange_rate = input.exchange_rate.unwrap_or(1.0);
    if !exchange_rate.is_finite() || exchange_rate <= 0.0 {
        return Err(ApiError::Validation(
            "exchangeRate must be a positive number".to_owned(),
        ));
    }
    if let Some(fmt) = input.display_format.as_deref() {
        if !matches!(fmt, "prefix" | "suffix") {
            return Err(ApiError::Validation(
                "displayFormat must be 'prefix' or 'suffix'".to_owned(),
            ));
        }
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    // `exchangeRate` is always set on create — stamp `lastUpdated`.
    Ok(CrmCurrency {
        id: None,
        user_id,
        code,
        name,
        symbol: input
            .symbol
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        decimal_places,
        exchange_rate,
        is_base: input.is_base.unwrap_or(false),
        display_format: input
            .display_format
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        thousand_separator: input.thousand_separator,
        decimal_separator: input.decimal_separator,
        is_active: input.is_active.unwrap_or(true),
        last_updated: Some(now),
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    })
}

/// Build the `$set` document for a PATCH. Validates `code`, `decimalPlaces`,
/// `exchangeRate`, and `displayFormat`. Stamps `lastUpdated` whenever
/// `exchangeRate` is written. Returns the normalized new code (if any) so
/// the caller can run the duplicate-code guard against it.
fn build_update_doc(patch: UpdateCurrencyInput) -> Result<(Document, Option<String>)> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    let mut new_code: Option<String> = None;

    if let Some(v) = patch.code {
        let normalized = normalize_code(&v)?;
        set.insert("code", &normalized);
        new_code = Some(normalized);
    }
    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.symbol {
        set.insert("symbol", v);
    }
    if let Some(v) = patch.decimal_places {
        if !(0..=8).contains(&v) {
            return Err(ApiError::Validation(
                "decimalPlaces must be between 0 and 8".to_owned(),
            ));
        }
        set.insert("decimalPlaces", v);
    }
    if let Some(v) = patch.exchange_rate {
        if !v.is_finite() || v <= 0.0 {
            return Err(ApiError::Validation(
                "exchangeRate must be a positive number".to_owned(),
            ));
        }
        set.insert("exchangeRate", v);
        set.insert("lastUpdated", now);
    }
    if let Some(v) = patch.is_base {
        set.insert("isBase", v);
    }
    if let Some(v) = patch.display_format {
        if !matches!(v.as_str(), "prefix" | "suffix") {
            return Err(ApiError::Validation(
                "displayFormat must be 'prefix' or 'suffix'".to_owned(),
            ));
        }
        set.insert("displayFormat", v);
    }
    if let Some(v) = patch.thousand_separator {
        set.insert("thousandSeparator", v);
    }
    if let Some(v) = patch.decimal_separator {
        set.insert("decimalSeparator", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok((doc! { "$set": set }, new_code))
}

fn doc_for_audit(entity: &CrmCurrency) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCurrency>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_currencies(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_base, q.is_active);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["code", "name", "symbol"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        // Base currency surfaces first, then alpha by code.
        .sort(doc! { "isBase": -1, "code": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmCurrency>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.find"))
        })?;
    let mut rows: Vec<CrmCurrency> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %currency_id))]
pub async fn get_currency(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(currency_id): Path<String>,
) -> Result<Json<CrmCurrency>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&currency_id)?;
    let coll = mongo.collection::<CrmCurrency>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.find_one")))?
        .ok_or_else(|| ApiError::NotFound("currency".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_currency(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCurrencyInput>,
) -> Result<Json<CreateCurrencyResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = currency_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCurrency>(COLL);

    // Unique-code guard (scoped to non-archived rows for this tenant).
    let dup = coll
        .find_one(duplicate_code_filter(user_id, &entity.code, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "currency '{}' already exists",
            entity.code
        )));
    }

    // If this row claims to be the base, demote any existing base for this
    // tenant. We do this before insert so the new doc lands as the sole base.
    if entity.is_base {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isBase": true },
                doc! { "$set": { "isBase": false } },
            )
            .await;
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateCurrencyResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %currency_id))]
pub async fn update_currency(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(currency_id): Path<String>,
    Json(patch): Json<UpdateCurrencyInput>,
) -> Result<Json<CrmCurrency>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&currency_id)?;
    let coll = mongo.collection::<CrmCurrency>(COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.find_one")))?
        .ok_or_else(|| ApiError::NotFound("currency".to_owned()))?;

    let promoting_to_base = matches!(patch.is_base, Some(true));
    let (update, new_code) = build_update_doc(patch)?;

    // Code-uniqueness guard (only if the patch is renaming the code).
    if let Some(ref code) = new_code {
        if *code != before.code {
            let dup = coll
                .find_one(duplicate_code_filter(user_id, code, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.dup_check"))
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "currency '{code}' already exists"
                )));
            }
        }
    }

    // Demote sibling bases when promoting this row.
    if promoting_to_base {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isBase": true, "_id": { "$ne": oid } },
                doc! { "$set": { "isBase": false } },
            )
            .await;
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("currency".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.refetch")))?
        .ok_or_else(|| ApiError::NotFound("currency".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %currency_id))]
pub async fn delete_currency(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(currency_id): Path<String>,
) -> Result<Json<DeleteCurrencyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&currency_id)?;
    let coll = mongo.collection::<CrmCurrency>(COLL);
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_currencies.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("currency".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCurrencyResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn currency_from_create_uppercases_code_and_stamps_last_updated() {
        let user_id = ObjectId::new();
        let input = CreateCurrencyInput {
            code: "  inr ".into(),
            name: "Indian Rupee".into(),
            symbol: Some("₹".into()),
            ..Default::default()
        };
        let c = currency_from_create(input, user_id).unwrap();
        assert_eq!(c.code, "INR");
        assert_eq!(c.name, "Indian Rupee");
        assert_eq!(c.decimal_places, 2);
        assert_eq!(c.exchange_rate, 1.0);
        assert_eq!(c.status, "active");
        assert!(c.is_active);
        // `exchangeRate` is always written on create, so `lastUpdated` is stamped.
        assert!(c.last_updated.is_some());
    }

    #[test]
    fn currency_from_create_rejects_invalid_code_and_bad_inputs() {
        let user_id = ObjectId::new();

        // Empty code
        let empty = CreateCurrencyInput {
            code: "".into(),
            name: "X".into(),
            ..Default::default()
        };
        assert!(currency_from_create(empty, user_id).is_err());

        // Wrong length
        let too_long = CreateCurrencyInput {
            code: "USDX".into(),
            name: "X".into(),
            ..Default::default()
        };
        assert!(currency_from_create(too_long, user_id).is_err());

        // Non-alpha
        let digits = CreateCurrencyInput {
            code: "US1".into(),
            name: "X".into(),
            ..Default::default()
        };
        assert!(currency_from_create(digits, user_id).is_err());

        // Empty name
        let no_name = CreateCurrencyInput {
            code: "USD".into(),
            name: "  ".into(),
            ..Default::default()
        };
        assert!(currency_from_create(no_name, user_id).is_err());

        // Non-positive exchange rate
        let bad_rate = CreateCurrencyInput {
            code: "USD".into(),
            name: "US Dollar".into(),
            exchange_rate: Some(0.0),
            ..Default::default()
        };
        assert!(currency_from_create(bad_rate, user_id).is_err());

        // Bad displayFormat
        let bad_fmt = CreateCurrencyInput {
            code: "USD".into(),
            name: "US Dollar".into(),
            display_format: Some("inside".into()),
            ..Default::default()
        };
        assert!(currency_from_create(bad_fmt, user_id).is_err());
    }

    #[test]
    fn build_update_doc_stamps_last_updated_on_exchange_rate_change() {
        let patch = UpdateCurrencyInput {
            exchange_rate: Some(83.25),
            ..Default::default()
        };
        let (doc, new_code) = build_update_doc(patch).unwrap();
        assert!(new_code.is_none());
        let set = doc.get_document("$set").unwrap();
        assert!(set.contains_key("exchangeRate"));
        assert!(set.contains_key("lastUpdated"));
        assert!(set.contains_key("updatedAt"));

        // Rate-less patch should not write `lastUpdated`.
        let patch_no_rate = UpdateCurrencyInput {
            name: Some("Renamed".into()),
            ..Default::default()
        };
        let (doc_no_rate, _) = build_update_doc(patch_no_rate).unwrap();
        let set_no_rate = doc_no_rate.get_document("$set").unwrap();
        assert!(set_no_rate.contains_key("name"));
        assert!(!set_no_rate.contains_key("lastUpdated"));

        // Code patch returns the normalized (uppercased, trimmed) form.
        let patch_code = UpdateCurrencyInput {
            code: Some(" eur ".into()),
            ..Default::default()
        };
        let (_, code) = build_update_doc(patch_code).unwrap();
        assert_eq!(code.as_deref(), Some("EUR"));
    }
}
