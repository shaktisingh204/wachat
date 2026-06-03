//! HTTP handlers for the PayrollSetting entity.

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
    CreateSettingInput, CreateSettingResponse, DeleteSettingResponse, ListQuery, UpdateSettingInput,
};
use crate::types::CrmPayrollSetting;

const COLL: &str = "crm_payroll_settings";
const ENTITY_KIND: &str = "payroll_setting";

const DEFAULT_PAY_CYCLE: &str = "monthly";
const DEFAULT_CURRENCY: &str = "INR";

fn normalise_pay_cycle(s: &str) -> Option<String> {
    let t = s.trim().to_ascii_lowercase();
    match t.as_str() {
        "monthly" | "weekly" | "biweekly" => Some(t),
        _ => None,
    }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, pay_cycle: Option<&str>) -> Document {
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
    if let Some(c) = pay_cycle
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(normalise_pay_cycle)
    {
        filter.insert("payCycle", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn setting_from_create(input: CreateSettingInput, user_id: ObjectId) -> Result<CrmPayrollSetting> {
    let pay_cycle = input
        .pay_cycle
        .as_deref()
        .and_then(normalise_pay_cycle)
        .unwrap_or_else(|| DEFAULT_PAY_CYCLE.to_owned());

    Ok(CrmPayrollSetting {
        id: None,
        user_id,
        company_name: input
            .company_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        pf_rate: input.pf_rate,
        esi_rate: input.esi_rate,
        pay_cycle,
        tax_slabs: input.tax_slabs.unwrap_or_default(),
        default_currency: input
            .default_currency
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .or_else(|| Some(DEFAULT_CURRENCY.to_owned())),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSettingInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.company_name {
        set.insert("companyName", v);
    }
    if let Some(v) = patch.pf_rate {
        set.insert("pfRate", v);
    }
    if let Some(v) = patch.esi_rate {
        set.insert("esiRate", v);
    }
    if let Some(raw) = patch.pay_cycle {
        let Some(v) = normalise_pay_cycle(&raw) else {
            return Err(ApiError::Validation(
                "payCycle must be monthly | weekly | biweekly".to_owned(),
            ));
        };
        set.insert("payCycle", v);
    }
    if let Some(v) = patch.tax_slabs {
        set.insert("taxSlabs", v);
    }
    if let Some(v) = patch.default_currency {
        set.insert("defaultCurrency", v);
    }
    if let Some(v) = patch.status {
        let t = v.trim().to_ascii_lowercase();
        if t != "active" && t != "archived" {
            return Err(ApiError::Validation(
                "status must be active | archived".to_owned(),
            ));
        }
        set.insert("status", t);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmPayrollSetting) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPayrollSetting>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_settings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.pay_cycle.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["companyName", "defaultCurrency"]);
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
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.find"))
    })?;
    let mut rows: Vec<CrmPayrollSetting> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn get_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
) -> Result<Json<CrmPayrollSetting>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payroll_setting".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSettingInput>,
) -> Result<Json<CreateSettingResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = setting_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.insert"))
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
    Ok(Json(CreateSettingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn update_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
    Json(patch): Json<UpdateSettingInput>,
) -> Result<Json<CrmPayrollSetting>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payroll_setting".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payroll_setting".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("payroll_setting".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn delete_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
) -> Result<Json<DeleteSettingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payroll_setting".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSettingResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        // Default is the "active_visible" branch which excludes archived
        let status = f.get_document("status").unwrap();
        assert!(status.contains_key("$ne"));
    }

    #[test]
    fn setting_from_create_applies_defaults() {
        let user_id = ObjectId::new();
        let input = CreateSettingInput {
            company_name: Some("Acme Pvt Ltd".into()),
            ..Default::default()
        };
        let s = setting_from_create(input, user_id).unwrap();
        assert_eq!(s.pay_cycle, "monthly");
        assert_eq!(s.status, "active");
        assert_eq!(s.default_currency.as_deref(), Some("INR"));
        assert!(s.tax_slabs.is_empty());
    }

    #[test]
    fn build_update_doc_rejects_invalid_pay_cycle() {
        let patch = UpdateSettingInput {
            pay_cycle: Some("annually".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }
}
