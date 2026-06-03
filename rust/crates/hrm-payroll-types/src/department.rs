//! §9.2 Departments / Designations — DTOs.
//!
//! Two separate Mongo collections:
//!   - `crm_departments` — `Department`
//!   - `crm_designations` — `Designation`
//!
//! Both flatten the `crm-core` cross-cutting `Identity` + `Audit`
//! fragments at the root so server-action queries can filter by
//! `userId` / `projectId` directly without an embedded path.
//!
//! Spec (§9.2 verbatim): Code, Name ★, Parent department, Head, Cost
//! center, Description, Active?, Color, Designation level/grade,
//! Min/Max CTC band, Reports-to designation.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== Department ===================== */

/// Org-chart node. `parent_department_id` enables nested hierarchies
/// (Engineering → Platform → Infra). `head_id` references an Employee
/// (`crm_employees`) and is intentionally a free `ObjectId` to avoid a
/// circular crate dependency with `Employee`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Department {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Short human code (e.g. "ENG", "FIN-AP"). Optional — small orgs
    /// may rely on `name` alone.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    pub name: String,

    /// Parent in the org tree. `None` means top-level.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_department_id: Option<ObjectId>,

    /// Department head — Employee `_id`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head_id: Option<ObjectId>,

    /// Cost-center code used by Finance for GL allocation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_center: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Soft on/off switch. Defaults to `true`; serialized only when
    /// `false` so existing records don't bloat with the default.
    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub active: bool,

    /// Tailwind / CSS color token. Free-form (e.g. "amber-500", "#22c55e").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/* ===================== Designation ===================== */

/// Job title / role. Distinct from `Department` because a role can
/// span departments (e.g. "Senior Engineer" exists in Eng + Data).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Designation {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    pub name: String,

    /// Department this designation typically reports under. Optional —
    /// shared roles (e.g. "Office Manager") may not pin to one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,

    /// Numeric level (e.g. 1 = junior, 5 = principal). `u8` is plenty
    /// for the depth of any real-world ladder.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,

    /// Free-form grade label (e.g. "L4", "M2", "Band B"). Kept as a
    /// string so vocabularies are tenant-configurable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grade: Option<String>,

    /// CTC band lower bound (annual, in tenant currency).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_ctc: Option<f64>,
    /// CTC band upper bound.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_ctc: Option<f64>,

    /// Designation this role reports into in the role hierarchy
    /// (distinct from the manager-employee link, which lives on
    /// `Employee`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reports_to_designation_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub active: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

fn is_true(b: &bool) -> bool {
    *b
}

fn true_default() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn department_round_trip_flattens_fragments() {
        let dept = Department {
            identity: sample_identity(),
            audit: Audit::new(None),
            code: Some("ENG".into()),
            name: "Engineering".into(),
            parent_department_id: None,
            head_id: Some(ObjectId::new()),
            cost_center: Some("CC-1001".into()),
            description: Some("Builds the product.".into()),
            active: true,
            color: Some("amber-500".into()),
        };

        let json = serde_json::to_value(&dept).unwrap();
        // Identity + Audit flattened to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // camelCase entity-specific fields.
        assert!(json.get("parentDepartmentId").is_none(), "None should skip");
        assert!(json.get("headId").is_some());
        assert!(json.get("costCenter").is_some());
        assert_eq!(
            json.get("name").and_then(|v| v.as_str()),
            Some("Engineering")
        );
        // Default-true `active` is skipped.
        assert!(
            json.get("active").is_none(),
            "true active should skip-serialize"
        );

        // Round-trip back.
        let back: Department = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Engineering");
        assert!(back.active, "active defaults back to true");
    }

    #[test]
    fn designation_round_trip_flattens_fragments() {
        let role = Designation {
            identity: sample_identity(),
            audit: Audit::new(None),
            code: Some("SE3".into()),
            name: "Senior Engineer".into(),
            department_id: Some(ObjectId::new()),
            level: Some(4),
            grade: Some("L4".into()),
            min_ctc: Some(2_400_000.0),
            max_ctc: Some(3_600_000.0),
            reports_to_designation_id: Some(ObjectId::new()),
            description: None,
            active: false,
            color: None,
        };

        let json = serde_json::to_value(&role).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("departmentId").is_some());
        assert!(json.get("minCtc").is_some());
        assert!(json.get("maxCtc").is_some());
        assert!(json.get("reportsToDesignationId").is_some());
        // `active = false` differs from default and IS emitted.
        assert_eq!(json.get("active").and_then(|v| v.as_bool()), Some(false));

        let back: Designation = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Senior Engineer");
        assert_eq!(back.level, Some(4));
        assert!(!back.active);
    }
}
