//! SabNode RBAC — Rust mirror of `src/lib/rbac-server.ts`.
//!
//! Two surfaces:
//!
//! 1. [`permissions`] enumerates every CRM permission `moduleKey` (snake_case)
//!    matching the TS world. ~140 keys total, grouped by module.
//! 2. [`check`] provides [`require_permission`], the Rust counterpart of the
//!    TS `requirePermission(moduleKey, action, projectId?)`.
//!
//! The on-disk effective-permissions read against Mongo is **stubbed
//! conservatively** in this initial drop — the TS path remains authoritative
//! until the Rust check is wired through. Owner-role short-circuits work
//! today; granular module checks return `Forbidden` for any non-owner caller.
//! A follow-up sweep will port the full TS algorithm (`src/lib/rbac.ts` ↔
//! `getEffectivePermissionsForProject`).

pub mod action;
pub mod check;
pub mod permissions;

pub use action::Action;
pub use check::{EffectivePermissions, can, get_effective_permissions, require_permission};
pub use permissions::ALL;

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn permissions_all_non_empty() {
        assert!(
            ALL.len() >= 130,
            "expected ~140 permission keys, got {}",
            ALL.len()
        );
    }

    #[test]
    fn permissions_all_snake_case() {
        for key in ALL {
            for ch in key.chars() {
                assert!(
                    ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_',
                    "permission key '{key}' contains non-snake-case char: {ch:?}",
                );
            }
        }
    }

    #[test]
    fn permissions_all_unique() {
        let set: HashSet<_> = ALL.iter().copied().collect();
        assert_eq!(set.len(), ALL.len(), "duplicate permission keys detected",);
    }

    #[test]
    fn owner_can_anything() {
        let owner = EffectivePermissions::owner("owner");
        assert!(can(&owner, "crm_invoice", Action::Create));
        assert!(can(&owner, "anything_else", Action::Delete));
    }

    #[test]
    fn non_owner_with_empty_perms_cannot() {
        let user = EffectivePermissions::non_owner("member");
        assert!(!can(&user, "crm_invoice", Action::Create));
        assert!(!can(&user, "crm_invoice", Action::View));
    }
}
