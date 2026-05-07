//! `lineage[]` — chain of cross-document conversions tracking the
//! provenance of a record (Lead → Deal → Quotation → SO → Invoice etc.).
//! Mirrors §13.5 of `crm_function_plan.md`. The TS port enumerates 16
//! known kinds; we keep `kind` as a transparent string so adding a new
//! source doesn't require a crate edit.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineageRef {
    /// Logical entity kind ("lead", "deal", "quotation", "salesOrder",
    /// "invoice", "creditNote", "purchaseOrder", "bill", "grn", …).
    pub kind: String,
    pub id: ObjectId,
}

impl LineageRef {
    pub fn new(kind: impl Into<String>, id: ObjectId) -> Self {
        Self {
            kind: kind.into(),
            id,
        }
    }
}
