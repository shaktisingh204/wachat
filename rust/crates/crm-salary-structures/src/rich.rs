//! Rich-model salary-structure surface (people-suite WI-8).
//!
//! The `crm_salary_structures` collection holds two shapes (§2.1.2 of
//! the people-suite spec):
//!
//! - the legacy FLAT [`crate::types::CrmSalaryStructure`]
//!   (`employeeId`, `basic`, `hra`, …) written by the original CRUD in
//!   [`crate::handlers`] — kept ONLY on the `/v1/crm/salary-structures`
//!   user mount, untouched; and
//! - the **canonical rich** [`hrm_payroll_types::SalaryStructure`]
//!   (`name`, `effectiveDate`, `components[]`, `applicableTo[]`,
//!   `active`) that `crm-payroll-runs::compute_payroll_run` consumes.
//!
//! The handlers in this module CRUD the rich shape and are mounted by
//! [`crate::router::project_router`] under
//! `/v1/sabcrm/people/salary-structures` with
//! `crm_core::ScopeMode::Project` — every request must carry
//! `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or
//! it is rejected 4xx. There is no `userId` fallback: legacy flat rows
//! carry no `projectId` and are therefore invisible here (accepted
//! clean-start, risk R3).
//!
//! Deletes are **soft** (`active = false`): inactive structures are
//! kept for historical runs per the model contract.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use crm_core::{Audit, Identity, ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use hrm_payroll_types::{Applicability, CalcKind, SalaryComponent, SalaryStructure};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use tracing::instrument;

const COLL: &str = "crm_salary_structures";
const ENTITY_KIND: &str = "salary_structure";

/* ===================== DTOs ===================== */

/// Query string carrying the SabCRM tenant scope for the by-id routes.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** under
    /// `ScopeMode::Project`.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RichListQuery {
    /// SabCRM tenant scope — **required** under `ScopeMode::Project`.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Substring match over `name`.
    #[serde(default)]
    pub q: Option<String>,
    /// Filter on the `active` flag; absent = all.
    #[serde(default)]
    pub active: Option<bool>,
}

/// `POST /` body — the FULL rich field set (WI-8). `components` and
/// `applicableTo` deserialize directly into the canonical
/// `hrm_payroll_types` shapes so the wire format matches the model
/// 1:1 (`calc: {kind, …}`, `applicableTo: [{kind, id}]`).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRichStructureInput {
    /// SabCRM tenant scope. **Required** in `ScopeMode::Project`.
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    pub effective_date: DateTime<Utc>,
    #[serde(default)]
    pub components: Vec<SalaryComponent>,
    #[serde(default)]
    pub applicable_to: Vec<Applicability>,
    #[serde(default)]
    pub active: Option<bool>,
}

