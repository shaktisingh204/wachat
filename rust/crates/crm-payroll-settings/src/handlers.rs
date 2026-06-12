//! HTTP handlers for the PayrollSetting entity.
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/crm/payroll-settings` (legacy) — `userId == AuthUser.user_id`.
//!   Unchanged behaviour.
//! - `/v1/sabcrm/people/payroll-settings` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust.
//!
//! Payroll settings are **singleton-per-scope** (people-suite WI-14):
//! the project mount exposes `GET /` → the scope's single document
//! ([`get_singleton_setting`]) and `PUT /` → upsert
//! ([`upsert_setting`]). The legacy mount keeps its historical
//! list/create surface (behaviour freeze) and additionally accepts the
//! `PUT /` upsert.

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
use mongodb::options::{FindOneOptions, FindOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSettingInput, CreateSettingResponse, DeleteSettingResponse, ListQuery, ScopeQuery,
    UpdateSettingInput, UpsertSettingInput,
};
use crate::types::CrmPayrollSetting;

const COLL: &str = "crm_payroll_settings";
const ENTITY_KIND: &str = "payroll_setting";

const DEFAULT_PAY_CYCLE: &str = "monthly";
const DEFAULT_CURRENCY: &str = "INR";

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`]:
///
/// - `ScopeMode::User` (legacy `/v1/crm/payroll-settings`) — scope by
///   the verified JWT subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/payroll-settings`) —
///   scope by the caller-supplied `projectId`, 4xx when absent/invalid.
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

fn normalise_pay_cycle(s: &str) -> Option<String> {
    let t = s.trim().to_ascii_lowercase();
    match t.as_str() {
        "monthly" | "weekly" | "biweekly" => Some(t),
        _ => None,
    }
}

