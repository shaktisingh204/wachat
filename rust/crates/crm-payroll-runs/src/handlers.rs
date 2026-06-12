//! HTTP handlers for the §9.6 Payroll Run entity.
//!
//! Nine handlers — five standard CRUD plus four lifecycle verbs:
//!
//! | Method  | Path                          | Function                 |
//! |---------|-------------------------------|--------------------------|
//! | `GET`   | `/`                           | [`list_payroll_runs`]    |
//! | `GET`   | `/:runId`                     | [`get_payroll_run`]      |
//! | `POST`  | `/`                           | [`create_payroll_run`]   |
//! | `PATCH` | `/:runId`                     | [`update_payroll_run`]   |
//! | `DELETE`| `/:runId`                     | [`delete_payroll_run`]   |
//! | `POST`  | `/:runId/compute`             | [`compute_payroll_run`]  |
//! | `POST`  | `/:runId/approve`             | [`approve_payroll_run`]  |
//! | `POST`  | `/:runId/disburse`            | [`disburse_payroll_run`] |
//! | `POST`  | `/:runId/generate-payslips`   | [`generate_payslips`]    |
//!
//! Every handler scopes its Mongo query by the mount's
//! [`crm_core::ScopeMode`] (attached as an axum `Extension` by the
//! router constructors in [`crate::router`]):
//!
//! - `/v1/hrm/payroll-runs` (legacy) — `userId == AuthUser.user_id`,
//!   the CRM tenant root from `crm-core::Identity`. Unchanged
//!   behaviour.
//! - `/v1/sabcrm/people/payroll-runs` (SabCRM People suite) —
//!   `projectId == ?projectId` / body `projectId`, required per-request
//!   (4xx when absent). Membership is validated by the Next.js action
//!   gate before the request reaches Rust. Cross-collection reads
//!   inside compute (`crm_employees`, `crm_salary_structures`) use the
//!   same resolved scope, so a Project-mounted compute only sees that
//!   project's roster.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity, ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
// `EmploymentStatus` is referenced only in test code today (the production
// query filters on a string projection rather than the enum). Keep it in
// the import group so tests compile and silence the lib-build warning.
#[allow(unused_imports)]
use hrm_payroll_types::{
    ApprovalStep, BankFileFormat, CalcKind, ComponentType, DeductionLine, EarningLine, Employee,
    EmployeeRunRow, EmploymentStatus, PayrollRun, PayrollRunStatus, PayrollTotals,
    ReimbursementLine, SalaryComponent, SalaryStructure,
    payslip::{
        DeductionLine as PayslipDeductionLine, EarningLine as PayslipEarningLine, Payslip,
        PayslipAttendanceSummary, PayslipBankInfo, PayslipEmployee, PayslipHeader, PayslipYtd,
        ReimbursementLine as PayslipReimbursementLine,
    },
};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    ApproveInput, CreatePayrollRunInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, ScopeQuery,
    UpdatePayrollRunInput,
};

/// Mongo collection name (this crate).
const RUNS_COLL: &str = "crm_payroll_runs";
/// Mongo collection — read by [`compute_payroll_run`] to fetch the
/// active employee roster.
const EMPLOYEES_COLL: &str = "crm_employees";
/// Mongo collection — read by [`compute_payroll_run`] to resolve each
/// employee's salary structure into earning / deduction lines.
const SALARY_STRUCTURES_COLL: &str = "crm_salary_structures";
/// Mongo collection — written by [`generate_payslips`] (one rich
/// `hrm_payroll_types::Payslip` per employee run row).
const PAYSLIPS_COLL: &str = "crm_payslips";
/// Mongo collection — read by [`generate_payslips`] for the tenant's
/// `companyName` (payslip PDF header).
const PAYROLL_SETTINGS_COLL: &str = "crm_payroll_settings";
/// Mongo collection — read by [`generate_payslips`] to resolve the
/// employee's department label for the frozen snapshot.
const DEPARTMENTS_COLL: &str = "crm_departments";

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

/// Resolve the per-request [`TenantScope`] from the mount's
/// [`ScopeMode`] (attached as an axum `Extension` by the router
/// constructor):
///
/// - `ScopeMode::User` (legacy mount) — scope by the verified JWT
///   subject. Identical to the historical behaviour.
/// - `ScopeMode::Project` (`/v1/sabcrm/people/payroll-runs`) — scope by
///   the caller-supplied `projectId`, 4xx when absent/invalid. The
///   Next.js action gate has already validated project membership
///   before the request reaches Rust.
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

/// Materialize the base ownership filter for the resolved scope:
/// `{ <userId|projectId>, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(scope: &TenantScope) -> Document {
    let mut f = scope.filter();
    f.insert("archived", doc! { "$ne": true });
    f
}

/// Lower-case wire form of [`PayrollRunStatus`]. `serde_json::to_value`
/// would also work but pulls in heavier machinery for a 1-of-5 enum.
fn status_str(s: PayrollRunStatus) -> &'static str {
    match s {
        PayrollRunStatus::Draft => "draft",
        PayrollRunStatus::Processing => "processing",
        PayrollRunStatus::Approved => "approved",
        PayrollRunStatus::Disbursed => "disbursed",
        PayrollRunStatus::Closed => "closed",
    }
}

/// Parse a workflow status string. Returns `Ok(None)` when `raw` is
/// `None` or empty so callers can pipe straight into a query without an
/// extra branch.
fn parse_status(raw: Option<&String>) -> Result<Option<PayrollRunStatus>> {
    let Some(s) = raw.map(|s| s.trim()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let lower = s.to_ascii_lowercase();
    match lower.as_str() {
        "draft" => Ok(Some(PayrollRunStatus::Draft)),
        "processing" => Ok(Some(PayrollRunStatus::Processing)),
        "approved" => Ok(Some(PayrollRunStatus::Approved)),
        "disbursed" => Ok(Some(PayrollRunStatus::Disbursed)),
        "closed" => Ok(Some(PayrollRunStatus::Closed)),
        _ => Err(ApiError::Validation(
            "status must be one of: draft, processing, approved, disbursed, closed.".to_owned(),
        )),
    }
}

/// Parse a [`BankFileFormat`] from its snake-case wire form.
fn parse_bank_file_format(raw: &str) -> Result<BankFileFormat> {
    match raw.to_ascii_lowercase().as_str() {
        "neft" => Ok(BankFileFormat::Neft),
        "imps" => Ok(BankFileFormat::Imps),
        "rtgs" => Ok(BankFileFormat::Rtgs),
        "upi_bulk" => Ok(BankFileFormat::UpiBulk),
        _ => Err(ApiError::Validation(
            "bankFileFormat must be one of: neft, imps, rtgs, upi_bulk.".to_owned(),
        )),
    }
}

/// Snake-case wire form for [`BankFileFormat`].
fn bank_file_format_str(f: BankFileFormat) -> &'static str {
    match f {
        BankFileFormat::Neft => "neft",
        BankFileFormat::Imps => "imps",
        BankFileFormat::Rtgs => "rtgs",
        BankFileFormat::UpiBulk => "upi_bulk",
    }
}

// =========================================================================
// GET / — list_payroll_runs
// =========================================================================

/// `GET /v1/hrm/payroll-runs` — paginated list scoped to the
/// authenticated user's runs. `status` narrows by workflow stage; sort
/// is `periodFrom` desc so the most recent period surfaces first.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_payroll_runs(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PayrollRun>>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;

    let mut filter = base_ownership_filter(&scope);
    if let Some(status) = parse_status(q.status.as_ref())? {
        filter.insert("status", status_str(status));
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "periodFrom": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<PayrollRun>(RUNS_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.find"))
        })?;
    let runs: Vec<PayrollRun> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.collect"))
    })?;

    Ok(Json(runs))
}

// =========================================================================
// GET /:runId — get_payroll_run
// =========================================================================