/// `PATCH /{structureId}` body — every field optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRichStructureInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub effective_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub components: Option<Vec<SalaryComponent>>,
    #[serde(default)]
    pub applicable_to: Option<Vec<Applicability>>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRichStructureResponse {
    pub id: String,
    pub entity: SalaryStructure,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRichStructureResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RichListResponse {
    pub items: Vec<SalaryStructure>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

/* ===================== Helpers ===================== */

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (see `crm-invoices/src/handlers.rs` — same contract).
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

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut f = scope.filter();
    f.insert("_id", oid);
    f
}

/// Validate + canonicalise the components table: every row needs a
/// non-empty `name` and `code` (codes are upper-cased so formulas and
/// the BASIC lookup in payroll compute behave predictably), formula
/// expressions must be non-empty, and `minCap <= maxCap` when both are
/// set.
fn validate_components(components: &mut [SalaryComponent]) -> Result<()> {
    for comp in components.iter_mut() {
        let name = comp.name.trim();
        if name.is_empty() {
            return Err(ApiError::Validation(
                "every component needs a non-empty name".to_owned(),
            ));
        }
        comp.name = name.to_owned();
        let code = comp.code.trim();
        if code.is_empty() {
            return Err(ApiError::Validation(format!(
                "component '{}' needs a non-empty code",
                comp.name
            )));
        }
        comp.code = code.to_ascii_uppercase();
        if let CalcKind::Formula { expr } = &comp.calc {
            if expr.trim().is_empty() {
                return Err(ApiError::Validation(format!(
                    "component '{}' has an empty formula expression",
                    comp.code
                )));
            }
        }
        if let (Some(min), Some(max)) = (comp.min_cap, comp.max_cap) {
            if min > max {
                return Err(ApiError::Validation(format!(
                    "component '{}': minCap must be <= maxCap",
                    comp.code
                )));
            }
        }
    }
    Ok(())
}

/// Validate the targeting rules — grade codes must be non-empty.
fn validate_applicable_to(rules: &[Applicability]) -> Result<()> {
    for rule in rules {
        if let Applicability::Grade(g) = rule {
            if g.trim().is_empty() {
                return Err(ApiError::Validation(
                    "applicableTo grade codes must be non-empty".to_owned(),
                ));
            }
        }
    }
    Ok(())
}

/// Decode one raw `crm_salary_structures` document into the rich
/// shape, warning + `None` on a legacy flat row so one mixed-shape doc
/// can never 500 a list (§2.1.2 / R1 — same contract as the
/// graceful-skip inside payroll compute).
fn decode_rich(raw: Document) -> Option<SalaryStructure> {
    let id_for_log = raw.get_object_id("_id").ok();
    match bson::from_document::<SalaryStructure>(raw) {
        Ok(s) => Some(s),
        Err(e) => {
            tracing::warn!(
                structure_id = ?id_for_log,
                error = %e,
                "salary structure is not the rich shape (legacy flat doc?); skipping",
            );
            None
        }
    }
}

fn doc_for_audit(entity: &SalaryStructure) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

/* ===================== Handlers ===================== */

/// `GET /` — paginated rich-shape list. Legacy flat rows (no
/// `projectId`) never match the Project scope filter; any that slip
/// through under User scope are gracefully skipped by [`decode_rich`].
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rich_structures(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<RichListQuery>,
) -> Result<Json<RichListResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = scope.filter();
    if let Some(active) = q.active {
        if active {
            // `active` defaults to true and is skipped when true on the
            // wire, so "active" means "not explicitly false".
            filter.insert("active", doc! { "$ne": false });
        } else {
            filter.insert("active", false);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "effectiveDate": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Document>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.find(rich)"))
    })?;
    let mut raws: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.collect(rich)"))
    })?;
    let has_more = raws.len() as i64 > limit;
    if has_more {
        raws.truncate(limit as usize);
    }
    let rows: Vec<SalaryStructure> = raws.into_iter().filter_map(decode_rich).collect();
    Ok(Json(RichListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

/// `GET /{structureId}` — single rich structure. A legacy flat row
/// under the same id 409s with a pointer at the legacy surface rather
/// than failing BSON decode with a 500.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn get_rich_structure(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<SalaryStructure>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<Document>(COLL);
    let raw = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_salary_structures.find_one(rich)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("salaryStructure".to_owned()))?;
    let entity = decode_rich(raw).ok_or_else(|| {
        ApiError::Conflict(
            "this salary structure is the legacy flat shape — manage it via \
             /v1/crm/salary-structures"
                .to_owned(),
        )
    })?;
    Ok(Json(entity))
}

/// `POST /` — create a rich structure. In project mode the body's
/// `projectId` IS the tenant scope (mandatory, 4xx when absent); the
/// stamped `userId` is always `AuthUser.user_id` (auditing).
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rich_structure(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRichStructureInput>,
) -> Result<Json<CreateRichStructureResponse>> {
    let user_id = user_oid(&user)?;
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `Identity.projectId` is a required field on the rich model. Under
    // Project scope it is the resolved scope itself; under User scope
    // honour an optional body value or mint one (same convention as the
    // gen-1 create handlers — behaviour freeze).
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => input
            .project_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| ObjectId::parse_str(s).ok())
            .unwrap_or_else(ObjectId::new),
    };

    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut components = input.components;
    validate_components(&mut components)?;
    validate_applicable_to(&input.applicable_to)?;

    let entity = SalaryStructure {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        name,
        effective_date: input.effective_date,
        components,
        applicable_to: input.applicable_to,
        active: input.active.unwrap_or(true),
    };

    let coll = mongo.collection::<SalaryStructure>(COLL);
    coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.insert(rich)"))
    })?;
    let new_id = entity.identity.id;
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateRichStructureResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

/// `PATCH /{structureId}` — partial update of a rich structure. Flat
/// rows are rejected with a 409 (legacy surface owns them).
#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn update_rich_structure(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(patch): Json<UpdateRichStructureInput>,
) -> Result<Json<SalaryStructure>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<Document>(COLL);
    let raw = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_salary_structures.find_one(rich)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("salaryStructure".to_owned()))?;
    let before = decode_rich(raw).ok_or_else(|| {
        ApiError::Conflict(
            "this salary structure is the legacy flat shape — manage it via \
             /v1/crm/salary-structures"
                .to_owned(),
        )
    })?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.effective_date {
        set.insert("effectiveDate", bson::DateTime::from_chrono(v));
    }
    if let Some(mut comps) = patch.components {
        validate_components(&mut comps)?;
        let comps_bson = bson::to_bson(&comps).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.bson(comps)"))
        })?;
        set.insert("components", comps_bson);
    }
    if let Some(rules) = patch.applicable_to {
        validate_applicable_to(&rules)?;
        let rules_bson = bson::to_bson(&rules).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.bson(rules)"))
        })?;
        set.insert("applicableTo", rules_bson);
    }
    if let Some(v) = patch.active {
        set.insert("active", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.update(rich)"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("salaryStructure".to_owned()));
    }
    let after_raw = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.refetch(rich)"))
        })?
        .ok_or_else(|| ApiError::NotFound("salaryStructure".to_owned()))?;
    let after = decode_rich(after_raw)
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("structure lost rich shape on update")))?;
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

