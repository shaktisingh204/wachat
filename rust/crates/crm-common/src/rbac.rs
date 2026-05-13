//! Thin re-export layer over `sabnode-rbac`.
//!
//! Lets per-entity crates write `crm_common::rbac::require_permission(...)`
//! without each adding `sabnode-rbac` to their `Cargo.toml`.

pub use sabnode_rbac::{
    Action, EffectivePermissions, can, get_effective_permissions, require_permission,
};
