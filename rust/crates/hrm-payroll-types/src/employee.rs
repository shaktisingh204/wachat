//! §9.1 Employees — the central HRM record.
//!
//! Mongo collection: `crm_employees`. The `Employee` struct flattens the
//! cross-cutting `crm-core` fragments (`Identity`, `Audit`, `Assignment`)
//! plus three composition fragments local to this module
//! (`PersonalProfile`, `EmploymentProfile`, `EmployeeDocuments`) so the
//! BSON document root carries every field directly — matching the TS
//! shape that the Next.js layer reads/writes today.
//!
//! The three composition fragments are kept as named sub-structs (not
//! inlined) so other §9 entities (payroll runs, payslips, attendance)
//! can reference / project a slice of an employee without dragging the
//! full record. The flatten lives on the parent so the on-the-wire shape
//! stays flat.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, CustomFields, Identity, Note, Tags};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

/* ============================================================
 *  Shared enums + small value structs
 * ============================================================ */

/// Self-described gender. `PreferNotToSay` is the explicit opt-out
/// (distinct from leaving the field absent, which means "not captured").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Gender {
    Male,
    Female,
    NonBinary,
    Other,
    PreferNotToSay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MaritalStatus {
    Single,
    Married,
    Divorced,
    Widowed,
    Separated,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmploymentType {
    #[default]
    FullTime,
    PartTime,
    Contract,
    Intern,
    Consultant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmploymentStatus {
    #[default]
    Active,
    OnLeave,
    Terminated,
    Resigned,
}

/// One child entry. `dob` is optional because guardians sometimes capture
/// only the name (e.g. for emergency-contact paperwork that predates a
/// child's birth certificate registration).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Child {
    pub name: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub dob: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender: Option<Gender>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmergencyContact {
    pub name: String,
    pub phone: String,
    /// Free-form relation label ("Spouse", "Mother", "Friend", …).
    pub relation: String,
}

/// Government identity numbers. Aadhaar is stored masked (only last
/// four digits) per the same privacy rule applied on `Client.aadhaarMasked`
/// in the sales module.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityDocs {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aadhaar_masked: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passport_no: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub passport_expiry: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub driving_licence: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voter_id: Option<String>,
}

/// Salary disbursement bank record. Account number + IFSC + name on
/// account are required so payroll runs never produce an unaddressable
/// NEFT row; bank name is required for human-readable payslips; branch
/// is optional (most IFSC look-up tools resolve it on demand).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankInfo {
    pub account_no: String,
    pub ifsc: String,
    pub bank_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    pub name_on_account: String,
}

/// Two postal addresses. Most employees have a single permanent address
/// matching `current`; we keep both because §9.1 calls them out separately
/// and India statutory paperwork (PF / KYC) references the permanent one.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeAddress {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permanent: Option<Address>,
}

/// One skill row. `level` is a free-form bucket label
/// ("beginner|intermediate|expert") so projects can map onto whatever
/// rubric their L&D function uses without changing the schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Certification {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuer: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub issued: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
    /// SabFile reference to the certificate scan.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Education {
    pub institution: String,
    pub degree: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field_of_study: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub start: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub end: Option<DateTime<Utc>>,
    /// Free-form grade ("8.4 CGPA", "First Class", "A+").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grade: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PastEmployment {
    pub company: String,
    pub role: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub start: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub end: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason_for_leaving: Option<String>,
}

/// Visa / immigration record. `visa_type` is the program label
/// ("H-1B", "L-1", "Tier-2", "Schengen"); `country` is required because
/// a visa with no destination country is not actionable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Visa {
    pub number: String,
    #[serde(rename = "visaType")]
    pub visa_type: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub issued: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub valid_till: Option<DateTime<Utc>>,
    pub country: String,
}

/* ============================================================
 *  Composition fragments — flattened into Employee
 * ============================================================ */

/// §9.1 "Personal" sub-section. Captured once at onboarding and edited
/// by the employee through the self-service profile page.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalProfile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salutation: Option<String>,
    pub first_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub middle_name: Option<String>,
    pub last_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    /// Required by §9.1.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub dob: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gender: Option<Gender>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub marital_status: Option<MaritalStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spouse: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Child>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blood_group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nationality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub religion: Option<String>,
    /// IETF BCP 47 tags.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub languages: Vec<String>,
    /// SabFile id for the profile photo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub photo_file_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_phone: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emergency_contact: Option<EmergencyContact>,

    #[serde(default)]
    pub identity_docs: IdentityDocs,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank: Option<BankInfo>,

    /// Universal Account Number (PF).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uan: Option<String>,
    /// ESIC (Employees' State Insurance) registration number.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esic_no: Option<String>,

    #[serde(default)]
    pub address: EmployeeAddress,
}

