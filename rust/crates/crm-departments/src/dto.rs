//! Wire-format request DTOs for the §9.2 Department + Designation
//! endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`hrm_payroll_types::Department`] / [`hrm_payroll_types::Designation`]
//! DTO — we deliberately do not redeclare them here. The shapes below
//! describe only what callers send IN (create-input, update-input,
//! list-query); they are intentionally narrower than the full models
//! so the API surface stays controlled.
//!
//! Field naming follows §9.2 in `hrm-payroll-types/src/department.rs`.
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON requests
//! round-trip with the TS clients.

use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/* ============================================================== */
/* Department                                                     */
/* ============================================================== */

/// `GET /v1/crm/departments` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a department at a glance: `name`,
/// `code`, and `costCenter`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDepartmentsQuery {
    /// 1-indexed page. Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search.
    #[serde(default)]
    pub q: Option<String>,
}

/// `POST /v1/crm/departments` body. Drives the "Add Department" UI in
/// the HR setup module. Only `name` is required; everything else is
/// optional and matches the §9.2 spec verbatim (Code, Name ★, Parent
/// department, Head, Cost center, Description, Active?, Color).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDepartmentInput {
    /// Required human label ("Engineering", "Finance", "FIN-AP").
    pub name: String,

    /// Short human code (e.g. "ENG", "FIN-AP"). Optional — small orgs
    /// may rely on `name` alone.
    #[serde(default)]
    pub code: Option<String>,

    /// Parent in the org tree. `None` means top-level. 24-char hex.
    #[serde(default)]
    pub parent_department_id: Option<String>,

    /// Department head — Employee `_id`. 24-char hex.
    #[serde(default)]
    pub head_id: Option<String>,

    /// Cost-center code used by Finance for GL allocation.
    #[serde(default)]
    pub cost_center: Option<String>,

    #[serde(default)]
    pub description: Option<String>,

    /// Soft on/off switch. Defaults to `true` at create time when
    /// absent (handler resolves it).
    #[serde(default)]
    pub active: Option<bool>,

    /// Tailwind / CSS color token (e.g. "amber-500", "#22c55e").
    #[serde(default)]
    pub color: Option<String>,
}

/// `PATCH /v1/crm/departments/:departmentId` body. Every field is
/// optional; only the fields explicitly sent are modified on the
/// document. The handler always refreshes `updatedAt` regardless.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDepartmentInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_department_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_center: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

impl UpdateDepartmentInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.name.is_none()
            && self.code.is_none()
            && self.parent_department_id.is_none()
            && self.head_id.is_none()
            && self.cost_center.is_none()
            && self.description.is_none()
            && self.active.is_none()
            && self.color.is_none()
    }
}

/* ============================================================== */
/* Designation                                                    */
/* ============================================================== */

/// `GET /v1/crm/designations` query string.
///
/// `q` searches `name` / `code` / `grade`. `department_id` filters by
/// the parent department (24-char hex) so the HR UI can show only the
/// roles belonging to a selected department.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDesignationsQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// Optional filter: only return designations under this department.
    #[serde(default)]
    pub department_id: Option<String>,
}

/// `POST /v1/crm/designations` body. Drives the "Add Designation" UI.
/// Only `name` is required. Mirrors the §9.2 spec for designations:
/// Name ★, Code, Department, Level, Grade, Min/Max CTC, Reports-to,
/// Description, Active?, Color.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDesignationInput {
    /// Required human label ("Senior Engineer", "Office Manager").
    pub name: String,

    #[serde(default)]
    pub code: Option<String>,

    /// Department this designation typically reports under. 24-char hex.
    #[serde(default)]
    pub department_id: Option<String>,

    /// Numeric level (e.g. 1 = junior, 5 = principal).
    #[serde(default)]
    pub level: Option<u8>,

    /// Free-form grade label (e.g. "L4", "M2", "Band B").
    #[serde(default)]
    pub grade: Option<String>,

    /// CTC band lower bound (annual, in tenant currency).
    #[serde(default)]
    pub min_ctc: Option<f64>,
    /// CTC band upper bound.
    #[serde(default)]
    pub max_ctc: Option<f64>,

    /// Designation this role reports into in the role hierarchy.
    /// 24-char hex.
    #[serde(default)]
    pub reports_to_designation_id: Option<String>,

    #[serde(default)]
    pub description: Option<String>,

    #[serde(default)]
    pub active: Option<bool>,

    #[serde(default)]
    pub color: Option<String>,
}

/// `PATCH /v1/crm/designations/:designationId` body.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDesignationInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grade: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_ctc: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_ctc: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reports_to_designation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

impl UpdateDesignationInput {
    pub fn is_empty(&self) -> bool {
        self.name.is_none()
            && self.code.is_none()
            && self.department_id.is_none()
            && self.level.is_none()
            && self.grade.is_none()
            && self.min_ctc.is_none()
            && self.max_ctc.is_none()
            && self.reports_to_designation_id.is_none()
            && self.description.is_none()
            && self.active.is_none()
            && self.color.is_none()
    }
}

/* ============================================================== */
/* Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_department_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "name": "Engineering",
            "code": "ENG",
            "costCenter": "CC-1001",
            "color": "amber-500",
            "active": true,
        });
        let input: CreateDepartmentInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.name, "Engineering");
        assert_eq!(input.code.as_deref(), Some("ENG"));
        assert_eq!(input.cost_center.as_deref(), Some("CC-1001"));
        assert_eq!(input.color.as_deref(), Some("amber-500"));
        assert_eq!(input.active, Some(true));
    }

    #[test]
    fn update_department_input_is_empty_detects_all_unset() {
        let empty = UpdateDepartmentInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateDepartmentInput {
            cost_center: Some("CC-2002".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_departments_query_defaults_are_none() {
        let q: ListDepartmentsQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
    }

    #[test]
    fn create_designation_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "name": "Senior Engineer",
            "code": "SE3",
            "level": 4,
            "grade": "L4",
            "minCtc": 2_400_000.0,
            "maxCtc": 3_600_000.0,
        });
        let input: CreateDesignationInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.name, "Senior Engineer");
        assert_eq!(input.level, Some(4));
        assert_eq!(input.grade.as_deref(), Some("L4"));
        assert_eq!(input.min_ctc, Some(2_400_000.0));
        assert_eq!(input.max_ctc, Some(3_600_000.0));
    }

    #[test]
    fn update_designation_input_is_empty_detects_all_unset() {
        let empty = UpdateDesignationInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateDesignationInput {
            level: Some(5),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_designations_query_accepts_department_filter() {
        let q: ListDesignationsQuery = serde_json::from_value(
            serde_json::json!({ "departmentId": "65a0a0a0a0a0a0a0a0a0a0a0" }),
        )
        .unwrap();
        assert_eq!(q.department_id.as_deref(), Some("65a0a0a0a0a0a0a0a0a0a0a0"));
    }
}