/// `DELETE /{structureId}` — soft delete (`active = false`). Inactive
/// structures stay readable for historical runs; flat rows 409.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn delete_rich_structure(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<DeleteRichStructureResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<Document>(COLL);
    let raw = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_salary_structures.find_one(rich)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("salaryStructure".to_owned()))?;
    if decode_rich(raw).is_none() {
        return Err(ApiError::Conflict(
            "this salary structure is the legacy flat shape — manage it via \
             /v1/crm/salary-structures"
                .to_owned(),
        ));
    }
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "active": false,
                "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                "updatedBy": user_id,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_salary_structures.deactivate(rich)"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("salaryStructure".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteRichStructureResponse { deleted: true }))
}

/* ===================== Tests ===================== */

#[cfg(test)]
mod tests {
    use super::*;
    use hrm_payroll_types::{ComponentType, Frequency};

    fn component(code: &str, calc: CalcKind) -> SalaryComponent {
        SalaryComponent {
            name: code.to_owned(),
            code: code.to_owned(),
            component_type: ComponentType::Earning,
            calc,
            taxable: false,
            statutory: false,
            prorate: false,
            frequency: Frequency::Monthly,
            max_cap: None,
            min_cap: None,
        }
    }

    #[test]
    fn create_input_round_trips_canonical_wire_shape() {
        // Mirrors the WI-37 fixture structure (BASIC percent_ctc, HRA
        // percent_basic, PF formula min()) so the rich create surface
        // is locked to the canonical `hrm_payroll_types` wire format.
        let input: CreateRichStructureInput = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
            "name": "E2E Eng 2026",
            "effectiveDate": "2026-01-01T00:00:00Z",
            "components": [
                { "name": "Basic", "code": "BASIC", "type": "earning",
                  "calc": { "kind": "percent_ctc", "pct": 40.0 },
                  "taxable": true, "prorate": true },
                { "name": "House Rent Allowance", "code": "HRA", "type": "earning",
                  "calc": { "kind": "percent_basic", "pct": 50.0 } },
                { "name": "Provident Fund", "code": "PF", "type": "deduction",
                  "calc": { "kind": "formula", "expr": "min(BASIC, 15000) * 0.12" },
                  "statutory": true, "maxCap": 1800.0 },
            ],
            "applicableTo": [
                { "kind": "department", "id": "507f1f77bcf86cd799439011" },
                { "kind": "grade", "id": "L4" },
            ],
            "active": true,
        }))
        .unwrap();
        assert_eq!(input.name, "E2E Eng 2026");
        assert_eq!(input.components.len(), 3);
        assert!(matches!(
            input.components[0].calc,
            CalcKind::PercentCtc { .. }
        ));
        assert!(matches!(
            input.components[2].calc,
            CalcKind::Formula { .. }
        ));
        assert_eq!(input.components[2].max_cap, Some(1800.0));
        assert_eq!(input.applicable_to.len(), 2);
        assert!(matches!(input.applicable_to[1], Applicability::Grade(_)));
    }

    #[test]
    fn validate_components_uppercases_codes_and_rejects_empties() {
        let mut comps = vec![component("basic", CalcKind::Fixed { amount: 1.0 })];
        validate_components(&mut comps).unwrap();
        assert_eq!(comps[0].code, "BASIC");

        let mut empty_code = vec![component("", CalcKind::Fixed { amount: 1.0 })];
        empty_code[0].name = "Basic".into();
        assert!(validate_components(&mut empty_code).is_err());

        let mut empty_formula = vec![component(
            "PF",
            CalcKind::Formula {
                expr: "   ".to_owned(),
            },
        )];
        assert!(validate_components(&mut empty_formula).is_err());

        let mut bad_caps = vec![component("HRA", CalcKind::Fixed { amount: 1.0 })];
        bad_caps[0].min_cap = Some(10.0);
        bad_caps[0].max_cap = Some(5.0);
        assert!(validate_components(&mut bad_caps).is_err());
    }

    #[test]
    fn decode_rich_skips_legacy_flat_docs() {
        // Flat gen-2 shape (missing name/effectiveDate) must be a soft
        // skip, never a panic/500.
        let flat = doc! {
            "_id": ObjectId::new(),
            "userId": ObjectId::new(),
            "employeeId": ObjectId::new(),
            "basic": 20_000.0,
            "status": "active",
        };
        assert!(decode_rich(flat).is_none());
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

    #[test]
    fn project_scope_filter_has_no_user_id() {
        let project = ObjectId::new();
        let f = ownership_filter(&TenantScope::Project(project), ObjectId::new());
        assert_eq!(f.get_object_id("projectId").unwrap(), project);
        assert!(!f.contains_key("userId"));
    }
}
