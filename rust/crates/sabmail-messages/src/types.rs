//! On-disk shape of `sabmail_messages`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailAddress {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// FK → `sabmail_accounts._id`.
    pub account_id: ObjectId,
    /// FK → `sabmail_folders._id`.
    pub folder_id: ObjectId,

    /// IMAP-style UID within the folder. Monotonic per folder.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uid: Option<u64>,

    /// RFC 822 Message-ID header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_addr: Option<SabmailAddress>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub to_addrs: Vec<SabmailAddress>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cc: Vec<SabmailAddress>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bcc: Vec<SabmailAddress>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reply_to: Vec<SabmailAddress>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub received_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sent_at: Option<BsonDateTime>,

    /// SabFiles ref to the raw `.eml`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_file_id: Option<String>,

    /// SabFiles refs to extracted attachments (post-parse).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachment_file_ids: Vec<String>,

    /// Plain-text preview for list views.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,

    /// `false` once read. Defaults to `true` on insert.
    #[serde(default = "default_unread")]
    pub unread: bool,
    #[serde(default = "is_false_default")]
    pub starred: bool,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub labels: Vec<String>,

    /// Conversation thread id (gmail-style). Derived from References/In-Reply-To.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_unread() -> bool {
    true
}
fn is_false_default() -> bool {
    false
}
