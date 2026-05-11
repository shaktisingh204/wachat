//! `createdAt`, `updatedAt`, `createdBy`, `updatedBy` — automatic audit
//! trail. Server actions stamp `created*` once on insert and refresh
//! `updated*` on every write.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Audit {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,

    /// Who created the doc. `None` covers system jobs, migrations and
    /// public-form submissions where no authenticated actor exists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,

    /// Who last touched the doc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_by: Option<ObjectId>,
}

impl Audit {
    /// Build an `Audit` for a freshly inserted document. `actor` becomes
    /// both `createdBy` and `updatedBy`; pass `None` for system writes.
    pub fn new(actor: Option<ObjectId>) -> Self {
        let now = Utc::now();
        Self {
            created_at: now,
            updated_at: now,
            created_by: actor,
            updated_by: actor,
        }
    }

    /// Refresh `updatedAt` and `updatedBy` for an in-place write.
    pub fn touch(&mut self, actor: Option<ObjectId>) {
        self.updated_at = Utc::now();
        self.updated_by = actor;
    }
}
