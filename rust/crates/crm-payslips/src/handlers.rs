//! HTTP handlers for the Payslip entity.
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/payslips` (legacy) — `userId == AuthUser.user_id`.
//!   Unchanged behaviour.
//! - `/v1/sabcrm/people/payslips` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! ## Dual shape (people-suite WI-9 / risk R7)
//!
//! `crm_payslips` holds TWO document shapes:
//!
//! - the legacy FLAT [`CrmPayslip`] written by this crate's CRUD
//!   (`basic/hra/allowances/deductions/gross/net`, status
//!   `draft|issued|paid|archived`), and
//! - the rich, render-ready [`hrm_payroll_types::Payslip`] written by
//!   `crm-payroll-runs::generate_payslips` (header, employee snapshot,
//!   earning/deduction tables, `netPayInWords`, …).
//!
//! List/get therefore read raw `Document`s and branch on the presence
//! of `runId` (only the rich shape carries it), returning the
//! [`UnifiedPayslip`] untagged union. Rich payslips are **read-only**
//! through this surface — `PATCH`/`DELETE` reject them with a 409; the
//! only legal mutation is [`mark_payslip_sent`].

use axum::{
    Extension, Json,
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
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::Payslip as RichPayslip;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePayslipInput, CreatePayslipResponse, DeletePayslipResponse, ListQuery, ScopeQuery,
    UpdatePayslipInput,
};
use crate::types::CrmPayslip;

const COLL: &str = "crm_payslips";
const ENTITY_KIND: &str = "payslip";

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`]:
///
/// - `ScopeMode::User` (legacy `/v1/crm/payslips`) — scope by the
///   verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/payslips`) — scope by the
///   caller-supplied `projectId`, 4xx when absent/invalid.
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

/// One payslip row in either of the collection's two shapes
/// (people-suite WI-9 "unified DTO"). Serialized untagged, so the wire
/// form is exactly the underlying document — TS callers branch on the
/// presence of `runId` (rich) vs `payPeriod` + `basic` (flat).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(untagged)]
pub enum UnifiedPayslip {
    /// Rich render-ready snapshot written by
    /// `crm-payroll-runs::generate_payslips` (carries `runId`).
    Rich(Box<RichPayslip>),
    /// Legacy flat record written by this crate's CRUD.
    Flat(Box<CrmPayslip>),
}

/// Decode one raw `crm_payslips` document into [`UnifiedPayslip`],
/// branching on the presence of `runId` (rich shape only). Returns
/// `None` (with a warning) when the document matches neither shape so
/// one malformed row can never 500 a list (risk R7).
fn decode_unified(raw: Document) -> Option<UnifiedPayslip> {
    let is_rich = raw.get("runId").is_some();
    let id_for_log = raw.get_object_id("_id").ok();
    if is_rich {
        match bson::from_document::<RichPayslip>(raw) {
            Ok(p) => Some(UnifiedPayslip::Rich(Box::new(p))),
            Err(e) => {
                tracing::warn!(
                    payslip_id = ?id_for_log,
                    error = %e,
                    "payslip carries runId but fails rich-shape decode; skipping",
                );
                None
            }
        }
    } else {
        match bson::from_document::<CrmPayslip>(raw) {
            Ok(p) => Some(UnifiedPayslip::Flat(Box::new(p))),
            Err(e) => {
                tracing::warn!(
                    payslip_id = ?id_for_log,
                    error = %e,
                    "payslip fails flat-shape decode; skipping",
                );
                None
            }
        }
    }
}

