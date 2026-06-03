//! §12.10 Customer / Vendor / Employee Portals.
//!
//! Two top-level entities live in this module:
//! - `PortalUser` (Mongo collection `crm_portal_users`) — a self-serve
//!   login row that links an external counterparty (customer, vendor) or
//!   an internal employee to a CRM-scoped credential and a capability
//!   list. The portal hands out time-boxed sessions to these users so
//!   they can pull invoices / payslips / Form 16, raise tickets, approve
//!   quotes, accept e-sign, update their KYC, view balance, request
//!   leave (employee), or apply to leads (vendor).
//! - `PortalSession` (Mongo collection `crm_portal_sessions`) — one
//!   active or revoked browser session for a `PortalUser`. Captures
//!   start/expiry, IP, user-agent, and a manual revoke flag so admins
//!   can yank sessions without rotating the password.
//!
//! Each struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================== */
/*  Portal user                                                    */
/* ============================================================== */

/// Which CRM counterparty the portal user impersonates. Drives the
/// menu surface and the capabilities the integrator may grant
/// (employees get payslip/leave; vendors get lead-apply; customers get
/// the standard invoice/quote/ticket trio).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PortalUserKind {
    #[default]
    Customer,
    Vendor,
    Employee,
}

/// Per-action permission. The set is closed: every portal feature shipped
/// today maps to one of these flags. New capabilities are added to this
/// enum (not stored as free-form strings) so admin UIs can enumerate the
/// full grant surface.
///
/// Multi-word variants serialize as `snake_case` (`view_invoices`,
/// `download_payslips`, …) to match the §0 enum convention.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortalCapability {
    ViewInvoices,
    DownloadPayslips,
    DownloadForm16,
    RaiseTicket,
    ApproveQuote,
    AcceptEsign,
    UpdateKyc,
    ViewBalance,
    RequestLeave,
    ApplyToLeads,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalUser {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- principal -------------------------------------------- */
    pub user_kind: PortalUserKind,
    /// FK into the linked counterparty doc — `crm_clients._id` for a
    /// customer, `crm_vendors._id` for a vendor, `crm_employees._id` for
    /// an employee. The collection follows from `user_kind`.
    pub linked_entity_id: ObjectId,

    /* ----- credentials ------------------------------------------ */
    pub login_email: String,
    /// Pointer (e.g. KMS key id, secret-vault path) to the actual hash.
    /// The hash itself is never persisted in this document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password_hash_ref: Option<String>,

    /* ----- grants ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<PortalCapability>,

    /* ----- bookkeeping ------------------------------------------ */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_login_at: Option<DateTime<Utc>>,
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub active: bool,
}

/* ============================================================== */
/*  Portal session                                                 */
/* ============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalSession {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- session window --------------------------------------- */
    pub portal_user_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub started_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub expires_at: DateTime<Utc>,

    /* ----- forensic context ------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,

    /* ----- admin override --------------------------------------- */
    #[serde(default, skip_serializing_if = "is_false")]
    pub revoked: bool,
}

/* ============================================================== */
/*  Helpers                                                        */
/* ============================================================== */

fn default_true() -> bool {
    true
}

fn is_true(b: &bool) -> bool {
    *b
}

fn is_false(b: &bool) -> bool {
    !*b
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn portal_user_round_trips_with_flattened_fragments() {
        let user = PortalUser {
            identity: identity(),
            audit: audit(),
            user_kind: PortalUserKind::Employee,
            linked_entity_id: ObjectId::new(),
            login_email: "ann@example.com".to_string(),
            password_hash_ref: Some("vault://crm/portal/ann".to_string()),
            capabilities: vec![
                PortalCapability::DownloadPayslips,
                PortalCapability::DownloadForm16,
                PortalCapability::RequestLeave,
            ],
            last_login_at: Some(Utc::now()),
            active: true,
        };

        let json = serde_json::to_value(&user).unwrap();

        // Flattened crm-core fragments live at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // Nested fragment keys must NOT exist.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // Entity-specific camelCase fields.
        assert!(json.get("userKind").is_some());
        assert!(json.get("linkedEntityId").is_some());
        assert!(json.get("loginEmail").is_some());
        assert!(json.get("passwordHashRef").is_some());
        assert!(json.get("lastLoginAt").is_some());
        // Enum serialization.
        assert_eq!(json.get("userKind").unwrap(), "employee");
        let caps = json.get("capabilities").unwrap().as_array().unwrap();
        assert_eq!(caps[0], "download_payslips");
        assert_eq!(caps[1], "download_form16");
        assert_eq!(caps[2], "request_leave");

        let back: PortalUser = serde_json::from_value(json).unwrap();
        assert_eq!(back.login_email, "ann@example.com");
        assert!(matches!(back.user_kind, PortalUserKind::Employee));
        assert_eq!(back.capabilities.len(), 3);
    }

    #[test]
    fn portal_session_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let session = PortalSession {
            identity: identity(),
            audit: audit(),
            portal_user_id: ObjectId::new(),
            started_at: now,
            expires_at: now,
            ip: Some("203.0.113.7".to_string()),
            user_agent: Some("Mozilla/5.0".to_string()),
            revoked: false,
        };

        let json = serde_json::to_value(&session).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("portalUserId").is_some());
        assert!(json.get("startedAt").is_some());
        assert!(json.get("expiresAt").is_some());
        assert!(json.get("userAgent").is_some());
        // Default false bool is skipped.
        assert!(json.get("revoked").is_none());

        let back: PortalSession = serde_json::from_value(json).unwrap();
        assert_eq!(back.ip.as_deref(), Some("203.0.113.7"));
        assert!(!back.revoked);
    }
}
