//! `wachat-phone-sync` — Meta WABA → Mongo phone-number synchroniser, plus
//! WhatsApp Business Profile updater.
//!
//! ## What this slice owns
//!
//! Two narrow concerns lifted from the TS server actions in
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! 1. **Phone-number sync** — pull the full `phone_numbers` list off a
//!    project's WABA on Meta Graph API and overwrite the local
//!    `projects.phoneNumbers` array (TS `handleSyncPhoneNumbers`, line 160).
//! 2. **Per-number business profile update** — push `about / address /
//!    description / email / vertical / websites / profile_picture_handle`
//!    to Meta and mirror those fields back into the matching nested
//!    `projects.phoneNumbers[i].profile.*` (TS
//!    `handleUpdatePhoneNumberProfile`, line 225).
//!
//! Profile **picture upload** (the multi-step `/uploads` resumable-session
//! handshake) is out of scope here — callers pass a pre-resolved Meta
//! `profile_picture_handle` via [`UpdateProfileReq::profile_picture_handle`].
//! The handle handshake belongs to a media/upload crate.
//!
//! ## TS source of truth
//!
//! * `handleSyncPhoneNumbers(projectId)` — `src/app/actions/whatsapp.actions.ts`
//!   lines 160–223. Calls
//!   `GET https://graph.facebook.com/{API_VERSION}/{wabaId}/phone_numbers
//!   ?access_token=...&fields=...&limit=100`, follows `paging.next` verbatim,
//!   then writes:
//!   ```text
//!   db.collection('projects').updateOne(
//!       { _id: new ObjectId(projectId) },
//!       { $set: { phoneNumbers: <mapped array> } }
//!   );
//!   ```
//!   Each element preserves Meta's `whatsapp_business_profile` object under
//!   the local key `profile`.
//!
//! * `handleUpdatePhoneNumberProfile(prevState, formData)` — same file, lines
//!   225–337. Sends
//!   ```text
//!   POST https://graph.facebook.com/{API_VERSION}/{phoneNumberId}/whatsapp_business_profile
//!   { messaging_product: "whatsapp", about?, address?, description?,
//!     email?, vertical?, websites?, profile_picture_handle? }
//!   ```
//!   then mirrors the fields locally with the positional operator:
//!   ```text
//!   db.collection('projects').updateOne(
//!       { _id: ObjectId(projectId), "phoneNumbers.id": phoneNumberId },
//!       { $set: { "phoneNumbers.$.profile.<field>": value, ... } }
//!   );
//!   ```
//!
//! ## Public surface
//!
//! ```no_run
//! use wachat_phone_sync::{PhoneSync, UpdateProfileReq};
//! use wachat_meta_client::MetaClient;
//! # async fn demo(mongo: sabnode_db::MongoHandle, project: wachat_types::Project) -> anyhow::Result<()> {
//! let meta = MetaClient::new("v23.0");
//! let sync = PhoneSync::new(mongo, meta);
//!
//! // Pull phone numbers + overwrite the project's `phoneNumbers` array.
//! let outcome = sync.sync_numbers(&project).await?;
//! println!("fetched {} numbers", outcome.fetched);
//!
//! // Update one number's business profile.
//! sync.update_profile(&project, "PHONE_NUMBER_ID", UpdateProfileReq {
//!     about: Some("We sell things.".into()),
//!     address: None,
//!     description: None,
//!     email: Some("hi@example.com".into()),
//!     vertical: Some("RETAIL".into()),
//!     websites: Some(vec!["https://example.com".into()]),
//!     profile_picture_handle: None,
//! }).await?;
//! # Ok(()) }
//! ```

pub mod dto;
pub mod sync;

pub use dto::{MetaPhoneNumber, MetaPhoneNumbersResp, StoredPhoneNumber, UpdateProfileReq};
pub use sync::{PhoneSync, SyncOutcome};