fn list_filter(scope: &TenantScope, status: Option<&str>, pay_cycle: Option<&str>) -> Document {
    let mut filter = scope.filter();
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

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

fn setting_from_create(
    input: CreateSettingInput,
    user_id: ObjectId,
    project_id: Option<ObjectId>,
) -> Result<CrmPayrollSetting> {
    let pay_cycle = input
        .pay_cycle
        .as_deref()
        .and_then(normalise_pay_cycle)
        .unwrap_or_else(|| DEFAULT_PAY_CYCLE.to_owned());

    Ok(CrmPayrollSetting {
        id: None,
        user_id,
        project_id,
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = list_filter(&scope, q.status.as_deref(), q.pay_cycle.as_deref());
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

/// `GET /` on the project mount — return the scope's single
/// (non-archived) settings document, or JSON `null` when the scope has
/// never saved settings (people-suite WI-14 singleton semantics).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_singleton_setting(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<Option<CrmPayrollSetting>>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let mut filter = scope.filter();
    filter.insert("status", doc! { "$ne": "archived" });
    let opts = FindOneOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let row = coll.find_one(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_payroll_settings.find_one(singleton)"),
        )
    })?;
    Ok(Json(row))
}

/// `PUT /` — singleton-per-scope upsert (people-suite WI-14). The
/// upsert key is the scope filter itself (`{userId}` on the legacy
/// mount, `{projectId}` on the project mount), so each scope can only
/// ever hold one settings document through this endpoint. Only the
/// fields explicitly sent are written; `createdAt`/`userId` (and
/// `projectId` under Project scope) are stamped on first insert.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_setting(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpsertSettingInput>,
) -> Result<Json<CrmPayrollSetting>> {
    // Project mode requires `projectId` — accepted on the body or the
    // query string (the body wins when both are present).
    let scope = resolve_scope(
        mode,
        &user,
        input
            .project_id
            .as_deref()
            .or(scope_q.project_id.as_deref()),
    )?;
    let user_id = user_oid(&user)?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = input
        .company_name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("companyName", v);
    }
    if let Some(v) = input.pf_rate {
        set.insert("pfRate", v);
    }
    if let Some(v) = input.esi_rate {
        set.insert("esiRate", v);
    }
    if let Some(raw) = input.pay_cycle {
        let Some(v) = normalise_pay_cycle(&raw) else {
            return Err(ApiError::Validation(
                "payCycle must be monthly | weekly | biweekly".to_owned(),
            ));
        };
        set.insert("payCycle", v);
    }
    if let Some(v) = input.tax_slabs {
        set.insert("taxSlabs", v);
    }
    if let Some(v) = input
        .default_currency
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("defaultCurrency", v);
    }
    let status_provided = if let Some(v) = input.status {
        let t = v.trim().to_ascii_lowercase();
        if t != "active" && t != "archived" {
            return Err(ApiError::Validation(
                "status must be active | archived".to_owned(),
            ));
        }
        set.insert("status", t);
        true
    } else {
        false
    };

    // First-insert defaults. A field may not appear in both `$set` and
    // `$setOnInsert`, so each default is added only when the upsert's
    // `$set` doesn't already write it.
    let mut set_on_insert = doc! {
        "createdAt": BsonDateTime::from_chrono(Utc::now()),
        // The stamped `userId` is always `AuthUser.user_id` (auditing);
        // under User scope it equals the filter key and is harmless.
        "userId": user_id,
    };
    if !set.contains_key("payCycle") {
        set_on_insert.insert("payCycle", DEFAULT_PAY_CYCLE);
    }
    if !set.contains_key("defaultCurrency") {
        set_on_insert.insert("defaultCurrency", DEFAULT_CURRENCY);
    }
    if !set.contains_key("taxSlabs") {
        set_on_insert.insert("taxSlabs", bson::Bson::Array(Vec::new()));
    }
    if !status_provided {
        set_on_insert.insert("status", "active");
    }
    if let TenantScope::User(_) = scope {
        // Under Project scope `projectId` is the filter key itself; the
        // upsert materialises it from the filter. Under User scope an
        // optional body `projectId` is still honoured on first insert
        // (behaviour parity with create).
        if let Some(p) = input
            .project_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| ObjectId::parse_str(s).ok())
        {
            set_on_insert.insert("projectId", p);
        }
    }

    let filter = scope.filter();
    let coll = mongo.collection::<Document>(COLL);
    let res = coll
        .update_one(
            filter.clone(),
            doc! { "$set": set, "$setOnInsert": set_on_insert },
        )
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.upsert"))
        })?;

    let typed = mongo.collection::<CrmPayrollSetting>(COLL);
    let entity = typed
        .find_one(filter)
        .with_options(
            FindOneOptions::builder()
                .sort(doc! { "createdAt": -1 })
                .build(),
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_settings.find_one(after-upsert)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payroll_setting".to_owned()))?;

    if let (Some(upserted), Some(id)) = (res.upserted_id.as_ref(), entity.id) {
        if upserted.as_object_id() == Some(id) {
            if let Some(event) =
                audit_for_create(&user, ENTITY_KIND, id, Some(doc_for_audit(&entity)))
            {
                write_audit(&mongo, event).await;
            }
        }
    }
    Ok(Json(entity))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn get_setting(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<CrmPayrollSetting>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSettingInput>,
) -> Result<Json<CreateSettingResponse>> {
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
    let mut entity = setting_from_create(input, user_id, project_id)?;
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateSettingInput>,
) -> Result<Json<CrmPayrollSetting>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payroll_setting".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(&scope, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("payroll_setting".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(&scope, oid))
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
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteSettingResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmPayrollSetting>(COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
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
        let f = list_filter(&TenantScope::User(oid), None, None);
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
        let s = setting_from_create(input, user_id, None).unwrap();
        assert_eq!(s.pay_cycle, "monthly");
        assert_eq!(s.status, "active");
        assert_eq!(s.default_currency.as_deref(), Some("INR"));
        assert!(s.tax_slabs.is_empty());
        assert!(s.project_id.is_none());
    }

    #[test]
    fn setting_from_create_stamps_project_scope() {
        let user_id = ObjectId::new();
        let project_id = ObjectId::new();
        let s =
            setting_from_create(CreateSettingInput::default(), user_id, Some(project_id)).unwrap();
        assert_eq!(s.project_id, Some(project_id));
        // `projectId` lands camelCase on the wire/document.
        let json = serde_json::to_value(&s).unwrap();
        assert_eq!(json["projectId"]["$oid"], project_id.to_hex());
    }

    #[test]
    fn build_update_doc_rejects_invalid_pay_cycle() {
        let patch = UpdateSettingInput {
            pay_cycle: Some("annually".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
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
            resolve_scope(ScopeMode::Project, &user, Some("  ")).unwrap_err(),
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

    #[test]
    fn project_scope_filters_project_id_only() {
        let project = ObjectId::new();
        let f = list_filter(&TenantScope::Project(project), None, None);
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
        let f = ownership_filter(&TenantScope::Project(project), ObjectId::new());
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }
}
