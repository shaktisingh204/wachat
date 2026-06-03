//! HTTP handlers for the §12.13 Fixed Asset entity.
//!
//! Six handlers — the standard five plus a depreciate posting:
//!
//! | Method  | Path                     | Function                |
//! |---------|--------------------------|-------------------------|
//! | `GET`   | `/`                      | [`list_assets`]         |
//! | `GET`   | `/:assetId`              | [`get_asset`]           |
//! | `POST`  | `/`                      | [`create_asset`]        |
//! | `PATCH` | `/:assetId`              | [`update_asset`]        |
//! | `DELETE`| `/:assetId`              | [`delete_asset`]        |
//! | `POST`  | `/:assetId/depreciate`   | [`depreciate_asset`]    |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use crm_extras_types::{AssetCondition, DepreciationMethod, FixedAsset};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateFixedAssetInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateFixedAssetInput,
};

/// Mongo collection name. Must match the §12.13 spec literal so this
/// crate and any TS callers share the same backing collection during
/// the migration window.
const FIXED_ASSETS_COLL: &str = "crm_fixed_assets";

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Materialize the base ownership filter:
/// `{ userId, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent != `null`).
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-OID update helper. Parses a 24-char hex string when
/// present and stores the OID; rejects malformed input with
/// `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Parse a wire-format string into a typed enum via serde. Returns a
/// human-readable [`ApiError::Validation`] on bad input. The `field`
/// label is embedded in the error message so the UI can pinpoint the
/// offending field.
fn parse_enum<T: serde::de::DeserializeOwned>(field: &str, raw: &str) -> Result<T> {
    serde_json::from_value::<T>(serde_json::Value::String(raw.to_owned())).map_err(|_| {
        ApiError::Validation(format!("{field} value '{raw}' is not a recognised variant"))
    })
}

/// Re-serialize a typed enum back to its canonical lowercase
/// JSON representation so we can write it into a Mongo `$set` document
/// without re-implementing the variant table.
fn enum_to_str<T: serde::Serialize>(value: &T) -> Result<String> {
    let v = serde_json::to_value(value)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("enum serialize")))?;
    v.as_str().map(|s| s.to_owned()).ok_or_else(|| {
        ApiError::Internal(anyhow::anyhow!("expected string-shaped enum on serialize"))
    })
}

/// Whole-month delta from `from` to `to`, floored at zero. Used by
/// the depreciation engine to decide how many monthly charges to
/// post. We compute via the calendar (year/month deltas) rather than
/// raw seconds so a 30/31-day month asymmetry doesn't bias the
/// result.
fn months_elapsed(from: DateTime<Utc>, to: DateTime<Utc>) -> u32 {
    use chrono::Datelike;
    if to <= from {
        return 0;
    }
    let years = (to.year() - from.year()) as i64;
    let months = (to.month() as i64) - (from.month() as i64);
    let mut total = years * 12 + months;
    // If we haven't crossed the day-of-month boundary yet, that
    // last calendar month hasn't completed — back it off.
    if to.day() < from.day() {
        total -= 1;
    }
    total.max(0) as u32
}

