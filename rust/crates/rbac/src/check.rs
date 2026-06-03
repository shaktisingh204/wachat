//! Effective-permissions check.
//!
//! Mirrors the TS `requirePermission(moduleKey, action, projectId?)` /
//! `getEffectivePermissionsForProject` flow in `src/lib/rbac-server.ts`,
//! but the Mongo-backed resolution of a user's effective permission map
//! is **conservatively stubbed** in this initial drop. Until a follow-up
//! sweep ports the full TS algorithm:
//!
//!  - Owner role short-circuits to true.
//!  - Any non-owner with an empty `permissions` map is denied.
//!
//! Production gating continues to flow through the TS server actions; the
//! Rust side calls this as a defense-in-depth check.

use std::collections::HashMap;

use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::action::Action;

/// Effective permissions for a user within a project (or tenant-wide).
///
/// Mirrors the TS `EffectivePermissions` shape in `src/lib/rbac.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectivePermissions {
    /// Role identifier as stored on the project membership doc.
    pub role: String,
    /// Workspace/account owner short-circuit. True ⇒ all checks pass.
    #[serde(rename = "isOwner")]
    pub is_owner: bool,
    /// `moduleKey` → granted actions.
    pub permissions: HashMap<String, Vec<Action>>,
    /// Optional plan ceiling — kept as opaque JSON until the TS shape lands.
    #[serde(
        default,
        rename = "planCeiling",
        skip_serializing_if = "Option::is_none"
    )]
    pub plan_ceiling: Option<serde_json::Value>,
}

impl EffectivePermissions {
    /// Convenience constructor for an owner-role user.
    pub fn owner(role: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            is_owner: true,
            permissions: HashMap::new(),
            plan_ceiling: None,
        }
    }

    /// Convenience constructor for a non-owner with no granted permissions.
    pub fn non_owner(role: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            is_owner: false,
            permissions: HashMap::new(),
            plan_ceiling: None,
        }
    }
}

/// Resolve a user's effective permissions for an optional project scope.
///
/// **Conservative stub**: returns owner if `AuthUser.roles` is empty or
/// contains "owner"/"admin"; otherwise an empty-permissions non-owner. The
/// TS path remains authoritative; a follow-up sweep will mirror the Mongo
/// reads in `getEffectivePermissionsForProject`.
pub async fn get_effective_permissions(
    _mongo: &MongoHandle,
    user: &AuthUser,
    _project_id: Option<&str>,
) -> Result<EffectivePermissions> {
    if user.roles.is_empty()
        || user.roles.iter().any(|r| {
            let lc = r.to_ascii_lowercase();
            lc == "owner" || lc == "admin"
        })
    {
        // Tenant root has no membership row yet → treat as owner.
        return Ok(EffectivePermissions::owner(
            user.roles
                .first()
                .cloned()
                .unwrap_or_else(|| "owner".into()),
        ));
    }

    // TODO: port `getEffectivePermissionsForProject` from src/lib/rbac-server.ts
    //       once the project_members + role_permissions Mongo collections
    //       have a Rust-side reader. Conservative default: deny everything.
    warn!(
        user_id = %user.user_id,
        "rbac::get_effective_permissions stubbed — TS path remains authoritative",
    );
    Ok(EffectivePermissions::non_owner(
        user.roles
            .first()
            .cloned()
            .unwrap_or_else(|| "member".into()),
    ))
}

/// Pure-function check against an already-resolved [`EffectivePermissions`].
pub fn can(effective: &EffectivePermissions, module_key: &str, action: Action) -> bool {
    if effective.is_owner {
        return true;
    }
    match effective.permissions.get(module_key) {
        Some(actions) => actions.contains(&action),
        None => false,
    }
}

fn pretty_module_label(module_key: &str) -> String {
    module_key
        .split('_')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_ascii_uppercase().to_string() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Gate a handler on a permission. Returns `Ok(effective)` when allowed,
/// `ApiError::Forbidden` when not.
///
/// ```ignore
///   let effective = require_permission(&mongo, &user, permissions::sales_tx::INVOICE, Action::Create, None).await?;
/// ```
pub async fn require_permission(
    mongo: &MongoHandle,
    user: &AuthUser,
    module_key: &str,
    action: Action,
    project_id: Option<&str>,
) -> Result<EffectivePermissions> {
    let effective = get_effective_permissions(mongo, user, project_id).await?;
    if !can(&effective, module_key, action) {
        return Err(ApiError::Forbidden(format!(
            "You don't have permission to {action} {label}.",
            label = pretty_module_label(module_key),
        )));
    }
    Ok(effective)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pretty_label_capitalizes() {
        assert_eq!(pretty_module_label("crm_invoice"), "Crm Invoice");
        assert_eq!(
            pretty_module_label("crm_purchase_order"),
            "Crm Purchase Order",
        );
    }

    #[test]
    fn can_owner_always_true() {
        let e = EffectivePermissions::owner("owner");
        for a in Action::ALL {
            assert!(can(&e, "anything", a));
        }
    }

    #[test]
    fn can_non_owner_respects_map() {
        let mut e = EffectivePermissions::non_owner("member");
        e.permissions
            .insert("crm_invoice".into(), vec![Action::View, Action::Create]);
        assert!(can(&e, "crm_invoice", Action::View));
        assert!(can(&e, "crm_invoice", Action::Create));
        assert!(!can(&e, "crm_invoice", Action::Edit));
        assert!(!can(&e, "crm_invoice", Action::Delete));
        assert!(!can(&e, "crm_lead", Action::View));
    }
}