/// §9.1 "Employment" sub-section. The HR-side of the record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmploymentProfile {
    /// Tenant-issued employee code ("EMP-0001"). Required by §9.1.
    pub employee_id: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub joining_date: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub confirmation_date: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub probation_end: Option<DateTime<Utc>>,

    #[serde(default)]
    pub employment_type: EmploymentType,

    /// FK into the §9.2 Departments collection.
    pub department_id: ObjectId,
    /// Free-form designation label — title hierarchies are tenant-defined.
    pub designation: String,

    /// Self-FK to another `Employee._id`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reporting_manager_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dotted_line_manager_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_location: Option<String>,
    /// FK into the shifts collection (§9 settings).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_id: Option<ObjectId>,

    pub work_email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,

    /// FK list into the asset register. Tracks laptops, phones, access
    /// cards, etc. issued to the employee.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub asset_list: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills: Vec<Skill>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub certifications: Vec<Certification>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub education: Vec<Education>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub past_employment: Vec<PastEmployment>,

    /// FK into §9.7 Salary Structures. Required by §9.1.
    pub salary_structure_id: ObjectId,
    /// Cost-to-company (annual). Cached on the employee so list views
    /// don't have to join the salary structure on every render.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ctc: Option<f64>,
    /// Variable-pay percentage of CTC (0-100).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variable_pct: Option<f32>,
    /// Notice period in days.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notice_period_days: Option<u32>,

    #[serde(default)]
    pub status: EmploymentStatus,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub exit_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_reason: Option<String>,
}

/// §9.1 "Documents" sub-section. Each non-list field is a single SabFile
/// reference; the lists collect multi-doc categories (KYC, education,
/// id-proofs) that have no fixed cardinality.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeDocuments {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offer_letter_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub appointment_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contract_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nda_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kyc_files: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub education_cert_files: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub id_proof_files: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visa: Option<Visa>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_permit_file_id: Option<ObjectId>,
}

/* ============================================================
 *  Top-level entity
 * ============================================================ */