/// Compute (`accumulated`, `nbv`) for a fixed asset given its
/// depreciation method and the months elapsed since purchase.
///
/// - **SLM**: `(cost - residual) / usefulLifeMonths` per month, capped
///   so accumulated never exceeds `cost - residual`.
/// - **WDV**: declining balance with a per-month rate derived from
///   `usefulLifeMonths` so a 4-year (48-month) life depreciates ~50%
///   in the first year — matches the rate the existing TS UI applies.
///   Floored at the residual value.
/// - **Units**: not implemented at this endpoint (requires meter
///   reading the spec hasn't pinned down). The handler returns a
///   `Validation` error before reaching this function for the
///   `Units` variant; keeping the match exhaustive here in case a
///   future caller wires it up.
fn compute_depreciation(
    method: DepreciationMethod,
    cost: f64,
    residual: f64,
    useful_life_months: u32,
    months: u32,
) -> Result<(f64, f64)> {
    if useful_life_months == 0 {
        return Err(ApiError::Validation(
            "usefulLifeMonths must be > 0 to depreciate".to_owned(),
        ));
    }
    if cost < 0.0 {
        return Err(ApiError::Validation("cost must be >= 0".to_owned()));
    }
    let residual = residual.max(0.0).min(cost);
    let depreciable = (cost - residual).max(0.0);

    let accumulated = match method {
        DepreciationMethod::Slm => {
            let per_month = depreciable / (useful_life_months as f64);
            (per_month * months as f64).min(depreciable)
        }
        DepreciationMethod::Wdv => {
            // Pick a per-month rate so that, over the full useful
            // life, the asset drops to ~`residual` (capped at a
            // reasonable ceiling so the math stays well behaved when
            // residual is zero — the floor below absorbs anything
            // beyond that).
            let safe_residual = if residual <= 0.0 { 1.0_f64 } else { residual };
            let ratio = (safe_residual / cost.max(1.0_f64)).max(1e-6);
            let monthly_rate = 1.0_f64 - ratio.powf(1.0_f64 / (useful_life_months as f64));
            let monthly_rate = monthly_rate.clamp(0.0, 1.0);
            let remaining = cost * (1.0_f64 - monthly_rate).powi(months as i32);
            // Clamp NBV at the residual floor and back-derive
            // accumulated.
            let nbv_floor = residual.max(0.0);
            let nbv = remaining.max(nbv_floor);
            (cost - nbv).max(0.0).min(depreciable)
        }
        DepreciationMethod::Units => {
            return Err(ApiError::Validation(
                "units-of-production depreciation is not supported by this endpoint; \
                 post a meter reading via the (forthcoming) /usage endpoint instead"
                    .to_owned(),
            ));
        }
    };

    let nbv = (cost - accumulated).max(residual);
    Ok((accumulated, nbv))
}

// =========================================================================
// GET / — list_assets
// =========================================================================

/// `GET /v1/crm/fixed-assets` — paginated list scoped to the
/// authenticated user's assets. The `q` query param does a
/// case-insensitive substring search across `code`, `name`, and
/// `location`. The structured filters are exact-match. Sorted by
/// `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_assets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<FixedAsset>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "code": regex.clone() }),
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "location": regex }),
            ]),
        );
    }

    if let Some(raw) = q
        .category
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("category", raw);
    }

    if let Some(raw) = q
        .condition
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let parsed: AssetCondition = parse_enum("condition", raw)?;
        filter.insert("condition", enum_to_str(&parsed)?);
    }

    if let Some(raw) = q
        .depreciation_method
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let parsed: DepreciationMethod = parse_enum("depreciationMethod", raw)?;
        filter.insert("depreciationMethod", enum_to_str(&parsed)?);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<FixedAsset>(FIXED_ASSETS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.find"))
        })?;
    let assets: Vec<FixedAsset> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.collect"))
    })?;

    Ok(Json(assets))
}

// =========================================================================
// GET /:assetId — get_asset
// =========================================================================

/// `GET /v1/crm/fixed-assets/:assetId` — fetch a single asset. Returns
/// 404 if the asset doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, asset_id = %asset_id))]
pub async fn get_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
) -> Result<Json<FixedAsset>> {
    let user_id = user_oid(&user)?;
    let asset_oid = oid_from_str(&asset_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", asset_oid);

    let coll = mongo.collection::<FixedAsset>(FIXED_ASSETS_COLL);
    let asset = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("fixed_asset".to_owned()))?;

    Ok(Json(asset))
}

// =========================================================================
// POST / — create_asset
// =========================================================================

