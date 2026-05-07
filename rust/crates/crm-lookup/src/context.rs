//! Request-scoped tenant context the executor uses to filter every
//! query. Built upstream by auth middleware; the executor never reads
//! cookies / headers directly.

use bson::oid::ObjectId;
use crm_lookup_types::Scope;

#[derive(Debug, Clone)]
pub struct TenantCtx {
    /// Tenant root user. Mirrors the `userId` field every CRM/HRM
    /// document carries via `crm-core::Identity`.
    pub user_id: ObjectId,
    /// Project narrowing for multi-project tenants. `None` means "all
    /// projects under the tenant root".
    pub project_id: Option<ObjectId>,
    /// Defaults to `Scope::Tenant`. When the caller asks for
    /// `Scope::Project`, we additionally narrow on `project_id`.
    pub scope: Scope,
}

impl TenantCtx {
    pub fn new(user_id: ObjectId) -> Self {
        Self {
            user_id,
            project_id: None,
            scope: Scope::Tenant,
        }
    }

    pub fn with_project(mut self, project_id: ObjectId) -> Self {
        self.project_id = Some(project_id);
        self
    }

    pub fn with_scope(mut self, scope: Scope) -> Self {
        self.scope = scope;
        self
    }
}