/// `GET /v1/hrm/payroll-runs/:runId` — fetch a single run. Returns 404
/// if the run doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn get_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<PayrollRun>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let run_oid = oid_from_str(&run_id)?;

    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", run_oid);

    let coll = mongo.collection::<PayrollRun>(RUNS_COLL);
    let run = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;

    Ok(Json(run))
}

// =========================================================================
// POST / — create_payroll_run
// =========================================================================

/// `POST /v1/hrm/payroll-runs` — insert a new run.
///
/// Builds a [`PayrollRun`] from the curated [`CreatePayrollRunInput`],
/// stamps `Identity` + `Audit`, defaults `status` to
/// [`PayrollRunStatus::Draft`], and persists it. The per-employee rows
/// + totals are NOT computed here — call `/{id}/compute` once the user
/// is ready to resolve the roster against active salary structures.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePayrollRunInput>,
) -> Result<Json<PayrollRun>> {
    if input.period_to < input.period_from {
        return Err(ApiError::Validation(
            "periodTo must be on or after periodFrom.".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    // In project mode the body's `projectId` IS the tenant scope and is
    // therefore mandatory (4xx when absent) — `resolve_scope` enforces
    // that. In legacy user mode the scope is the JWT subject and the
    // body `projectId` stays optional, exactly as before. The stamped
    // `userId` is always `AuthUser.user_id` (auditing).
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    let project_id = match scope {
        TenantScope::Project(p) => p,
        TenantScope::User(_) => match input.project_id.as_deref().filter(|s| !s.is_empty()) {
            Some(s) => oid_from_str(s)?,
            // The §9 spec requires a project scope, but the legacy TS
            // single-tenant callers omitted it — mint a fresh OID so
            // existing UI keeps working during the migration window.
            None => ObjectId::new(),
        },
    };

    let bank_file_format = match input.bank_file_format.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(parse_bank_file_format(s)?),
        None => None,
    };

    let run = PayrollRun {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        period_from: input.period_from,
        period_to: input.period_to,
        pay_date: input.pay_date,
        lock_date: input.lock_date,
        employees: Vec::new(),
        totals: PayrollTotals::default(),
        bank_file_format,
        bank_file_id: None,
        status: PayrollRunStatus::Draft,
        approvals: Vec::new(),
    };

    let coll = mongo.collection::<PayrollRun>(RUNS_COLL);
    coll.insert_one(&run).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.insert_one"))
    })?;

    Ok(Json(run))
}

// =========================================================================
// PATCH /:runId — update_payroll_run
// =========================================================================