/// `POST /v1/crm/fixed-assets` — insert a new fixed asset.
///
/// Builds a [`FixedAsset`] from the curated [`CreateFixedAssetInput`],
/// stamps `Identity` + `Audit`, persists it, and returns the full
/// document. `accumulatedDepreciation` and `netBookValue` are
/// initialised to `0.0` and `cost` respectively — they're only ever
/// mutated via [`depreciate_asset`].
///
/// **Lineage:** fixed assets are NOT in the §13.5 chain. No
/// `fromKind` / `fromId` handling here.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFixedAssetInput>,
) -> Result<Json<FixedAsset>> {
    if input.code.trim().is_empty() {
        return Err(ApiError::Validation("code is required.".to_owned()));
    }
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if input.depreciation_method.trim().is_empty() {
        return Err(ApiError::Validation(
            "depreciationMethod is required.".to_owned(),
        ));
    }
    if input.useful_life_months == 0 {
        return Err(ApiError::Validation(
            "usefulLifeMonths must be > 0.".to_owned(),
        ));
    }
    if !input.cost.is_finite() || input.cost < 0.0 {
        return Err(ApiError::Validation(
            "cost must be a finite, non-negative number.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Matches the §5.1 / §12.8 fallback used in `crm_leads::create_lead`
        // — single-tenant callers omit projectId and pick up a freshly
        // minted id at insert time.
        None => ObjectId::new(),
    };

    let depreciation_method: DepreciationMethod =
        parse_enum("depreciationMethod", input.depreciation_method.trim())?;

    let condition = match input
        .condition
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => parse_enum::<AssetCondition>("condition", raw)?,
        None => AssetCondition::default(),
    };

    let supplier_id = match input.supplier_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let custodian_employee_id = match input
        .custodian_employee_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let amc_contract_id = match input.amc_contract_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let asset = FixedAsset {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        code: input.code.trim().to_owned(),
        name: input.name.trim().to_owned(),
        category: input.category.clone(),
        purchase_date: input.purchase_date,
        supplier_id,
        cost: input.cost,
        currency: input.currency.trim().to_owned(),
        useful_life_months: input.useful_life_months,
        depreciation_method,
        residual_value: input.residual_value,
        location: input.location.clone(),
        custodian_employee_id,
        condition,
        warranty_until: input.warranty_until,
        insurance_until: input.insurance_until,
        amc_contract_id,
        retire_or_sell: None,
        accumulated_depreciation: 0.0,
        net_book_value: input.cost,
    };

    let coll = mongo.collection::<FixedAsset>(FIXED_ASSETS_COLL);
    coll.insert_one(&asset).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.insert_one"))
    })?;

    Ok(Json(asset))
}

// =========================================================================
// PATCH /:assetId — update_asset
// =========================================================================

