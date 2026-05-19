//! # email-types
//!
//! Shared **domain DTOs** for the SabNode Email Suite Rust port. Mirrors the
//! TypeScript shapes in `src/lib/email/types.ts` and the documents persisted
//! into the Mongo collections enumerated in [`collections`].
//!
//! Pure types library — no business logic, no I/O, no async. Every consuming
//! email-* crate `use email_types::*`.

pub mod audience;
pub mod brand_kit;
pub mod campaign;
pub mod collections;
pub mod common;
pub mod deliverability;
pub mod events;
pub mod forms;
pub mod inbox;
pub mod journey;
pub mod reports;
pub mod segment;
pub mod settings;
pub mod template;
pub mod webhook;

pub use audience::{
    EmailList, EmailListInput, EmailSubscriber, EmailSubscriberInput, EmailSubscriberStatus,
};
pub use brand_kit::{EmailBrandKit, EmailBrandKitInput, EmailBrandPalette};
pub use campaign::{
    EmailCampaign, EmailCampaignAbConfig, EmailCampaignStatus, EmailCampaignType,
    EmailCampaignVariant,
};
pub use common::{EmailAddress, ObjectIdString, PageQuery, PageResponse};
pub use deliverability::{EmailDnsSnapshot, EmailWarmupRun};
pub use events::{EmailEvent, EmailEventKind};
pub use forms::{EmailForm, EmailFormField, EmailFormKind};
pub use inbox::{
    EmailInboxAssignment, EmailInboxMessage, EmailInboxMessageDirection, EmailInboxThread,
    EmailInboxThreadStatus,
};
pub use journey::{
    EmailJourney, EmailJourneyEdge, EmailJourneyNode, EmailJourneyRun, EmailJourneyStatus,
    EmailJourneyTriggerKind, EmailJourneyNodeType,
};
pub use reports::{
    EmailReportBucket, EmailReportMetrics, EmailReportScope, EmailReportsCache,
};
pub use segment::{EmailFilterGroup, EmailFilterLeaf, EmailFilterOp, EmailFilterTree, EmailSegment};
pub use settings::EmailSenderProvider;
pub use template::{
    EmailBuilderBlock, EmailBuilderDocument, EmailBuilderBlockType, EmailTemplate,
    EmailTemplateBlock,
};
pub use webhook::{EmailApiKey, EmailWebhookConfig};