fn list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    employee_id: Option<&str>,
    run_id: Option<&str>,
    pay_period: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
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
    if let Some(rid) = run_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("runId", rid);
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

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn payslip_from_create(
    input: CreatePayslipInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmPayslip> {
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
        project_id,
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

/// Load one raw payslip document under the scope's ownership filter,
/// 404 when absent.
async fn load_raw(
    mongo: &MongoHandle,
    scope: &TenantScope,
    oid: ObjectId,
    ctx: &'static str,
) -> Result<Document> {
    let coll = mongo.collection::<Document>(COLL);
    coll.find_one(ownership_filter(scope, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))?
        .ok_or_else(|| ApiError::NotFound("payslip".to_owned()))
}

/// 409 when `raw` is a rich (run-generated) payslip — those are frozen
/// snapshots and read-only through this CRUD surface (WI-9).
fn reject_rich(raw: &Document, verb: &str) -> Result<()> {
    if raw.get("runId").is_some() {
        return Err(ApiError::Conflict(format!(
            "this payslip was generated from a payroll run and is read-only — cannot {verb} it \
             (use the payroll-run surface instead)",
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<UnifiedPayslip>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_payslips(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(
        &scope,
        q.status.as_deref(),
        q.employee_id.as_deref(),
        q.run_id.as_deref(),
        q.pay_period.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // Cover both shapes: flat `employeeName`/`status`, rich
        // `employeeSnapshot.name` / `header.periodLabel`.
        let or = build_q_filter(
            needle,
            &[
                "employeeName",
                "status",
                "employeeSnapshot.name",
                "header.periodLabel",
            ],
        );
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
    let coll = mongo.collection::<Document>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.find")))?;
    let mut raws: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.collect")))?;
    let has_more = raws.len() as i64 > limit;
    if has_more {
        raws.truncate(limit as usize);
    }
    let rows: Vec<UnifiedPayslip> = raws.into_iter().filter_map(decode_unified).collect();
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<UnifiedPayslip>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&payslip_id)?;
    let raw = load_raw(&mongo, &scope, oid, "crm_payslips.find_one").await?;
    let unified = decode_unified(raw)
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("payslip matches neither shape")))?;
    Ok(Json(unified))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_payslip(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePayslipInput>,
) -> Result<Json<CreatePayslipResponse>> {
    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent). In legacy user mode the
    // scope is the JWT subject and the body `projectId` stays optional
    // (behaviour freeze). The stamped `userId` is always
    // `AuthUser.user_id` (auditing).
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => Some(p),
        TenantScope::User(_) => input
            .project_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| ObjectId::parse_str(s).ok()),
    };
    let mut entity = payslip_from_create(input, user_id, project_id)?;
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdatePayslipInput>,
) -> Result<Json<CrmPayslip>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&payslip_id)?;
    let raw = load_raw(&mongo, &scope, oid, "crm_payslips.find_one").await?;
    reject_rich(&raw, "PATCH")?;
    let before: CrmPayslip = bson::from_document(raw)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.decode")))?;
    let update = build_update_doc(patch)?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payslip".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeletePayslipResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&payslip_id)?;
    let raw = load_raw(&mongo, &scope, oid, "crm_payslips.find_one").await?;
    reject_rich(&raw, "DELETE")?;
    let coll = mongo.collection::<CrmPayslip>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
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

/// `POST /{payslipId}/mark-sent` (people-suite WI-9) — record that the
/// payslip was delivered to the employee.
///
/// - **Rich** (run-generated) payslips set `sent = true` + `sentAt`
///   (the model's delivery flags).
/// - **Flat** payslips have no `sent` field; the closest legal
///   transition is `status -> "issued"` + `issuedAt` (no-op when
///   already issued/paid).
///
/// Returns the updated document in the unified shape.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %payslip_id))]
pub async fn mark_payslip_sent(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(payslip_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<UnifiedPayslip>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&payslip_id)?;
    let raw = load_raw(&mongo, &scope, oid, "crm_payslips.find_one(mark-sent)").await?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let update = if raw.get("runId").is_some() {
        doc! { "$set": {
            "sent": true,
            "sentAt": now,
            "updatedAt": now,
            "updatedBy": user_id,
        }}
    } else {
        let mut set = doc! { "updatedAt": now };
        // Only move draft forward; issued/paid stay as they are.
        if raw.get_str("status").unwrap_or("draft") == "draft" {
            set.insert("status", "issued");
        }
        if raw.get("issuedAt").is_none() {
            set.insert("issuedAt", now);
        }
        doc! { "$set": set }
    };
    let coll = mongo.collection::<Document>(COLL);
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.mark_sent")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payslip".to_owned()));
    }
    let after = load_raw(&mongo, &scope, oid, "crm_payslips.refetch(mark-sent)").await?;
    let unified = decode_unified(after)
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("payslip matches neither shape")))?;
    Ok(Json(unified))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(&TenantScope::User(oid), None, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_applies_run_filter() {
        let project = ObjectId::new();
        let run = ObjectId::new();
        let f = list_filter(
            &TenantScope::Project(project),
            None,
            None,
            Some(&run.to_hex()),
            None,
        );
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert_eq!(f.get_object_id("runId").unwrap(), run);
        assert!(!f.contains_key("userId"));
    }

    #[test]
    fn payslip_from_create_defaults_status_to_draft() {
        let user_id = ObjectId::new();
        let input = CreatePayslipInput {
            project_id: None,
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
        let p = payslip_from_create(input, user_id, None).unwrap();
        assert_eq!(p.status, "draft");
        assert_eq!(p.basic, 50000.0);
        assert_eq!(p.net, 69000.0);
        assert!(p.project_id.is_none());
    }

    #[test]
    fn payslip_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let input = CreatePayslipInput {
            employee_id: ObjectId::new().to_hex(),
            pay_period: "2026-05-01T00:00:00Z".into(),
            basic: 0.0,
            hra: 0.0,
            deductions: 0.0,
            gross: 0.0,
            net: 0.0,
            ..Default::default()
        };
        let p = payslip_from_create(input, user_id, Some(project_id)).unwrap();
        assert_eq!(p.project_id, Some(project_id));
        // `projectId` lands camelCase on the wire/document.
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["projectId"]["$oid"], project_id.to_hex());
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
        assert!(payslip_from_create(input, user_id, None).is_err());
    }

    #[test]
    fn decode_unified_branches_on_run_id() {
        // Flat doc (no runId) decodes as Flat.
        let flat = doc! {
            "_id": ObjectId::new(),
            "userId": ObjectId::new(),
            "employeeId": ObjectId::new(),
            "payPeriod": BsonDateTime::from_chrono(Utc::now()),
            "basic": 50_000.0,
            "hra": 20_000.0,
            "deductions": 6_000.0,
            "gross": 75_000.0,
            "net": 69_000.0,
            "status": "draft",
            "createdAt": BsonDateTime::from_chrono(Utc::now()),
        };
        assert!(matches!(
            decode_unified(flat),
            Some(UnifiedPayslip::Flat(_))
        ));

        // A doc with runId but missing the rich required fields is
        // skipped (None), never a 500.
        let broken_rich = doc! {
            "_id": ObjectId::new(),
            "userId": ObjectId::new(),
            "runId": ObjectId::new(),
        };
        assert!(decode_unified(broken_rich).is_none());
    }

    #[test]
    fn reject_rich_blocks_run_generated_docs() {
        let rich = doc! { "runId": ObjectId::new() };
        assert!(matches!(
            reject_rich(&rich, "PATCH").unwrap_err(),
            ApiError::Conflict(_)
        ));
        let flat = doc! { "basic": 1.0 };
        assert!(reject_rich(&flat, "PATCH").is_ok());
    }

    /// Test-only [`AuthUser`] with a valid 24-hex subject.
    fn fake_user(oid: &ObjectId) -> AuthUser {
        AuthUser {
            user_id: oid.to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        }
    }

    #[test]
    fn resolve_scope_project_rejects_missing_project_id() {
        // The `project_router` mount attaches `ScopeMode::Project`; a
        // request without `projectId` must 4xx (mirrors the
        // `crm-core::scope` tests).
        let user = fake_user(&ObjectId::new());
        assert!(matches!(
            resolve_scope(ScopeMode::Project, &user, None).unwrap_err(),
            ApiError::Validation(_)
        ));
        assert!(matches!(
            resolve_scope(ScopeMode::Project, &user, Some("not-an-oid")).unwrap_err(),
            ApiError::Validation(_)
        ));
    }

    #[test]
    fn resolve_scope_resolves_both_modes() {
        let user_oid = ObjectId::new();
        let user = fake_user(&user_oid);
        assert_eq!(
            resolve_scope(ScopeMode::User, &user, None).unwrap(),
            TenantScope::User(user_oid)
        );
        let project = ObjectId::new();
        assert_eq!(
            resolve_scope(ScopeMode::Project, &user, Some(&project.to_hex())).unwrap(),
            TenantScope::Project(project)
        );
    }
}