/// `PATCH /v1/crm/fixed-assets/:assetId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Server-managed fields
/// (`accumulatedDepreciation`, `netBookValue`) are
/// NOT mutable here — use the `/depreciate` endpoint. Fails with 404
/// if the asset doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, asset_id = %asset_id))]
pub async fn update_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
    Json(input): Json<UpdateFixedAssetInput>,
) -> Result<Json<FixedAsset>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let asset_oid = oid_from_str(&asset_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "code", input.code.as_ref());
    set_opt_str(&mut set, "name", input.name.as_ref());
    set_opt_str(&mut set, "category", input.category.as_ref());
    set_opt_str(&mut set, "currency", input.currency.as_ref());
    set_opt_str(&mut set, "location", input.location.as_ref());

    if let Some(when) = input.purchase_date {
        set.insert("purchaseDate", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.warranty_until {
        set.insert("warrantyUntil", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.insurance_until {
        set.insert("insuranceUntil", bson::DateTime::from_chrono(when));
    }

    if let Some(cost) = input.cost {
        if !cost.is_finite() || cost < 0.0 {
            return Err(ApiError::Validation(
                "cost must be a finite, non-negative number.".to_owned(),
            ));
        }
        set.insert("cost", cost);
    }
    if let Some(rv) = input.residual_value {
        if !rv.is_finite() || rv < 0.0 {
            return Err(ApiError::Validation(
                "residualValue must be a finite, non-negative number.".to_owned(),
            ));
        }
        set.insert("residualValue", rv);
    }
    if let Some(months) = input.useful_life_months {
        if months == 0 {
            return Err(ApiError::Validation(
                "usefulLifeMonths must be > 0.".to_owned(),
            ));
        }
        set.insert("usefulLifeMonths", months as i64);
    }

    if let Some(raw) = input.depreciation_method.as_deref() {
        let parsed: DepreciationMethod = parse_enum("depreciationMethod", raw)?;
        set.insert("depreciationMethod", enum_to_str(&parsed)?);
    }
    if let Some(raw) = input.condition.as_deref() {
        let parsed: AssetCondition = parse_enum("condition", raw)?;
        set.insert("condition", enum_to_str(&parsed)?);
    }

    set_opt_oid(&mut set, "supplierId", input.supplier_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "custodianEmployeeId",
        input.custodian_employee_id.as_ref(),
    )?;
    set_opt_oid(&mut set, "amcContractId", input.amc_contract_id.as_ref())?;

    if let Some(entry) = &input.retire_or_sell {
        let mut doc = doc! {
            "at": bson::DateTime::from_chrono(entry.at),
            "mode": &entry.mode,
        };
        if let Some(sale_amount) = entry.sale_amount {
            doc.insert("saleAmount", sale_amount);
        }
        if let Some(buyer) = &entry.buyer {
            doc.insert("buyer", buyer);
        }
        if let Some(note) = &entry.note {
            doc.insert("note", note);
        }
        set.insert("retireOrSell", doc);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", asset_oid);

    let coll = mongo.collection::<Document>(FIXED_ASSETS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("fixed_asset".to_owned()));
    }

    let typed = mongo.collection::<FixedAsset>(FIXED_ASSETS_COLL);
    let asset = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_fixed_assets.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("fixed_asset".to_owned()))?;

    Ok(Json(asset))
}

// =========================================================================
// DELETE /:assetId — delete_asset (hard)
// =========================================================================

/// `DELETE /v1/crm/fixed-assets/:assetId` — **hard delete**. Per the
/// CRM ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities
/// use hard deletes — the row is removed from the collection. Fails
/// with 404 if the asset doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, asset_id = %asset_id))]
pub async fn delete_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let asset_oid = oid_from_str(&asset_id)?;

    let filter = doc! { "_id": asset_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(FIXED_ASSETS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("fixed_asset".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// POST /:assetId/depreciate — depreciate_asset
// =========================================================================

/// `POST /v1/crm/fixed-assets/:assetId/depreciate` — recompute the
/// running depreciation totals for an asset.
///
/// Reads the asset's `depreciationMethod`, `cost`, `residualValue`,
/// `usefulLifeMonths`, and `purchaseDate`; computes the months
/// elapsed since acquisition; and writes back the resulting
/// `accumulatedDepreciation` and `netBookValue`. The two computed
/// fields are server-managed and the only legitimate way for clients
/// to mutate them is via this endpoint.
///
/// SLM and WDV are supported; `Units` returns a `Validation` error
/// pointing the caller at the (forthcoming) usage-posting endpoint.
#[instrument(skip_all, fields(user_id = %user.user_id, asset_id = %asset_id))]
pub async fn depreciate_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
) -> Result<Json<FixedAsset>> {
    let user_id = user_oid(&user)?;
    let asset_oid = oid_from_str(&asset_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", asset_oid);

    let typed = mongo.collection::<FixedAsset>(FIXED_ASSETS_COLL);
    let asset = typed
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_fixed_assets.find_one(pre-depreciate)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("fixed_asset".to_owned()))?;

    let now = Utc::now();
    let months = months_elapsed(asset.purchase_date, now);
    let residual = asset.residual_value.unwrap_or(0.0);
    let (accumulated, nbv) = compute_depreciation(
        asset.depreciation_method,
        asset.cost,
        residual,
        asset.useful_life_months,
        months,
    )?;

    let bson_now = bson::DateTime::from_chrono(now);
    let update = doc! {
        "$set": {
            "accumulatedDepreciation": accumulated,
            "netBookValue": nbv,
            "updatedAt": bson_now,
            "updatedBy": user_id,
        },
    };

    let coll = mongo.collection::<Document>(FIXED_ASSETS_COLL);
    let res = coll.update_one(filter.clone(), update).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_fixed_assets.depreciate_update"))
    })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("fixed_asset".to_owned()));
    }

    let after = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_fixed_assets.find_one(post-depreciate)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("fixed_asset".to_owned()))?;

    Ok(Json(after))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn clamp_limit_uses_default_when_absent() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }

    #[test]
    fn clamp_limit_caps_at_max() {
        assert_eq!(clamp_limit(Some(500)), MAX_LIMIT);
    }

    #[test]
    fn clamp_limit_floors_at_one() {
        assert_eq!(clamp_limit(Some(0)), 1);
    }

    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "code", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "LAP-1".to_owned();
        set_opt_str(&mut d, "code", Some(&v));
        assert_eq!(d.get_str("code").unwrap(), "LAP-1");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "supplierId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parse_enum_accepts_valid_method() {
        let m: DepreciationMethod = parse_enum("depreciationMethod", "wdv").unwrap();
        assert!(matches!(m, DepreciationMethod::Wdv));
    }

    #[test]
    fn parse_enum_accepts_valid_condition() {
        let c: AssetCondition = parse_enum("condition", "good").unwrap();
        assert!(matches!(c, AssetCondition::Good));
    }

    #[test]
    fn parse_enum_rejects_garbage_with_validation() {
        let err = parse_enum::<DepreciationMethod>("depreciationMethod", "BANANAS").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn enum_to_str_round_trips() {
        assert_eq!(enum_to_str(&DepreciationMethod::Slm).unwrap(), "slm");
        assert_eq!(enum_to_str(&DepreciationMethod::Wdv).unwrap(), "wdv");
        assert_eq!(enum_to_str(&AssetCondition::Retired).unwrap(), "retired");
    }

    #[test]
    fn months_elapsed_floors_at_zero_for_future_purchase() {
        let now = Utc::now();
        let future = now + chrono::Duration::days(60);
        assert_eq!(months_elapsed(future, now), 0);
    }

    #[test]
    fn months_elapsed_counts_calendar_months() {
        let from = Utc.with_ymd_and_hms(2026, 1, 15, 0, 0, 0).unwrap();
        let to = Utc.with_ymd_and_hms(2026, 7, 15, 0, 0, 0).unwrap();
        assert_eq!(months_elapsed(from, to), 6);
        // Same calendar month, day not yet reached -> still 5.
        let to_partial = Utc.with_ymd_and_hms(2026, 7, 14, 0, 0, 0).unwrap();
        assert_eq!(months_elapsed(from, to_partial), 5);
    }

    #[test]
    fn slm_linear_month_by_month() {
        // Cost 12_000, residual 0, life 12mo => 1_000/mo.
        let (acc, nbv) =
            compute_depreciation(DepreciationMethod::Slm, 12_000.0, 0.0, 12, 5).unwrap();
        assert!((acc - 5_000.0).abs() < 1e-6);
        assert!((nbv - 7_000.0).abs() < 1e-6);
    }

    #[test]
    fn slm_caps_at_depreciable_amount() {
        // After useful life is exhausted, accumulated stops at
        // (cost - residual) and NBV pins at residual.
        let (acc, nbv) =
            compute_depreciation(DepreciationMethod::Slm, 10_000.0, 1_000.0, 12, 24).unwrap();
        assert!((acc - 9_000.0).abs() < 1e-6);
        assert!((nbv - 1_000.0).abs() < 1e-6);
    }

    #[test]
    fn wdv_declines_and_floors_at_residual() {
        let (acc, nbv) =
            compute_depreciation(DepreciationMethod::Wdv, 100_000.0, 10_000.0, 48, 0).unwrap();
        assert!(acc < 1e-6);
        assert!((nbv - 100_000.0).abs() < 1e-6);

        let (_, nbv_after) =
            compute_depreciation(DepreciationMethod::Wdv, 100_000.0, 10_000.0, 48, 48).unwrap();
        // Should land at-or-near residual (10k) at full life.
        assert!(nbv_after >= 10_000.0 - 1e-3);
        assert!(nbv_after <= 10_000.0 + 1e-3);

        // Far past useful life floors at residual.
        let (acc_far, nbv_far) =
            compute_depreciation(DepreciationMethod::Wdv, 100_000.0, 10_000.0, 48, 240).unwrap();
        assert!((nbv_far - 10_000.0).abs() < 1e-3);
        assert!((acc_far - 90_000.0).abs() < 1e-3);
    }

    #[test]
    fn units_method_is_rejected() {
        let err = compute_depreciation(DepreciationMethod::Units, 1_000.0, 0.0, 12, 6).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn zero_useful_life_is_rejected() {
        let err = compute_depreciation(DepreciationMethod::Slm, 1_000.0, 0.0, 0, 6).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }
}