/// `PATCH /v1/hrm/payroll-runs/:runId` — partial update of period /
/// dates / bank-file format. Server-managed fields (`employees`,
/// `totals`, `approvals`, `bankFileId`, `status`) are NEVER mutated by
/// this endpoint — call the matching lifecycle verb instead.
///
/// PATCH is rejected once the run leaves `draft` so we never edit the
/// inputs of a run that's already mid-flight (employees + structure
/// resolved, approvers sometimes already signed).
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn update_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<UpdatePayrollRunInput>,
) -> Result<Json<PayrollRun>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let run_oid = oid_from_str(&run_id)?;

    // Guard: only `draft` runs are editable from PATCH.
    let typed = mongo.collection::<PayrollRun>(RUNS_COLL);
    let mut load_filter = base_ownership_filter(&scope);
    load_filter.insert("_id", run_oid);
    let existing = typed
        .find_one(load_filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(pre-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    if !matches!(existing.status, PayrollRunStatus::Draft) {
        return Err(ApiError::Conflict(format!(
            "payroll run is in '{}' state — only 'draft' runs are editable",
            status_str(existing.status)
        )));
    }

    // Cross-field validation: if both period bounds are sent (or one
    // sent + one already on the doc), they must still be ordered.
    let new_from = input.period_from.unwrap_or(existing.period_from);
    let new_to = input.period_to.unwrap_or(existing.period_to);
    if new_to < new_from {
        return Err(ApiError::Validation(
            "periodTo must be on or after periodFrom.".to_owned(),
        ));
    }

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    if let Some(when) = input.period_from {
        set.insert("periodFrom", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.period_to {
        set.insert("periodTo", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.pay_date {
        set.insert("payDate", bson::DateTime::from_chrono(when));
    }
    if let Some(when) = input.lock_date {
        set.insert("lockDate", bson::DateTime::from_chrono(when));
    }
    if let Some(fmt) = input.bank_file_format.as_deref().filter(|s| !s.is_empty()) {
        let parsed = parse_bank_file_format(fmt)?;
        set.insert("bankFileFormat", bank_file_format_str(parsed));
    }

    let coll = mongo.collection::<Document>(RUNS_COLL);
    let res = coll
        .update_one(load_filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("payrollRun".to_owned()));
    }

    let run = typed
        .find_one(load_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(after-update)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;

    Ok(Json(run))
}

// =========================================================================
// DELETE /:runId — delete_payroll_run (hard)
// =========================================================================

/// `DELETE /v1/hrm/payroll-runs/:runId` — **hard delete**. Per the CRM
/// ecosystem plan, CRM entities use hard deletes — the row is removed
/// from the collection. Fails with 404 if the run doesn't exist OR
/// isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn delete_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let run_oid = oid_from_str(&run_id)?;

    let mut filter = scope.filter();
    filter.insert("_id", run_oid);

    let coll = mongo.collection::<Document>(RUNS_COLL);
    let res = coll.delete_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.delete_one"))
    })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("payrollRun".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Compute helpers — the math behind /compute
// =========================================================================

/// Resolve a single [`SalaryComponent`] into a concrete amount given
/// the running BASIC + CTC values for the employee. The four
/// calc-kinds on [`CalcKind`] are supported:
///
/// - `Fixed { amount }` — verbatim.
/// - `PercentBasic { pct }` — `pct/100 * basic`.
/// - `PercentCtc { pct }` — `pct/100 * ctc`.
/// - `Formula { expr }` — evaluated by [`eval_formula`]. Supports
///   `+ - * / ( )`, decimal literals, the `min(a, b, …)` / `max(a, b, …)`
///   functions, and the bound identifiers `basic`, `ctc`, `monthlyCtc`
///   (alias for `ctc`), and `annualCtc` (`ctc * 12`). On parse /
///   evaluation failure the formula returns `0.0` and logs a warning,
///   matching the prior stub's behaviour.
///
/// `min_cap` and `max_cap` are honoured.
fn resolve_amount(component: &SalaryComponent, basic: f64, ctc: f64) -> f64 {
    let raw = match &component.calc {
        CalcKind::Fixed { amount } => *amount,
        CalcKind::PercentBasic { pct } => (*pct as f64) / 100.0 * basic,
        CalcKind::PercentCtc { pct } => (*pct as f64) / 100.0 * ctc,
        CalcKind::Formula { expr } => match eval_formula(expr, basic, ctc) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(
                    expr = %expr,
                    code = %component.code,
                    error = %e,
                    "formula evaluation failed; returning 0.0",
                );
                0.0
            }
        },
    };
    let mut amount = raw;
    if let Some(min) = component.min_cap {
        if amount < min {
            amount = min;
        }
    }
    if let Some(max) = component.max_cap {
        if amount > max {
            amount = max;
        }
    }
    // Clamp negatives — earnings can't go below zero, deductions are
    // stored as positive magnitudes (the "subtraction" is the role
    // assigned by `component_type`).
    if amount < 0.0 {
        amount = 0.0;
    }
    amount
}

/// Evaluate a salary-component formula expression. Supports decimal
/// literals, `+ - * /`, parentheses, unary minus, the variadic
/// `min(a, b, …)` / `max(a, b, …)` functions, and the bound
/// identifiers `basic`, `ctc`, `monthlyCtc` (alias for `ctc`), and
/// `annualCtc` (`= ctc * 12`). Identifiers and function names are
/// case-insensitive. `min`/`max` cover the canonical statutory PF
/// formula `min(BASIC, 15000) * 0.12` from
/// `hrm-payroll-types::salary_structure` (P7 WI-6 — previously these
/// silently resolved to `0.0`, understating deductions).
///
/// This is a deliberately small recursive-descent parser — payroll
/// formulas in production are typically a single multiplication or
/// percentage, so we don't need a full expression DSL. The error type
/// is a string so the caller can surface the parse failure to logs.
fn eval_formula(expr: &str, basic: f64, ctc: f64) -> std::result::Result<f64, String> {
    let mut parser = FormulaParser::new(expr, basic, ctc);
    let v = parser.parse_expr()?;
    parser.expect_eof()?;
    Ok(v)
}

struct FormulaParser<'a> {
    src: &'a [u8],
    pos: usize,
    basic: f64,
    ctc: f64,
}

impl<'a> FormulaParser<'a> {
    fn new(src: &'a str, basic: f64, ctc: f64) -> Self {
        Self {
            src: src.as_bytes(),
            pos: 0,
            basic,
            ctc,
        }
    }

    fn skip_ws(&mut self) {
        while self.pos < self.src.len() && (self.src[self.pos] as char).is_whitespace() {
            self.pos += 1;
        }
    }

    fn peek(&mut self) -> Option<char> {
        self.skip_ws();
        self.src.get(self.pos).map(|b| *b as char)
    }

    fn bump(&mut self) -> Option<char> {
        self.skip_ws();
        let c = self.src.get(self.pos).map(|b| *b as char)?;
        self.pos += 1;
        Some(c)
    }

    fn expect_eof(&mut self) -> std::result::Result<(), String> {
        self.skip_ws();
        if self.pos < self.src.len() {
            Err(format!("unexpected trailing input at offset {}", self.pos))
        } else {
            Ok(())
        }
    }

    /// expr := term ( ('+' | '-') term )*
    fn parse_expr(&mut self) -> std::result::Result<f64, String> {
        let mut acc = self.parse_term()?;
        loop {
            match self.peek() {
                Some('+') => {
                    self.bump();
                    acc += self.parse_term()?;
                }
                Some('-') => {
                    self.bump();
                    acc -= self.parse_term()?;
                }
                _ => break,
            }
        }
        Ok(acc)
    }

    /// term := unary ( ('*' | '/') unary )*
    fn parse_term(&mut self) -> std::result::Result<f64, String> {
        let mut acc = self.parse_unary()?;
        loop {
            match self.peek() {
                Some('*') => {
                    self.bump();
                    acc *= self.parse_unary()?;
                }
                Some('/') => {
                    self.bump();
                    let rhs = self.parse_unary()?;
                    if rhs == 0.0 {
                        return Err("division by zero".to_string());
                    }
                    acc /= rhs;
                }
                _ => break,
            }
        }
        Ok(acc)
    }

    /// unary := '-' unary | atom
    fn parse_unary(&mut self) -> std::result::Result<f64, String> {
        match self.peek() {
            Some('-') => {
                self.bump();
                Ok(-self.parse_unary()?)
            }
            Some('+') => {
                self.bump();
                self.parse_unary()
            }
            _ => self.parse_atom(),
        }
    }

    /// atom := number | identifier | function-call | '(' expr ')'
    ///
    /// function-call := ('min' | 'max') '(' expr (',' expr)* ')'
    fn parse_atom(&mut self) -> std::result::Result<f64, String> {
        match self.peek() {
            Some('(') => {
                self.bump();
                let v = self.parse_expr()?;
                match self.bump() {
                    Some(')') => Ok(v),
                    _ => Err("expected ')'".to_string()),
                }
            }
            Some(c) if c.is_ascii_digit() || c == '.' => self.parse_number(),
            Some(c) if c.is_ascii_alphabetic() || c == '_' => self.parse_identifier(),
            Some(c) => Err(format!("unexpected character '{c}'")),
            None => Err("unexpected end of expression".to_string()),
        }
    }

    /// Parse the parenthesised, comma-separated argument list of a
    /// `min` / `max` call (the name has already been consumed) and fold
    /// it with the supplied combiner. Requires at least two arguments —
    /// a 1-arg `min(x)` is almost certainly a typo in a payroll formula
    /// and silently passing it through would mask the mistake.
    fn parse_fn_args(
        &mut self,
        name: &str,
        fold: fn(f64, f64) -> f64,
    ) -> std::result::Result<f64, String> {
        match self.bump() {
            Some('(') => {}
            _ => return Err(format!("expected '(' after function '{name}'")),
        }
        let mut acc = self.parse_expr()?;
        let mut arg_count = 1usize;
        while self.peek() == Some(',') {
            self.bump();
            acc = fold(acc, self.parse_expr()?);
            arg_count += 1;
        }
        match self.bump() {
            Some(')') => {}
            _ => return Err(format!("expected ')' to close '{name}(…'")),
        }
        if arg_count < 2 {
            return Err(format!("{name}() requires at least two arguments"));
        }
        Ok(acc)
    }

    fn parse_number(&mut self) -> std::result::Result<f64, String> {
        self.skip_ws();
        let start = self.pos;
        let mut saw_dot = false;
        while let Some(&b) = self.src.get(self.pos) {
            let c = b as char;
            if c.is_ascii_digit() {
                self.pos += 1;
            } else if c == '.' && !saw_dot {
                saw_dot = true;
                self.pos += 1;
            } else {
                break;
            }
        }
        let lit = std::str::from_utf8(&self.src[start..self.pos]).map_err(|e| e.to_string())?;
        lit.parse::<f64>()
            .map_err(|e| format!("bad number '{lit}': {e}"))
    }

    fn parse_identifier(&mut self) -> std::result::Result<f64, String> {
        self.skip_ws();
        let start = self.pos;
        while let Some(&b) = self.src.get(self.pos) {
            let c = b as char;
            if c.is_ascii_alphanumeric() || c == '_' {
                self.pos += 1;
            } else {
                break;
            }
        }
        let ident = std::str::from_utf8(&self.src[start..self.pos]).map_err(|e| e.to_string())?;
        match ident.to_ascii_lowercase().as_str() {
            // Function calls — the canonical statutory PF formula is
            // `min(BASIC, 15000) * 0.12` (see
            // hrm-payroll-types::salary_structure), so `min`/`max`
            // MUST resolve to real values, never the silent-zero
            // fallback (P7 WI-6 / risk R2).
            "min" => self.parse_fn_args("min", f64::min),
            "max" => self.parse_fn_args("max", f64::max),
            "basic" => Ok(self.basic),
            "ctc" | "monthlyctc" => Ok(self.ctc),
            "annualctc" => Ok(self.ctc * 12.0),
            other => Err(format!("unknown identifier '{other}'")),
        }
    }
}

/// Compute one [`EmployeeRunRow`] from the employee's salary structure.
/// The two-pass design lets percent-of-basic components reference the
/// BASIC line that may appear later in the components list:
///
/// 1. First pass — find the BASIC earning line and resolve it (so it
///    can ground percent-basic calls). If no BASIC, defaults to
///    `monthly_ctc / 2` as a conservative fall-back.
/// 2. Second pass — resolve every other component, bucketed by
///    [`ComponentType`].
///
/// Reimbursements aren't expressible by the current
/// [`SalaryComponent`] vocab (they're claim-driven, not template-
/// driven), so this function never emits any. The reimbursements array
/// stays empty until the compute endpoint integrates with the
/// reimbursement-claims module.
fn compute_employee_row(
    employee_id: ObjectId,
    structure: &SalaryStructure,
    annual_ctc: f64,
) -> EmployeeRunRow {
    let monthly_ctc = annual_ctc / 12.0;

    // Pass 1 — resolve BASIC.
    let mut basic = monthly_ctc / 2.0;
    for comp in &structure.components {
        if comp.code.eq_ignore_ascii_case("BASIC")
            && matches!(comp.component_type, ComponentType::Earning)
        {
            basic = resolve_amount(comp, basic, monthly_ctc);
            break;
        }
    }

    // Pass 2 — earnings + deductions.
    let mut earnings: Vec<EarningLine> = Vec::new();
    let mut deductions: Vec<DeductionLine> = Vec::new();
    for comp in &structure.components {
        let amount = resolve_amount(comp, basic, monthly_ctc);
        match comp.component_type {
            ComponentType::Earning => earnings.push(EarningLine {
                code: comp.code.clone(),
                label: comp.name.clone(),
                amount,
            }),
            ComponentType::Deduction => deductions.push(DeductionLine {
                code: comp.code.clone(),
                label: comp.name.clone(),
                amount,
            }),
            // Reimbursements are claim-driven — see the function-level
            // comment above.
            ComponentType::Reimbursement => {}
        }
    }

    let gross: f64 = earnings.iter().map(|l| l.amount).sum();
    let total_deductions: f64 = deductions.iter().map(|l| l.amount).sum();
    let reimbursements: Vec<ReimbursementLine> = Vec::new();
    let total_reimb: f64 = reimbursements.iter().map(|l| l.amount).sum();
    let net = gross - total_deductions + total_reimb;
    let ctc = monthly_ctc;

    EmployeeRunRow {
        employee_id,
        earnings,
        deductions,
        reimbursements,
        gross,
        net,
        ctc,
    }
}

// =========================================================================
// POST /:runId/compute — compute_payroll_run
// =========================================================================

/// `POST /v1/hrm/payroll-runs/:runId/compute` — resolve the active
/// employee roster against their salary structures and populate
/// `employees[]` + `totals` on the run.
///
/// Lifecycle: the run must be in `draft` (or `processing` if a previous
/// compute attempt crashed mid-flight — we treat that as resumable).
/// The handler:
///
/// 1. Flips status → `processing` so concurrent callers see the run is
///    being built.
/// 2. Streams every active (`status = "active"`) employee owned by the
///    caller from `crm_employees`.
/// 3. For each employee, fetches their `salaryStructureId` from
///    `crm_salary_structures` (cached by id within the run), then runs
///    the compute math via [`compute_employee_row`].
/// 4. Writes the resolved `employees[]` + `totals` and flips status →
///    `draft` (the run is now ready for `/approve`).
///
/// Failures mid-flight leave the run in `processing` so the operator
/// can re-invoke compute idempotently.
///
/// **Schema-collision resilience (P7 §2.1.2):** `crm_salary_structures`
/// holds two shapes — the rich [`SalaryStructure`] this compute needs,
/// and the legacy FLAT `CrmSalaryStructure` written by the gen-2
/// `crm-salary-structures` CRUD. Structures are therefore read as raw
/// `Document`s and decoded per-doc via `bson::from_document`; a shape
/// mismatch logs a warning and SKIPS that employee instead of 500-ing
/// the whole run.
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn compute_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<PayrollRun>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let run_oid = oid_from_str(&run_id)?;

    // ---- Load + status guard --------------------------------------
    let runs = mongo.collection::<PayrollRun>(RUNS_COLL);
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", run_oid);
    let run = runs
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.find_one(compute)"))
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    match run.status {
        PayrollRunStatus::Draft | PayrollRunStatus::Processing => {}
        other => {
            return Err(ApiError::Conflict(format!(
                "payroll run is '{}' — compute is only legal in 'draft' or 'processing'",
                status_str(other)
            )));
        }
    }

    // ---- Flip → processing ----------------------------------------
    let runs_doc = mongo.collection::<Document>(RUNS_COLL);
    runs_doc
        .update_one(
            filter.clone(),
            doc! {
                "$set": {
                    "status": status_str(PayrollRunStatus::Processing),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                    "updatedBy": user_id,
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.compute.flip"))
        })?;

    // ---- Stream active employees ----------------------------------
    // Cross-collection read — MUST use the resolved scope filter (not
    // a hardcoded userId) so a Project-mounted compute only sees that
    // project's roster (P7 §3.3).
    let employees_coll = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let mut emp_filter = scope.filter();
    emp_filter.insert("archived", doc! { "$ne": true });
    emp_filter.insert("status", "active");
    let cursor = employees_coll
        .find(emp_filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.find")))?;
    let employees: Vec<Employee> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.collect")))?;

    // ---- Resolve each employee's structure + math -----------------
    // Structures are fetched as raw `Document`s and decoded per-doc:
    // `crm_salary_structures` also holds legacy FLAT `CrmSalaryStructure`
    // docs (gen-2 CRUD) that fail rich-shape BSON deserialization
    // (missing `name`/`effectiveDate`). One such doc must skip its
    // employee with a warning — never 500 the whole run (§2.1.2 / R1).
    let structures_coll = mongo.collection::<Document>(SALARY_STRUCTURES_COLL);
    let mut rows: Vec<EmployeeRunRow> = Vec::with_capacity(employees.len());
    for emp in &employees {
        let struct_oid = emp.employment.salary_structure_id;
        let mut struct_filter = scope.filter();
        struct_filter.insert("_id", struct_oid);
        let raw = structures_coll.find_one(struct_filter).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.find_one"))
        })?;
        let Some(raw) = raw else {
            tracing::warn!(
                employee_id = %emp.identity.id,
                salary_structure_id = %struct_oid,
                "employee references a missing salary structure; skipping",
            );
            continue;
        };
        let structure: SalaryStructure = match bson::from_document(raw) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(
                    employee_id = %emp.identity.id,
                    salary_structure_id = %struct_oid,
                    error = %e,
                    "salary structure is not the rich SalaryStructure shape \
                     (legacy flat CrmSalaryStructure doc?); skipping employee",
                );
                continue;
            }
        };
        let annual_ctc = emp.employment.ctc.unwrap_or(0.0);
        rows.push(compute_employee_row(
            emp.identity.id,
            &structure,
            annual_ctc,
        ));
    }

    // ---- Roll up totals -------------------------------------------
    let totals = PayrollTotals {
        gross: rows.iter().map(|r| r.gross).sum(),
        net: rows.iter().map(|r| r.net).sum(),
        ctc: rows.iter().map(|r| r.ctc).sum(),
        employee_count: rows.len() as u32,
    };

    // ---- Persist + flip back → draft ------------------------------
    let employees_bson = bson::to_bson(&rows).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.bson(employees)"))
    })?;
    let totals_bson = bson::to_bson(&totals).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.bson(totals)"))
    })?;
    runs_doc
        .update_one(
            filter.clone(),
            doc! {
                "$set": {
                    "employees": employees_bson,
                    "totals": totals_bson,
                    "status": status_str(PayrollRunStatus::Draft),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                    "updatedBy": user_id,
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.compute.persist"))
        })?;

    let updated = runs
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(after-compute)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    Ok(Json(updated))
}