/// CRM/HRM Employee. Stored in `crm_employees`.
///
/// The struct flattens the §0 `crm-core` fragments AND the three §9.1
/// composition fragments so the document root has every field directly.
/// `Assignment.assignedTo` maps to the HR-person owning the file (the
/// person who manages this employee record administratively — not the
/// reporting manager, which is a separate field on `EmploymentProfile`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Employee {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- §9.1 sub-sections (flattened) ------------------------- */
    #[serde(flatten)]
    pub personal: PersonalProfile,
    #[serde(flatten)]
    pub employment: EmploymentProfile,
    #[serde(flatten)]
    pub documents: EmployeeDocuments,

    /* ----- bag-of-data fragments --------------------------------- */
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
    #[serde(default, skip_serializing_if = "CustomFields::is_empty")]
    pub custom_fields: CustomFields,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<Note>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_employee() -> Employee {
        Employee {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Assignment::default(),
            personal: PersonalProfile {
                salutation: Some("Mr.".into()),
                first_name: "Rahul".into(),
                middle_name: None,
                last_name: "Sharma".into(),
                display_name: Some("Rahul Sharma".into()),
                dob: Utc::now(),
                gender: Some(Gender::Male),
                marital_status: Some(MaritalStatus::Married),
                spouse: Some("Priya Sharma".into()),
                children: vec![Child {
                    name: "Anaya".into(),
                    dob: None,
                    gender: Some(Gender::Female),
                }],
                blood_group: Some("O+".into()),
                nationality: Some("Indian".into()),
                religion: None,
                languages: vec!["en".into(), "hi".into()],
                photo_file_id: None,
                personal_email: Some("rahul@personal.example".into()),
                personal_phone: Some("+91 9876543210".into()),
                emergency_contact: Some(EmergencyContact {
                    name: "Priya Sharma".into(),
                    phone: "+91 9876543211".into(),
                    relation: "Spouse".into(),
                }),
                identity_docs: IdentityDocs {
                    aadhaar_masked: Some("XXXX-XXXX-1234".into()),
                    pan: Some("ABCDE1234F".into()),
                    ..Default::default()
                },
                bank: Some(BankInfo {
                    account_no: "1234567890".into(),
                    ifsc: "HDFC0001234".into(),
                    bank_name: "HDFC Bank".into(),
                    branch: Some("Bengaluru MG Road".into()),
                    name_on_account: "Rahul Sharma".into(),
                }),
                uan: Some("100000000001".into()),
                esic_no: None,
                address: EmployeeAddress::default(),
            },
            employment: EmploymentProfile {
                employee_id: "EMP-0001".into(),
                joining_date: Utc::now(),
                confirmation_date: None,
                probation_end: None,
                employment_type: EmploymentType::FullTime,
                department_id: ObjectId::new(),
                designation: "Senior Engineer".into(),
                reporting_manager_id: Some(ObjectId::new()),
                dotted_line_manager_id: None,
                work_location: Some("Bengaluru".into()),
                shift_id: None,
                work_email: "rahul@acme.example".into(),
                work_phone: None,
                extension: None,
                asset_list: vec![ObjectId::new()],
                skills: vec![Skill {
                    name: "Rust".into(),
                    level: Some("expert".into()),
                }],
                certifications: vec![],
                education: vec![],
                past_employment: vec![],
                salary_structure_id: ObjectId::new(),
                ctc: Some(2_400_000.0),
                variable_pct: Some(15.0),
                notice_period_days: Some(60),
                status: EmploymentStatus::Active,
                exit_date: None,
                exit_reason: None,
            },
            documents: EmployeeDocuments::default(),
            tags: Tags::default(),
            custom_fields: CustomFields::default(),
            attachments: vec![],
            notes: vec![],
        }
    }

    #[test]
    fn cross_cutting_and_subsection_fragments_flatten_to_root() {
        let e = sample_employee();
        let json = serde_json::to_value(&e).unwrap();

        // crm-core fragments must flatten
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("assignment").is_none(), "Assignment must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // §9.1 sub-section fragments must also flatten (no nested keys)
        assert!(
            json.get("personal").is_none(),
            "PersonalProfile must flatten"
        );
        assert!(
            json.get("employment").is_none(),
            "EmploymentProfile must flatten"
        );
        assert!(
            json.get("documents").is_none(),
            "EmployeeDocuments must flatten"
        );

        // …and their fields land at the document root
        assert!(json.get("firstName").is_some());
        assert!(json.get("lastName").is_some());
        assert!(json.get("dob").is_some());
        assert!(json.get("employeeId").is_some());
        assert!(json.get("joiningDate").is_some());
        assert!(json.get("departmentId").is_some());
        assert!(json.get("designation").is_some());
        assert!(json.get("workEmail").is_some());
        assert!(json.get("salaryStructureId").is_some());
    }

    #[test]
    fn employment_type_serializes_snake_case() {
        let json = serde_json::to_string(&EmploymentType::FullTime).unwrap();
        assert_eq!(json, "\"full_time\"");

        let json = serde_json::to_string(&EmploymentType::PartTime).unwrap();
        assert_eq!(json, "\"part_time\"");

        let json = serde_json::to_string(&EmploymentStatus::OnLeave).unwrap();
        assert_eq!(json, "\"on_leave\"");

        let json = serde_json::to_string(&Gender::NonBinary).unwrap();
        assert_eq!(json, "\"non_binary\"");

        let json = serde_json::to_string(&Gender::PreferNotToSay).unwrap();
        assert_eq!(json, "\"prefer_not_to_say\"");
    }

    #[test]
    fn round_trips_through_serde_json() {
        let e = sample_employee();
        let json = serde_json::to_string(&e).unwrap();
        let back: Employee = serde_json::from_str(&json).unwrap();
        assert_eq!(back.personal.first_name, e.personal.first_name);
        assert_eq!(back.personal.last_name, e.personal.last_name);
        assert_eq!(back.employment.employee_id, e.employment.employee_id);
        assert_eq!(back.employment.designation, e.employment.designation);
        assert_eq!(back.employment.status, e.employment.status);
        assert_eq!(
            back.employment.employment_type,
            e.employment.employment_type
        );
        assert_eq!(back.personal.children.len(), 1);
        assert_eq!(back.personal.children[0].name, "Anaya");
    }
}
