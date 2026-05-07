//! §9.7 Salary Structure.
//!
//! Mongo collection: `crm_salary_structures`. Defines the reusable
//! template of earning / deduction / reimbursement components that drive
//! a payroll run. A structure can be scoped to specific employees,
//! departments or grades via `applicable_to`.
//!
//! Each component carries its own `calc` strategy (fixed amount,
//! percentage of basic, percentage of CTC, or a custom formula
//! expression evaluated by the payroll engine), plus statutory /
//! taxable / proration flags and optional caps.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Whether a component adds to gross, subtracts from gross, or is a
/// reimbursable claim that flows through the run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentType {
    Earning,
    Deduction,
    Reimbursement,
}

/// How the component's amount is computed at run-time.
///
/// Stored as an externally-tagged enum keyed on `kind` so the JSON shape
/// stays self-describing for the TS engine that consumes it:
///   `{ "kind": "fixed", "amount": 25000 }`
///   `{ "kind": "percent_basic", "pct": 40.0 }`
///   `{ "kind": "percent_ctc", "pct": 12.0 }`
///   `{ "kind": "formula", "expr": "BASIC * 0.5 + 1500" }`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CalcKind {
    /// Flat amount per pay period.
    Fixed { amount: f64 },
    /// Percentage of the BASIC component for the same employee/period.
    PercentBasic { pct: f32 },
    /// Percentage of total CTC.
    PercentCtc { pct: f32 },
    /// Free-form expression evaluated by the payroll engine.
    Formula { expr: String },
}

/// How often the component fires within a payroll run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Frequency {
    #[default]
    Monthly,
    Quarterly,
    Annually,
}

/// Targeting rule for a structure. A structure can have many; the
/// payroll engine attaches it to an employee if any rule matches.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "lowercase")]
pub enum Applicability {
    /// Pinned to one employee.
    Employee(ObjectId),
    /// Whole department.
    Department(ObjectId),
    /// Free-text grade / band code (e.g. "L4", "M2").
    Grade(String),
}

/// One row of the structure's components table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryComponent {
    /// Display name (e.g. "House Rent Allowance").
    pub name: String,
    /// Stable short code used by formulas + payslip line items
    /// (e.g. "HRA", "BASIC", "PF").
    pub code: String,
    #[serde(rename = "type")]
    pub component_type: ComponentType,
    pub calc: CalcKind,
    /// Whether the amount is added to taxable income for TDS calc.
    #[serde(default, skip_serializing_if = "is_false")]
    pub taxable: bool,
    /// Whether this is a statutory line (PF / ESI / PT / TDS) — drives
    /// challan / return generation in §9.9 compliance.
    #[serde(default, skip_serializing_if = "is_false")]
    pub statutory: bool,
    /// Whether the amount prorates by working-day attendance when LOP
    /// occurs.
    #[serde(default, skip_serializing_if = "is_false")]
    pub prorate: bool,
    #[serde(default)]
    pub frequency: Frequency,
    /// Hard ceiling per period (e.g. ESI wage cap).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_cap: Option<f64>,
    /// Hard floor per period.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_cap: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryStructure {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- structure header -------------------------------------- */
    pub name: String,
    /// Date this structure version starts applying. Older runs continue
    /// to read whichever structure was active on their period.
    pub effective_date: DateTime<Utc>,

    /* ----- components + targeting -------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<SalaryComponent>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_to: Vec<Applicability>,

    /// Inactive structures are kept for historical runs but never
    /// auto-attached to new employees. Defaults to `true`.
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub active: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let s = SalaryStructure {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            name: "Default Engineering 2026".to_string(),
            effective_date: Utc::now(),
            components: vec![
                SalaryComponent {
                    name: "Basic".to_string(),
                    code: "BASIC".to_string(),
                    component_type: ComponentType::Earning,
                    calc: CalcKind::PercentCtc { pct: 40.0 },
                    taxable: true,
                    statutory: false,
                    prorate: true,
                    frequency: Frequency::Monthly,
                    max_cap: None,
                    min_cap: None,
                },
                SalaryComponent {
                    name: "House Rent Allowance".to_string(),
                    code: "HRA".to_string(),
                    component_type: ComponentType::Earning,
                    calc: CalcKind::PercentBasic { pct: 50.0 },
                    taxable: true,
                    statutory: false,
                    prorate: true,
                    frequency: Frequency::Monthly,
                    max_cap: None,
                    min_cap: None,
                },
                SalaryComponent {
                    name: "Provident Fund".to_string(),
                    code: "PF".to_string(),
                    component_type: ComponentType::Deduction,
                    calc: CalcKind::Formula {
                        expr: "min(BASIC, 15000) * 0.12".to_string(),
                    },
                    taxable: false,
                    statutory: true,
                    prorate: false,
                    frequency: Frequency::Monthly,
                    max_cap: Some(1800.0),
                    min_cap: None,
                },
            ],
            applicable_to: vec![
                Applicability::Department(ObjectId::new()),
                Applicability::Grade("L4".to_string()),
            ],
            active: true,
        };

        let json = serde_json::to_value(&s).unwrap();

        // §0 fragments flatten to root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("effectiveDate").is_some());
        assert!(json.get("applicableTo").is_some());

        // Components carry the "type" rename.
        let comps = json.get("components").and_then(|v| v.as_array()).unwrap();
        assert_eq!(comps[0]["type"], "earning");
        assert_eq!(comps[2]["type"], "deduction");

        // CalcKind serializes as { kind, ... }.
        assert_eq!(comps[0]["calc"]["kind"], "percent_ctc");
        assert_eq!(comps[1]["calc"]["kind"], "percent_basic");
        assert_eq!(comps[2]["calc"]["kind"], "formula");

        // Applicability serializes as { kind, id }.
        let app = json.get("applicableTo").and_then(|v| v.as_array()).unwrap();
        assert_eq!(app[0]["kind"], "department");
        assert_eq!(app[1]["kind"], "grade");
        assert_eq!(app[1]["id"], "L4");

        // Round-trip back to a struct.
        let back: SalaryStructure = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Default Engineering 2026");
        assert_eq!(back.components.len(), 3);
        assert!(back.active);
        match &back.components[2].calc {
            CalcKind::Formula { expr } => assert!(expr.contains("BASIC")),
            _ => panic!("expected formula"),
        }
    }
}
