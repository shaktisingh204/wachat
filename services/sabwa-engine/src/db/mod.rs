//! MongoDB data-access layer for the SabWa engine.
//!
//! Each submodule corresponds to a `sabwa_*` collection from SABWA_PLAN.md
//! section 3. Repos are thin wrappers around `mongodb::Collection<T>` and
//! return `anyhow::Result<...>` so call-sites can use `?` freely.

pub mod serde_dates;
pub mod sessions;
pub mod chats;
pub mod messages;
pub mod groups;
pub mod contacts;
pub mod scheduled;
pub mod misc;
pub mod bulk;

pub use sessions::{
    BanSignal, DeviceMeta, PairMethod, RateProfile, SabwaSession, SessionStatus, SessionsRepo,
};
pub use chats::{ChatType, ChatsRepo, LastMessage, SabwaChat};
pub use messages::{
    MessageStatus, MessageType, MessagesRepo, MessagesPage, Reaction, SabwaMessage,
};
pub use groups::{GroupsRepo, Participant, SabwaGroup};
pub use contacts::{ContactsRepo, SabwaContact};
pub use scheduled::{SabwaScheduled, ScheduledKind, ScheduledRepo, ScheduledStatus, ScheduledTarget, ScheduledPayload};
pub use misc::{
    ApiKeysRepo, AuditLogRepo, AutoRepliesRepo, BroadcastsRepo, LabelsRepo, QuickRepliesRepo,
    SabwaApiKey, SabwaAuditLogEntry, SabwaAutoReply, SabwaBroadcast, SabwaLabel,
    SabwaQuickReply, SabwaTemplate, SabwaWebhook, TemplatesRepo, WebhooksRepo,
};
pub use bulk::{
    BulkCampaign, BulkCampaignProgress, BulkCampaignStatus, BulkRecipient, BulkRecipientStatus,
};
