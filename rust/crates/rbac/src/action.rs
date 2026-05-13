//! Permission verb. Mirrors the TS `PermissionAction` union in
//! `src/lib/permissions/types.ts`.
//!
//! Note `Edit` (not `Update`) — matches the TS shape so a single moduleKey
//! action pair encodes the same gate on both sides.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    View,
    Create,
    Edit,
    Delete,
}

impl Action {
    /// All variants, useful for exhaustive iteration.
    pub const ALL: [Action; 4] = [Action::View, Action::Create, Action::Edit, Action::Delete];

    /// Wire string used by the TS side (`'view' | 'create' | 'edit' | 'delete'`).
    pub fn as_str(self) -> &'static str {
        match self {
            Action::View => "view",
            Action::Create => "create",
            Action::Edit => "edit",
            Action::Delete => "delete",
        }
    }
}

impl std::fmt::Display for Action {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
