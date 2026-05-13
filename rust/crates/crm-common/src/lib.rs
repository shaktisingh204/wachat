//! Shared helpers used by every per-entity CRM Rust crate.
//!
//! Hoisted from `crm-leads` / `crm-deals` / etc. so new entity crates can
//! depend on `crm-common` instead of redefining the same tenant filter,
//! limit clamp, regex builder, and audit-event shape.
//!
//! Modules:
//!  - [`tenant`]     — extract `AuthUser → ObjectId` + canonical Mongo filter.
//!  - [`pagination`] — `DEFAULT_LIMIT`, `MAX_LIMIT`, `clamp_limit`, `skip_for`.
//!  - [`search`]     — regex escape + `$or` builder for `?q=…` searches.
//!  - [`audit`]      — `AuditEvent` shape + best-effort writer.
//!  - [`rbac`]       — thin forwarding layer over `sabnode-rbac::require_permission`.
//!  - [`lookup`]     — `CrmLookupAdapter` trait (forward-looking glue).

pub mod audit;
pub mod lookup;
pub mod pagination;
pub mod rbac;
pub mod search;
pub mod tenant;

pub use audit::{AuditEvent, audit_for_create, audit_for_delete, audit_for_update, write_audit};
pub use pagination::{DEFAULT_LIMIT, MAX_LIMIT, clamp_limit, skip_for};
pub use search::{build_q_filter, escape_regex};
pub use tenant::{tenant_filter, tenant_filter_with_archived, user_oid};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_defaults() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }

    #[test]
    fn clamp_limit_caps_at_max() {
        assert_eq!(clamp_limit(Some(500)), MAX_LIMIT);
        assert_eq!(clamp_limit(Some(0)), 1);
        assert_eq!(clamp_limit(Some(MAX_LIMIT as u32)), MAX_LIMIT);
    }

    #[test]
    fn escape_regex_escapes_metachars() {
        assert_eq!(escape_regex("a.b*c"), r"a\.b\*c");
        assert_eq!(escape_regex("user@example.com"), r"user@example\.com");
    }

    #[test]
    fn build_q_filter_makes_or_clause() {
        let f = build_q_filter("foo", &["name", "email"]);
        let or = f.get_array("$or").expect("$or array");
        assert_eq!(or.len(), 2);
    }

    #[test]
    fn tenant_filter_excludes_archived() {
        use bson::oid::ObjectId;
        let oid = ObjectId::new();
        let f = tenant_filter(oid);
        assert!(f.contains_key("archived"));
        assert!(f.contains_key("userId"));
    }
}
