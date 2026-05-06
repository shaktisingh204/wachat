//! `attachments[]` — SabFile reference. Per the project's "every file
//! lives in SabFiles" policy (see `CLAUDE.md`), the only attachment type
//! a CRM entity carries is a SabFile pointer; raw URLs are forbidden.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    /// SabFiles document id. The single source of truth for the file —
    /// callers resolve `name` / `url` / `size` by joining `sabfiles` on
    /// this id when they need the live values.
    pub file_id: ObjectId,

    /// Cached human label captured at attach-time so listings don't need
    /// a per-row `$lookup`. Refresh via the SabFiles handlers when the
    /// file is renamed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Cached MIME type at attach-time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,

    /// Size in bytes at attach-time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}
