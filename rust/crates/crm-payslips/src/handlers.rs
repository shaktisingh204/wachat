//! HTTP handlers for the Payslip entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreatePayslipInput, CreatePayslipResponse, DeletePayslipResponse, ListQuery, UpdatePayslipInput,
};
use crate::types::CrmPayslip;

const COLL: &str = "crm_payslips";
const ENTITY_KIND: &str = "payslip";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    employee_id: Option<&str>,
    pay_period: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "issued" | "paid" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(eid) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", eid);
    }
    if let Some(period) = pay_period
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(parse_date)
    {
        filter.insert("payPeriod", period);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn payslip_from_create(input: CreatePayslipInput, user_id: ObjectId) -> Result<CrmPayslip> {
    let employee_id = ObjectId::parse_str(input.employee_id.trim())
        .map_err(|_| ApiError::Validation("employeeId must be a valid ObjectId".to_owned()))?;
    let pay_period = parse_date(&input.pay_period)
        .ok_or_else(|| ApiError::Validation("payPeriod must be RFC3339".to_owned()))?;
    let status = match input.status.as_deref() {
        Some(s @ ("draft" | "issued" | "paid" | "archived")) => s.to_owned(),
        Some(_) => {
            return Err(ApiError::Validation(
                "status must be draft|issued|paid|archived".to_owned(),
            ));
        }
        None => "draft".to_owned(),
    };
    Ok(CrmPayslip {
        id: None,
        user_id,
        employee_id,
        employee_name: input
            .employee_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        pay_period,
        basic: input.basic,
        hra: input.hra,
        allowances: input.allowances,
        deductions: input.deductions,
        pf: input.pf,
        esi: input.esi,
        tax: input.tax,
        gross: input.gross,
        net: input.net,
        status,
        issued_at: input.issued_at.as_deref().and_then(parse_date),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePayslipInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(eid_str) = patch.employee_id.as_deref().map(str::trim) {
        if !eid_str.is_empty() {
            let eid = ObjectId::parse_str(eid_str).map_err(|_| {
                ApiError::Validation("employeeId must be a valid ObjectId".to_owned())
            })?;
            set.insert("employeeId", eid);
        }
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.pay_period.as_deref().and_then(parse_date) {
        set.insert("payPeriod", v);
    }
    if let Some(v) = patch.basic {
        set.insert("basic", v);
    }
    if let Some(v) = patch.hra {
        set.insert("hra", v);
    }
    if let Some(v) = patch.allowances {
        set.insert("allowances", v);
    }
    if let Some(v) = patch.deductions {
        set.insert("deductions", v);
    }
    if let Some(v) = patch.pf {
        set.insert("pf", v);
    }
    if let Some(v) = patch.esi {
        set.insert("esi", v);
    }
    if let Some(v) = patch.tax {
        set.insert("tax", v);
    }
    if let Some(v) = patch.gross {
        set.insert("gross", v);
    }
    if let Some(v) = patch.net {
        set.insert("net", v);
    }
    if let Some(v) = patch.status {
        match v.as_str() {
            "draft" | "issued" | "paid" | "archived" => {
                set.insert("status", v);
            }
            _ => {
                return Err(ApiError::Validation(
                    "status must be draft|issued|paid|archived".to_owned(),
                ));
            }
        }
    }
    if let Some(v) = patch.issued_at.as_deref().and_then(parse_date) {
        set.insert("issuedAt", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmPayslip) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPayslip>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_payslips(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.employee_id.as_deref(),
        q.pay_period.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "status"]);
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
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.find")))?;
    let mut rows: Vec<CrmPayslip> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %payslip_id))]
pub async fn get_payslip(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
) -> Result<Json<CrmPayslip>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&payslip_id)?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.find_one")))?
        .ok_or_else(|| ApiError::NotFound("payslip".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_payslip(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePayslipInput>,
) -> Result<Json<CreatePayslipResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = payslip_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreatePayslipResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %payslip_id))]
pub async fn update_payslip(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
    Json(patch): Json<UpdatePayslipInput>,
) -> Result<Json<CrmPayslip>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&payslip_id)?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.find_one")))?
        .ok_or_else(|| ApiError::NotFound("payslip".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payslip".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.refetch")))?
        .ok_or_else(|| ApiError::NotFound("payslip".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %payslip_id))]
pub async fn delete_payslip(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
) -> Result<Json<DeletePayslipResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&payslip_id)?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payslip".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePayslipResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn payslip_from_create_defaults_status_to_draft() {
        let user_id = ObjectId::new();
        let input = CreatePayslipInput {
            employee_id: ObjectId::new().to_hex(),
            employee_name: Some("Jane".into()),
            pay_period: "2026-05-01T00:00:00Z".into(),
            basic: 50000.0,
            hra: 20000.0,
            allowances: Some(5000.0),
            deductions: 6000.0,
            pf: Some(3600.0),
            esi: None,
            tax: Some(2400.0),
            gross: 75000.0,
            net: 69000.0,
            status: None,
            issued_at: None,
        };
        let p = payslip_from_create(input, user_id).unwrap();
        assert_eq!(p.status, "draft");
        assert_eq!(p.basic, 50000.0);
        assert_eq!(p.net, 69000.0);
    }

    #[test]
    fn payslip_from_create_rejects_invalid_employee_id() {
        let user_id = ObjectId::new();
        let input = CreatePayslipInput {
            employee_id: "not-an-oid".into(),
            pay_period: "2026-05-01T00:00:00Z".into(),
            basic: 0.0,
            hra: 0.0,
            deductions: 0.0,
            gross: 0.0,
            net: 0.0,
            ..Default::default()
        };
        assert!(payslip_from_create(input, user_id).is_err());
    }
}