// =========================================================================
// POST /:runId/approve — approve_payroll_run
// =========================================================================

/// `POST /v1/hrm/payroll-runs/:runId/approve` — append one
/// [`ApprovalStep`] to the run's approval chain.
///
/// **Status transitions:**
/// - The run must be in `draft` to accept new approvals (compute must
///   already have run, but the operator hasn't disbursed yet).
/// - Each call appends one signing event with `status="approved"` and
///   stamps `decidedAt = now`.
/// - The "all required approvers signed" rule is currently a single-
///   signer check: any approval flips the run to
///   [`PayrollRunStatus::Approved`]. Multi-step chains will plug their
///   required-approver list in via tenant settings (§9.10) — this
///   handler will read that list and only flip when every required
///   `approver_id` has at least one matching `approved` step.
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn approve_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
    Json(input): Json<ApproveInput>,
) -> Result<Json<PayrollRun>> {
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
    let run_oid = oid_from_str(&run_id)?;
    let approver_oid = oid_from_str(&input.approver_id)?;

    // ---- Load + status guard --------------------------------------
    let runs = mongo.collection::<PayrollRun>(RUNS_COLL);
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", run_oid);
    let run = runs
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.find_one(approve)"))
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    match run.status {
        PayrollRunStatus::Draft | PayrollRunStatus::Approved => {}
        other => {
            return Err(ApiError::Conflict(format!(
                "payroll run is '{}' — approve is only legal in 'draft' or 'approved'",
                status_str(other)
            )));
        }
    }

    // ---- Build the step + atomic $push ----------------------------
    let step = ApprovalStep {
        approver_id: approver_oid,
        status: "approved".to_owned(),
        decided_at: Some(Utc::now()),
        comment: input.comment.clone(),
    };
    let step_bson = bson::to_bson(&step).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.bson(step)"))
    })?;

    // Single-signer rule (see function-level comment) — flip to
    // `approved` on every successful append. When the multi-step chain
    // lands, switch this to a conditional flip based on the tenant's
    // required-approvers list.
    let runs_doc = mongo.collection::<Document>(RUNS_COLL);
    let res = runs_doc
        .update_one(
            filter.clone(),
            doc! {
                "$push": { "approvals": step_bson },
                "$set": {
                    "status": status_str(PayrollRunStatus::Approved),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                    "updatedBy": user_id,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.approve.update"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("payrollRun".to_owned()));
    }

    let updated = runs
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(after-approve)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    Ok(Json(updated))
}

// =========================================================================
// POST /:runId/disburse — disburse_payroll_run
// =========================================================================

/// `POST /v1/hrm/payroll-runs/:runId/disburse` — generate the bank
/// file (stub) and flip status to `disbursed`.
///
/// **Status transitions:** the run must be in `approved`. Idempotency
/// is via `bankFileId` — a run with a pre-existing `bankFileId` and
/// `status = disbursed` will short-circuit with
/// [`ApiError::Conflict`] rather than mint a duplicate file.
///
/// **Bank file generation (STUBBED):** this initial cut just stamps a
/// freshly-minted `ObjectId` into `bankFileId` so downstream consumers
/// can verify the workflow contract. The real implementation will:
///
/// 1. Render the run's `employees[]` into the format required by
///    `bankFileFormat` (NEFT XML, IMPS CSV, RTGS bulk, UPI Bulk JSON).
/// 2. Upload the rendered file to SabFiles (`crm_files`).
/// 3. Store the SabFile id on `bankFileId`.
///
/// The handler signature won't change when the real generator lands.
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn disburse_payroll_run(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<PayrollRun>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let run_oid = oid_from_str(&run_id)?;

    // ---- Load + status guard --------------------------------------
    let runs = mongo.collection::<PayrollRun>(RUNS_COLL);
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", run_oid);
    let run = runs
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.find_one(disburse)"))
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    if !matches!(run.status, PayrollRunStatus::Approved) {
        return Err(ApiError::Conflict(format!(
            "payroll run is '{}' — disburse requires 'approved'",
            status_str(run.status)
        )));
    }
    if run.bank_file_id.is_some() {
        return Err(ApiError::Conflict(
            "payroll run already has a bank file — refusing to regenerate".to_owned(),
        ));
    }

    // ---- Stub bank-file generation --------------------------------
    let bank_file_id = ObjectId::new();

    let runs_doc = mongo.collection::<Document>(RUNS_COLL);
    let res = runs_doc
        .update_one(
            filter.clone(),
            doc! {
                "$set": {
                    "bankFileId": bank_file_id,
                    "status": status_str(PayrollRunStatus::Disbursed),
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                    "updatedBy": user_id,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_runs.disburse.update"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("payrollRun".to_owned()));
    }

    let updated = runs
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(after-disburse)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    Ok(Json(updated))
}

// =========================================================================
// POST /:runId/generate-payslips — generate_payslips (people-suite WI-7)
// =========================================================================

/// Spell out a non-negative integer in the Indian numbering system
/// (crore / lakh / thousand / hundred), title-cased words.
fn int_to_indian_words(n: u64) -> String {
    const ONES: [&str; 20] = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
        "Nineteen",
    ];
    const TENS: [&str; 10] = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    fn below_100(n: u64) -> String {
        debug_assert!(n < 100);
        if n < 20 {
            ONES[n as usize].to_owned()
        } else if n % 10 == 0 {
            TENS[(n / 10) as usize].to_owned()
        } else {
            format!("{} {}", TENS[(n / 10) as usize], ONES[(n % 10) as usize])
        }
    }

    fn below_1000(n: u64) -> String {
        debug_assert!(n < 1000);
        if n < 100 {
            below_100(n)
        } else if n % 100 == 0 {
            format!("{} Hundred", ONES[(n / 100) as usize])
        } else {
            format!("{} Hundred {}", ONES[(n / 100) as usize], below_100(n % 100))
        }
    }

    if n == 0 {
        return "Zero".to_owned();
    }
    let mut parts: Vec<String> = Vec::new();
    let crore = n / 10_000_000;
    let lakh = (n / 100_000) % 100;
    let thousand = (n / 1_000) % 100;
    let rest = n % 1_000;
    if crore > 0 {
        // Recurse so 100+ crore reads naturally ("One Hundred Crore").
        parts.push(format!("{} Crore", int_to_indian_words(crore)));
    }
    if lakh > 0 {
        parts.push(format!("{} Lakh", below_100(lakh)));
    }
    if thousand > 0 {
        parts.push(format!("{} Thousand", below_100(thousand)));
    }
    if rest > 0 {
        parts.push(below_1000(rest));
    }
    parts.join(" ")
}

/// Indian-format spelled-out rupee amount for
/// `Payslip.net_pay_in_words`, e.g. `98_000.0` →
/// `"Ninety Eight Thousand Rupees Only"`. Paise are rounded to the
/// nearest rupee; negative amounts (pathological, but representable
/// with f64 money) are prefixed `"Minus"` rather than panicking.
fn rupees_in_words(amount: f64) -> String {
    let negative = amount < 0.0;
    let n = amount.abs().round() as u64;
    let words = int_to_indian_words(n);
    if negative {
        format!("Minus {words} Rupees Only")
    } else {
        format!("{words} Rupees Only")
    }
}

/// Mask a bank account number for the frozen payslip snapshot — only
/// the last four characters survive (`"XXXXXX1234"`), matching the
/// privacy convention on `PayslipBankInfo.account_no_masked`.
fn mask_account_no(account_no: &str) -> String {
    let trimmed = account_no.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = trimmed.chars().collect();
    let keep = chars.len().min(4);
    let tail: String = chars[chars.len() - keep..].iter().collect();
    format!("XXXXXX{tail}")
}

/// Human period label for the payslip header, e.g. `"April 2026"`.
fn period_label_for(period_from: &chrono::DateTime<Utc>) -> String {
    period_from.format("%B %Y").to_string()
}

/// Display name for the employee snapshot: `displayName` when set,
/// otherwise `"first last"`.
fn employee_display_name(emp: &Employee) -> String {
    emp.personal
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| {
            format!(
                "{} {}",
                emp.personal.first_name.trim(),
                emp.personal.last_name.trim()
            )
            .trim()
            .to_owned()
        })
}

/// Response for [`generate_payslips`].
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePayslipsResponse {
    /// Employee rows processed (upserted or refreshed).
    pub generated: u32,
    /// Employee rows skipped (missing employee document).
    pub skipped: u32,
    /// `_id`s of every payslip belonging to this run (hex), after the
    /// upsert pass.
    pub payslip_ids: Vec<String>,
}

/// `POST /v1/hrm/payroll-runs/:runId/generate-payslips` (people-suite
/// WI-7) — freeze one rich [`Payslip`] per [`EmployeeRunRow`] into
/// `crm_payslips`.
///
/// **Status guard:** the run must be `approved` or `disbursed`.
///
/// **Snapshot sources:**
/// - employee snapshot (name, designation, department label, PAN/UAN/
///   ESIC, joining date) from `crm_employees` (+ `crm_departments` for
///   the label), read under the SAME resolved scope as the run — a
///   Project-mounted generate only sees that project's roster (§3.3);
/// - header `companyName` from the scope's `crm_payroll_settings`
///   document (fallback `"Company"`);
/// - `netPayInWords` via [`rupees_in_words`];
/// - bank snapshot from `Employee.personal.bank` with the account
///   number masked at write-time ([`mask_account_no`]).
///
/// **Idempotency:** upsert keyed on
/// `{<scope>, runId, employeeId}` — re-invoking refreshes the frozen
/// snapshot instead of minting duplicates. Rows whose employee document
/// has vanished are skipped with a warning (never a 500).
#[instrument(skip_all, fields(user_id = %user.user_id, run_id = %run_id))]
pub async fn generate_payslips(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(run_id): Path<String>,
    Query(scope_q): Query<ScopeQuery>,
) -> Result<Json<GeneratePayslipsResponse>> {
    let scope = resolve_scope(mode, &user, scope_q.project_id.as_deref())?;
    let user_id = user_oid(&user)?;
    let run_oid = oid_from_str(&run_id)?;

    // ---- Load + status guard --------------------------------------
    let runs = mongo.collection::<PayrollRun>(RUNS_COLL);
    let mut filter = base_ownership_filter(&scope);
    filter.insert("_id", run_oid);
    let run = runs
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_payroll_runs.find_one(generate-payslips)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("payrollRun".to_owned()))?;
    if !matches!(
        run.status,
        PayrollRunStatus::Approved | PayrollRunStatus::Disbursed
    ) {
        return Err(ApiError::Conflict(format!(
            "payroll run is '{}' — generate-payslips requires 'approved' or 'disbursed'",
            status_str(run.status)
        )));
    }

    // ---- Tenant context: settings (header) ------------------------
    // Cross-collection read — scoped (never a hardcoded userId).
    let settings_coll = mongo.collection::<Document>(PAYROLL_SETTINGS_COLL);
    let mut settings_filter = scope.filter();
    settings_filter.insert("status", doc! { "$ne": "archived" });
    let company_name = settings_coll
        .find_one(settings_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payroll_settings.find_one"))
        })?
        .and_then(|d| d.get_str("companyName").ok().map(str::to_owned))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Company".to_owned());
    let period_label = period_label_for(&run.period_from);

    // ---- Roster snapshot -------------------------------------------
    let employee_ids: Vec<ObjectId> = run.employees.iter().map(|r| r.employee_id).collect();
    let employees_coll = mongo.collection::<Employee>(EMPLOYEES_COLL);
    let mut emp_filter = scope.filter();
    emp_filter.insert("_id", doc! { "$in": employee_ids.clone() });
    let cursor = employees_coll
        .find(emp_filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.find")))?;
    let employees: Vec<Employee> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_employees.collect")))?;
    let by_id: std::collections::HashMap<ObjectId, &Employee> = employees
        .iter()
        .map(|e| (e.identity.id, e))
        .collect();

    // Department labels (scoped read; misses resolve to None).
    let departments_coll = mongo.collection::<Document>(DEPARTMENTS_COLL);
    let mut department_labels: std::collections::HashMap<ObjectId, String> =
        std::collections::HashMap::new();
    for emp in &employees {
        let dep_id = emp.employment.department_id;
        if department_labels.contains_key(&dep_id) {
            continue;
        }
        let mut dep_filter = scope.filter();
        dep_filter.insert("_id", dep_id);
        if let Ok(Some(dep)) = departments_coll.find_one(dep_filter).await {
            if let Ok(name) = dep.get_str("name") {
                department_labels.insert(dep_id, name.to_owned());
            }
        }
    }

    // ---- Upsert one rich payslip per run row -----------------------
    let payslips_coll = mongo.collection::<Document>(PAYSLIPS_COLL);
    let mut generated: u32 = 0;
    let mut skipped: u32 = 0;
    for row in &run.employees {
        let Some(emp) = by_id.get(&row.employee_id) else {
            tracing::warn!(
                employee_id = %row.employee_id,
                "run row references a missing employee; skipping payslip",
            );
            skipped += 1;
            continue;
        };

        let bank_info = match &emp.personal.bank {
            Some(b) => PayslipBankInfo {
                bank_name: b.bank_name.clone(),
                account_no_masked: mask_account_no(&b.account_no),
                ifsc: b.ifsc.clone(),
                name_on_account: b.name_on_account.clone(),
            },
            None => PayslipBankInfo {
                bank_name: String::new(),
                account_no_masked: String::new(),
                ifsc: String::new(),
                name_on_account: String::new(),
            },
        };
        let tax_paid: f64 = row
            .deductions
            .iter()
            .filter(|d| d.code.eq_ignore_ascii_case("TDS"))
            .map(|d| d.amount)
            .sum();

        let payslip = Payslip {
            identity: Identity {
                id: ObjectId::new(),
                // The run's own project scope — equals the resolved
                // request scope on the project mount.
                project_id: run.identity.project_id,
                // Stamped `userId` is the caller (auditing) on the
                // project mount; on the legacy mount it equals the
                // tenant root, preserving user-scope visibility.
                user_id,
                tenant_id: None,
            },
            audit: Audit::new(Some(user_id)),
            run_id: run.identity.id,
            employee_id: row.employee_id,
            period_from: run.period_from,
            period_to: run.period_to,
            header: PayslipHeader {
                company_name: company_name.clone(),
                company_logo_file_id: None,
                period_label: period_label.clone(),
            },
            employee_snapshot: PayslipEmployee {
                employee_id: row.employee_id,
                name: employee_display_name(emp),
                designation: Some(emp.employment.designation.clone())
                    .filter(|s| !s.trim().is_empty()),
                department: department_labels.get(&emp.employment.department_id).cloned(),
                employment_id: emp.employment.employee_id.clone(),
                joining_date: Some(emp.employment.joining_date),
                pan: emp.personal.identity_docs.pan.clone(),
                uan: emp.personal.uan.clone(),
                esic: emp.personal.esic_no.clone(),
            },
            earnings: row
                .earnings
                .iter()
                .map(|l| PayslipEarningLine {
                    code: l.code.clone(),
                    label: l.label.clone(),
                    amount: l.amount,
                })
                .collect(),
            deductions: row
                .deductions
                .iter()
                .map(|l| PayslipDeductionLine {
                    code: l.code.clone(),
                    label: l.label.clone(),
                    amount: l.amount,
                })
                .collect(),
            reimbursements: row
                .reimbursements
                .iter()
                .map(|l| PayslipReimbursementLine {
                    category: l.category.clone(),
                    amount: l.amount,
                    claim_id: l.claim_id,
                })
                .collect(),
            net_pay: row.net,
            net_pay_in_words: rupees_in_words(row.net),
            // Initial cut: current-period rollup (a true FY aggregate
            // needs the year's other runs — separate work item).
            ytd: PayslipYtd {
                gross: row.gross,
                net: row.net,
                tax_paid,
            },
            attendance_summary: PayslipAttendanceSummary::default(),
            leave_balance_snapshot: serde_json::Value::Null,
            bank_info_snapshot: bank_info,
            signature_file_id: None,
            watermark_file_id: None,
            locked: true,
            sent: false,
            sent_at: None,
            downloaded_log: Vec::new(),
        };

        let mut payslip_doc = bson::to_document(&payslip).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.bson(payslip)"))
        })?;
        // Idempotency: identity + creation stamps survive a re-run.
        let mut set_on_insert = Document::new();
        for key in ["_id", "createdAt", "createdBy"] {
            if let Some(v) = payslip_doc.remove(key) {
                set_on_insert.insert(key, v);
            }
        }
        let mut upsert_filter = scope.filter();
        upsert_filter.insert("runId", run.identity.id);
        upsert_filter.insert("employeeId", row.employee_id);
        payslips_coll
            .update_one(
                upsert_filter,
                doc! { "$set": payslip_doc, "$setOnInsert": set_on_insert },
            )
            .upsert(true)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.upsert"))
            })?;
        generated += 1;
    }

    // ---- Collect the run's payslip ids ------------------------------
    let mut ids_filter = scope.filter();
    ids_filter.insert("runId", run.identity.id);
    let cursor = payslips_coll
        .find(ids_filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.find(ids)")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_payslips.collect(ids)"))
        })?;
    let payslip_ids: Vec<String> = docs
        .iter()
        .filter_map(|d| d.get_object_id("_id").ok().map(|o| o.to_hex()))
        .collect();

    Ok(Json(GeneratePayslipsResponse {
        generated,
        skipped,
        payslip_ids,
    }))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use hrm_payroll_types::{CalcKind, ComponentType, Frequency, SalaryComponent};

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

    /// Test-only [`AuthUser`] with a valid 24-hex subject.
    fn fake_user(oid: &ObjectId) -> AuthUser {
        AuthUser {
            user_id: oid.to_hex(),
            tenant_id: String::new(),
            roles: Vec::new(),
        }
    }

    #[test]
    fn base_filter_excludes_archived_user_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::User(oid));
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        assert!(!f.contains_key("projectId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn base_filter_excludes_archived_project_scope() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(&TenantScope::Project(oid));
        assert_eq!(f.get_object_id("projectId").unwrap(), oid);
        assert!(!f.contains_key("userId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn resolve_scope_project_rejects_missing_project_id() {
        // The `project_router` mount attaches `ScopeMode::Project`; a
        // request without `projectId` must 4xx (mirrors the
        // `crm-core::scope` tests).
        let user = fake_user(&ObjectId::new());
        let err = resolve_scope(ScopeMode::Project, &user, None).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
        let err = resolve_scope(ScopeMode::Project, &user, Some("not-an-oid")).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
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
    fn rupees_in_words_speaks_indian_format() {
        // WI-7: the fixture suite (§6) asserts `netPayInWords` is
        // non-empty and correct for the canonical run rows.
        assert_eq!(rupees_in_words(0.0), "Zero Rupees Only");
        assert_eq!(
            rupees_in_words(98_000.0),
            "Ninety Eight Thousand Rupees Only"
        );
        assert_eq!(
            rupees_in_words(48_000.0),
            "Forty Eight Thousand Rupees Only"
        );
        assert_eq!(
            rupees_in_words(1_23_45_678.0),
            "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only"
        );
        assert_eq!(rupees_in_words(100.0), "One Hundred Rupees Only");
        assert_eq!(
            rupees_in_words(59_700.0),
            "Fifty Nine Thousand Seven Hundred Rupees Only"
        );
        // Paise round to the nearest rupee; negatives don't panic.
        assert_eq!(rupees_in_words(10.4), "Ten Rupees Only");
        assert_eq!(rupees_in_words(-200.0), "Minus Two Hundred Rupees Only");
    }

    #[test]
    fn mask_account_no_keeps_last_four() {
        assert_eq!(mask_account_no("12345678901234"), "XXXXXX1234");
        assert_eq!(mask_account_no("9876"), "XXXXXX9876");
        assert_eq!(mask_account_no("42"), "XXXXXX42");
        assert_eq!(mask_account_no("   "), "");
    }

    #[test]
    fn period_label_formats_month_year() {
        let d = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(period_label_for(&d), "April 2026");
    }

    #[test]
    fn legacy_flat_structure_doc_fails_rich_deserialization() {
        // The graceful-skip in compute() relies on the flat gen-2
        // `CrmSalaryStructure` shape FAILING `bson::from_document::<
        // SalaryStructure>` (missing `name` / `effectiveDate`). Lock
        // that contract in so a future model change that silently
        // accepts the flat shape (and mis-computes) trips this test.
        let flat = doc! {
            "_id": ObjectId::new(),
            "userId": ObjectId::new(),
            "employeeId": ObjectId::new(),
            "basic": 20_000.0,
            "hra": 10_000.0,
            "da": 0.0,
            "otherAllowances": 5_000.0,
            "pfEmployer": 1_800.0,
            "pfEmployee": 1_800.0,
            "status": "active",
        };
        let res = bson::from_document::<SalaryStructure>(flat);
        assert!(res.is_err(), "flat doc must NOT decode as the rich shape");
    }

    #[test]
    fn status_str_round_trips() {
        assert_eq!(status_str(PayrollRunStatus::Draft), "draft");
        assert_eq!(status_str(PayrollRunStatus::Processing), "processing");
        assert_eq!(status_str(PayrollRunStatus::Approved), "approved");
        assert_eq!(status_str(PayrollRunStatus::Disbursed), "disbursed");
        assert_eq!(status_str(PayrollRunStatus::Closed), "closed");
    }

    #[test]
    fn parse_status_accepts_all_legal_values() {
        for s in &["draft", "processing", "approved", "disbursed", "closed"] {
            let parsed = parse_status(Some(&(*s).to_owned())).unwrap();
            assert!(parsed.is_some(), "{s} should parse");
        }
    }

    #[test]
    fn parse_status_returns_none_for_empty() {
        assert!(parse_status(None).unwrap().is_none());
        assert!(parse_status(Some(&"".to_owned())).unwrap().is_none());
        assert!(parse_status(Some(&"   ".to_owned())).unwrap().is_none());
    }

    #[test]
    fn parse_status_rejects_garbage() {
        let err = parse_status(Some(&"bogus".to_owned())).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn bank_file_format_round_trips() {
        for (s, f) in [
            ("neft", BankFileFormat::Neft),
            ("imps", BankFileFormat::Imps),
            ("rtgs", BankFileFormat::Rtgs),
            ("upi_bulk", BankFileFormat::UpiBulk),
        ] {
            let parsed = parse_bank_file_format(s).unwrap();
            // Compare via the wire form since BankFileFormat doesn't
            // derive PartialEq universally — round-trip the string.
            assert_eq!(bank_file_format_str(parsed), s);
            assert_eq!(bank_file_format_str(f), s);
        }
    }

    #[test]
    fn parse_bank_file_format_rejects_garbage() {
        let err = parse_bank_file_format("swift").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    fn fixed(amount: f64, code: &str, ctype: ComponentType) -> SalaryComponent {
        SalaryComponent {
            name: code.to_string(),
            code: code.to_string(),
            component_type: ctype,
            calc: CalcKind::Fixed { amount },
            taxable: false,
            statutory: false,
            prorate: false,
            frequency: Frequency::Monthly,
            max_cap: None,
            min_cap: None,
        }
    }

    #[test]
    fn resolve_amount_handles_fixed() {
        let comp = fixed(12_500.0, "BONUS", ComponentType::Earning);
        assert_eq!(resolve_amount(&comp, 40_000.0, 80_000.0), 12_500.0);
    }

    #[test]
    fn resolve_amount_honours_caps() {
        let mut comp = fixed(12_500.0, "BONUS", ComponentType::Earning);
        comp.max_cap = Some(10_000.0);
        assert_eq!(resolve_amount(&comp, 40_000.0, 80_000.0), 10_000.0);
        comp.max_cap = None;
        comp.min_cap = Some(15_000.0);
        assert_eq!(resolve_amount(&comp, 40_000.0, 80_000.0), 15_000.0);
    }

    #[test]
    fn resolve_amount_percent_basic() {
        let comp = SalaryComponent {
            name: "HRA".into(),
            code: "HRA".into(),
            component_type: ComponentType::Earning,
            calc: CalcKind::PercentBasic { pct: 50.0 },
            taxable: true,
            statutory: false,
            prorate: true,
            frequency: Frequency::Monthly,
            max_cap: None,
            min_cap: None,
        };
        assert_eq!(resolve_amount(&comp, 40_000.0, 80_000.0), 20_000.0);
    }

    #[test]
    fn resolve_amount_percent_ctc() {
        let comp = SalaryComponent {
            name: "Basic".into(),
            code: "BASIC".into(),
            component_type: ComponentType::Earning,
            calc: CalcKind::PercentCtc { pct: 40.0 },
            taxable: true,
            statutory: false,
            prorate: true,
            frequency: Frequency::Monthly,
            max_cap: None,
            min_cap: None,
        };
        assert_eq!(resolve_amount(&comp, 40_000.0, 80_000.0), 32_000.0);
    }

    #[test]
    fn resolve_amount_formula_min_pf_is_positive_and_exact() {
        // WI-6 / risk R2: the canonical statutory PF formula MUST
        // resolve to a real (non-zero) deduction. With basic = 40,000:
        // min(40000, 15000) * 0.12 = 1,800.
        let comp = SalaryComponent {
            name: "PF".into(),
            code: "PF".into(),
            component_type: ComponentType::Deduction,
            calc: CalcKind::Formula {
                expr: "min(BASIC, 15000) * 0.12".into(),
            },
            taxable: false,
            statutory: true,
            prorate: false,
            frequency: Frequency::Monthly,
            max_cap: Some(1_800.0),
            min_cap: None,
        };
        let pf = resolve_amount(&comp, 40_000.0, 80_000.0);
        // The fixture-verification suite (§6) fails loudly on
        // silent-zero formulas — assert pf > 0 first, then exactness.
        assert!(pf > 0.0, "PF must never silently resolve to zero");
        assert!((pf - 1_800.0).abs() < 1e-9);
    }

    #[test]
    fn formula_min_function_evaluates() {
        // min picks the smaller argument on either side.
        let v = eval_formula("min(BASIC, 15000) * 0.12", 40_000.0, 0.0).unwrap();
        assert!((v - 1_800.0).abs() < 1e-9);
        let v = eval_formula("min(basic, 15000) * 0.12", 10_000.0, 0.0).unwrap();
        assert!((v - 1_200.0).abs() < 1e-9);
    }

    #[test]
    fn formula_max_function_evaluates() {
        let v = eval_formula("max(basic, 25000)", 10_000.0, 0.0).unwrap();
        assert!((v - 25_000.0).abs() < 1e-9);
        let v = eval_formula("max(basic, 25000)", 60_000.0, 0.0).unwrap();
        assert!((v - 60_000.0).abs() < 1e-9);
    }

    #[test]
    fn formula_min_max_variadic_and_nested() {
        let v = eval_formula("min(3, 1, 2)", 0.0, 0.0).unwrap();
        assert!((v - 1.0).abs() < 1e-9);
        let v = eval_formula("max(min(basic, 15000), 500) + 1", 40_000.0, 0.0).unwrap();
        assert!((v - 15_001.0).abs() < 1e-9);
    }

    #[test]
    fn formula_min_max_reject_malformed_calls() {
        // Missing '(' after the function name.
        assert!(eval_formula("min 3, 4", 0.0, 0.0).is_err());
        // Unclosed argument list.
        assert!(eval_formula("min(3, 4", 0.0, 0.0).is_err());
        // Single-argument calls are almost certainly typos in payroll
        // formulas — rejected rather than passed through.
        assert!(eval_formula("min(3)", 0.0, 0.0).is_err());
    }

    #[test]
    fn resolve_amount_formula_supports_basic_multiply() {
        let comp = SalaryComponent {
            name: "PF".into(),
            code: "PF".into(),
            component_type: ComponentType::Deduction,
            calc: CalcKind::Formula {
                expr: "basic * 0.12".into(),
            },
            taxable: false,
            statutory: true,
            prorate: false,
            frequency: Frequency::Monthly,
            max_cap: None,
            min_cap: None,
        };
        // 40_000 * 0.12 = 4800.
        assert!((resolve_amount(&comp, 40_000.0, 80_000.0) - 4_800.0).abs() < 1e-9);
    }

    #[test]
    fn formula_handles_parens_and_subtract() {
        // (basic - 15000) * 0.5 evaluated against basic=40000 → 12500.
        let v = eval_formula("(basic - 15000) * 0.5", 40_000.0, 80_000.0).unwrap();
        assert!((v - 12_500.0).abs() < 1e-9);
    }

    #[test]
    fn formula_resolves_ctc_aliases() {
        let v = eval_formula("annualCtc / 12", 0.0, 60_000.0).unwrap();
        assert!((v - 60_000.0).abs() < 1e-9);
        let v = eval_formula("monthlyCtc + 500", 0.0, 50_000.0).unwrap();
        assert!((v - 50_500.0).abs() < 1e-9);
    }

    #[test]
    fn formula_unary_minus_and_precedence() {
        let v = eval_formula("-3 + 2 * 4", 0.0, 0.0).unwrap();
        assert!((v - 5.0).abs() < 1e-9);
    }

    #[test]
    fn formula_division_by_zero_errors() {
        let err = eval_formula("basic / 0", 100.0, 0.0).unwrap_err();
        assert!(err.contains("division by zero"));
    }

    #[test]
    fn formula_unknown_identifier_errors() {
        let err = eval_formula("hra * 0.5", 0.0, 0.0).unwrap_err();
        assert!(err.contains("unknown identifier"));
    }

    #[test]
    fn compute_employee_row_basics() {
        let structure = SalaryStructure {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            name: "Test".into(),
            effective_date: Utc::now(),
            components: vec![
                SalaryComponent {
                    name: "Basic".into(),
                    code: "BASIC".into(),
                    component_type: ComponentType::Earning,
                    calc: CalcKind::PercentCtc { pct: 50.0 },
                    taxable: true,
                    statutory: false,
                    prorate: true,
                    frequency: Frequency::Monthly,
                    max_cap: None,
                    min_cap: None,
                },
                SalaryComponent {
                    name: "HRA".into(),
                    code: "HRA".into(),
                    component_type: ComponentType::Earning,
                    calc: CalcKind::PercentBasic { pct: 50.0 },
                    taxable: true,
                    statutory: false,
                    prorate: true,
                    frequency: Frequency::Monthly,
                    max_cap: None,
                    min_cap: None,
                },
                fixed(2_000.0, "PT", ComponentType::Deduction),
            ],
            applicable_to: vec![],
            active: true,
        };
        // Annual CTC 1,200,000 → monthly 100,000.
        let row = compute_employee_row(ObjectId::new(), &structure, 1_200_000.0);
        // BASIC = 50% of 100,000 = 50,000. HRA = 50% of 50,000 = 25,000.
        assert_eq!(row.gross, 75_000.0);
        // PT = 2,000.
        assert_eq!(row.net, 73_000.0);
        assert_eq!(row.ctc, 100_000.0);
        assert_eq!(row.earnings.len(), 2);
        assert_eq!(row.deductions.len(), 1);
        assert!(row.reimbursements.is_empty());
    }

    #[test]
    fn compute_employee_row_falls_back_when_no_basic() {
        // Structure with no BASIC line — math should still produce a
        // sane number using the monthly_ctc / 2 fall-back.
        let structure = SalaryStructure {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            name: "NoBasic".into(),
            effective_date: Utc::now(),
            components: vec![SalaryComponent {
                name: "HRA".into(),
                code: "HRA".into(),
                component_type: ComponentType::Earning,
                calc: CalcKind::PercentBasic { pct: 50.0 },
                taxable: true,
                statutory: false,
                prorate: true,
                frequency: Frequency::Monthly,
                max_cap: None,
                min_cap: None,
            }],
            applicable_to: vec![],
            active: true,
        };
        let row = compute_employee_row(ObjectId::new(), &structure, 1_200_000.0);
        // Fall-back BASIC = 100k/2 = 50k. HRA = 50% of 50k = 25k.
        assert_eq!(row.gross, 25_000.0);
        assert_eq!(row.deductions.len(), 0);
    }

    #[test]
    fn _employment_status_active_serializes_lowercase() {
        // The `status: "active"` filter in compute() depends on the
        // EmploymentStatus enum's serde rename. Lock that contract in.
        assert_eq!(
            serde_json::to_string(&EmploymentStatus::Active).unwrap(),
            "\"active\""
        );
    }
}
