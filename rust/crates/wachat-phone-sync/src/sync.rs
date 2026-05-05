//! `PhoneSync` — port of `handleSyncPhoneNumbers` (TS line 160) and
//! `handleUpdatePhoneNumberProfile` (TS line 225).
//!
//! ## Endpoints (Meta v23.0)
//!
//! * `GET  /{wabaId}/phone_numbers?fields=...&limit=100&access_token=...` —
//!   pagination follows `paging.next` verbatim.
//! * `POST /{phoneNumberId}/whatsapp_business_profile` — body always
//!   includes `messaging_product: "whatsapp"`.
//!
//! ## Mongo updates
//!
//! * **sync_numbers** — overwrite `projects.phoneNumbers` wholesale:
//!   ```text
//!   { _id: project.id } => { $set: { phoneNumbers: <mapped> } }
//!   ```
//!   Even when Meta returns 0 numbers we still write `[]` (matches TS
//!   line 192–195: an empty WABA still clears the local array).
//!
//! * **update_profile** — positional `$set` into the matching nested doc:
//!   ```text
//!   { _id: project.id, "phoneNumbers.id": phoneNumberId } =>
//!       { $set: {
//!           "phoneNumbers.$.profile.about": "...",
//!           "phoneNumbers.$.profile.websites": [...],
//!           ...
//!       } }
//!   ```
//!   Only fields the caller supplied are touched.

use bson::{Bson, Document, doc};
use mongodb::{Collection, options::UpdateOptions};
use serde_json::{Value as JsonValue, json};
use tracing::{debug, info};

use sabnode_common::ApiError;
use sabnode_db::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use crate::dto::{MetaPhoneNumbersResp, StoredPhoneNumber, UpdateProfileReq};

/// Page size — matches the TS code (`limit=100`, line 171).
const PAGE_SIZE: u32 = 100;

/// Field set requested from Meta — copied verbatim from TS line 168.
const FIELDS: &str = "verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput,whatsapp_business_profile{about,address,description,email,profile_picture_url,websites,vertical}";

/// Mongo collection name (TS: `db.collection('projects')`).
const COLLECTION: &str = "projects";

/// Result of one sync pass — counter only.
///
/// `fetched` matches the count of phone-number rows aggregated across every
/// `paging.next` page (TS `allPhoneNumbers.length`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SyncOutcome {
    pub fetched: usize,
}

/// Pulls phone numbers from Meta and writes them onto a `Project` doc, plus
/// pushes business-profile changes back to Meta.
///
/// Cheap to clone — `MongoHandle` and `MetaClient` are both `Arc`-wrapped
/// internally.
#[derive(Debug, Clone)]
pub struct PhoneSync {
    mongo: MongoHandle,
    meta: MetaClient,
    /// HTTP client used **only** for `paging.next` follow-ups, which Meta
    /// emits as fully-qualified URLs already containing `?access_token=...`.
    /// Same rationale as `wachat-templates-sync` — pushing them through
    /// `MetaClient::get_json` would re-prepend `base/version` and break.
    http: reqwest::Client,
}

impl PhoneSync {
    /// Construct a new instance. The `MetaClient` is used for the **first**
    /// page and for every `update_profile` POST; subsequent sync pages follow
    /// `paging.next` verbatim through the embedded raw HTTP client.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent(concat!(
                "sabnode-wachat-phone-sync/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .expect("reqwest client must build with default config");
        Self { mongo, meta, http }
    }

    /// Pull every phone number for `project`'s WABA off Meta and overwrite
    /// the local `projects.phoneNumbers` array.
    ///
    /// Mirrors `handleSyncPhoneNumbers` (TS line 160). Idempotent: running
    /// twice with no upstream changes produces the same Mongo state both
    /// times.
    pub async fn sync_numbers(&self, project: &Project) -> Result<SyncOutcome, ApiError> {
        let waba_id = project.waba_id.as_deref().ok_or_else(|| {
            ApiError::BadRequest("project has no wabaId — embedded signup not completed".to_owned())
        })?;
        let access_token = project.access_token.as_deref().unwrap_or("");
        if access_token.is_empty() {
            return Err(ApiError::BadRequest(
                "missing Meta access token for phone sync".to_owned(),
            ));
        }

        let project_id = project.id;
        let coll: Collection<Document> = self.mongo.collection::<Document>(COLLECTION);

        // ---- fetch every page -------------------------------------------------
        let mut all: Vec<StoredPhoneNumber> = Vec::new();

        // Page 1 goes through MetaClient (so retry/backoff covers the call
        // most likely to fail). Note the `?access_token=` query param is
        // duplicated by `MetaClient`'s `Authorization: Bearer ...` header —
        // harmless, and matches TS line 171 exactly.
        let path = format!(
            "{waba_id}/phone_numbers?fields={FIELDS}&limit={PAGE_SIZE}&access_token={token}",
            waba_id = waba_id,
            FIELDS = FIELDS,
            PAGE_SIZE = PAGE_SIZE,
            token = access_token,
        );
        debug!(
            project_id = %project_id,
            waba_id,
            "phone-sync: fetching first page via MetaClient"
        );
        let first: MetaPhoneNumbersResp = self.meta.get_json(&path, access_token).await?;
        all.extend(first.data.into_iter().map(StoredPhoneNumber::from));
        let mut next_url: Option<String> = first.paging.and_then(|p| p.next);

        while let Some(url) = next_url.take() {
            debug!(project_id = %project_id, "phone-sync: following paging.next");
            let resp = self.http.get(&url).send().await.map_err(|e| {
                ApiError::Internal(anyhow::anyhow!("phone-sync: paging.next GET failed: {e}"))
            })?;
            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                let message = serde_json::from_str::<JsonValue>(&body)
                    .ok()
                    .and_then(|v| {
                        v.get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_owned())
                    })
                    .unwrap_or_else(|| {
                        format!(
                            "Could not parse error response from Meta. Status: {} {}",
                            status.as_u16(),
                            status.canonical_reason().unwrap_or("")
                        )
                    });
                return Err(ApiError::BadRequest(format!(
                    "Failed to fetch phone numbers from Meta: {message}"
                )));
            }
            let page: MetaPhoneNumbersResp = resp.json().await.map_err(|e| {
                ApiError::Internal(anyhow::anyhow!("phone-sync: paging.next decode failed: {e}"))
            })?;
            all.extend(page.data.into_iter().map(StoredPhoneNumber::from));
            next_url = page.paging.and_then(|p| p.next);
        }

        let fetched = all.len();

        // ---- write to Mongo --------------------------------------------------
        // Even when `fetched == 0` we still overwrite with `[]` — TS lines
        // 191–197 explicitly clear the array in that case. We encode the
        // mapped phone numbers via bson::to_bson so serde does the rename
        // (snake_case wire keys are exactly what TS writes to Mongo).
        let phone_numbers_bson = bson::to_bson(&all).map_err(|e| {
            ApiError::Internal(anyhow::anyhow!(
                "phone-sync: failed to encode phoneNumbers for Mongo: {e}"
            ))
        })?;

        let filter = doc! { "_id": project_id };
        let update = doc! { "$set": { "phoneNumbers": phone_numbers_bson } };
        coll.update_one(filter, update).await.map_err(|e| {
            ApiError::Internal(anyhow::anyhow!(
                "phone-sync: Mongo update failed for project {project_id}: {e}"
            ))
        })?;

        info!(project_id = %project_id, fetched, "phone-sync: complete");
        Ok(SyncOutcome { fetched })
    }

    /// Update one phone number's WhatsApp Business Profile on Meta and
    /// mirror the same fields onto the local `projects.phoneNumbers[$].profile`
    /// sub-doc.
    ///
    /// Mirrors `handleUpdatePhoneNumberProfile` (TS line 225) **minus** the
    /// resumable upload handshake — callers must pre-resolve their
    /// `profile_picture_handle`.
    ///
    /// No-ops cleanly when `req.is_empty()`.
    pub async fn update_profile(
        &self,
        project: &Project,
        phone_number_id: &str,
        req: UpdateProfileReq,
    ) -> Result<(), ApiError> {
        if phone_number_id.is_empty() {
            return Err(ApiError::BadRequest("phoneNumberId is required".to_owned()));
        }
        if req.is_empty() {
            return Ok(());
        }
        let access_token = project.access_token.as_deref().unwrap_or("");
        if access_token.is_empty() {
            return Err(ApiError::BadRequest(
                "missing Meta access token for profile update".to_owned(),
            ));
        }

        // ---- build Meta payload ---------------------------------------------
        // Always set `messaging_product: "whatsapp"` (TS line 261 + 266).
        let mut payload = json!({ "messaging_product": "whatsapp" });
        let obj = payload
            .as_object_mut()
            .expect("payload constructed as object");
        if let Some(v) = req.about.as_ref() {
            obj.insert("about".into(), JsonValue::String(v.clone()));
        }
        if let Some(v) = req.address.as_ref() {
            obj.insert("address".into(), JsonValue::String(v.clone()));
        }
        if let Some(v) = req.description.as_ref() {
            obj.insert("description".into(), JsonValue::String(v.clone()));
        }
        if let Some(v) = req.email.as_ref() {
            obj.insert("email".into(), JsonValue::String(v.clone()));
        }
        if let Some(v) = req.vertical.as_ref() {
            obj.insert("vertical".into(), JsonValue::String(v.clone()));
        }
        if let Some(ws) = req.websites.as_ref() {
            obj.insert(
                "websites".into(),
                JsonValue::Array(ws.iter().cloned().map(JsonValue::String).collect()),
            );
        }
        if let Some(handle) = req.profile_picture_handle.as_ref() {
            obj.insert(
                "profile_picture_handle".into(),
                JsonValue::String(handle.clone()),
            );
        }

        let path = format!("{phone_number_id}/whatsapp_business_profile");
        debug!(
            project_id = %project.id,
            phone_number_id,
            "phone-sync: posting business-profile update"
        );
        // Meta returns `{ "success": true }` — discard the body.
        let _: JsonValue = self.meta.post_json(&path, access_token, &payload).await?;

        // ---- mirror to local Mongo ------------------------------------------
        // Build positional `$set` for each field the caller provided. Only
        // touch fields we sent to Meta (matches TS lines 301–319).
        let mut set_fields = Document::new();
        if let Some(v) = req.about.as_ref() {
            set_fields.insert("phoneNumbers.$.profile.about", v.clone());
        }
        if let Some(v) = req.address.as_ref() {
            set_fields.insert("phoneNumbers.$.profile.address", v.clone());
        }
        if let Some(v) = req.description.as_ref() {
            set_fields.insert("phoneNumbers.$.profile.description", v.clone());
        }
        if let Some(v) = req.email.as_ref() {
            set_fields.insert("phoneNumbers.$.profile.email", v.clone());
        }
        if let Some(v) = req.vertical.as_ref() {
            set_fields.insert("phoneNumbers.$.profile.vertical", v.clone());
        }
        if let Some(ws) = req.websites.as_ref() {
            let arr: Vec<Bson> = ws.iter().cloned().map(Bson::String).collect();
            set_fields.insert("phoneNumbers.$.profile.websites", Bson::Array(arr));
        }
        // Note: we deliberately do NOT mirror `profile_picture_handle` —
        // the local field is `profile.profile_picture_url`, which only Meta
        // can resolve from the handle. TS line 322 says the same: "we can't
        // easily get the URL immediately without a GET".

        if !set_fields.is_empty() {
            let coll: Collection<Document> = self.mongo.collection::<Document>(COLLECTION);
            let filter = doc! {
                "_id": project.id,
                "phoneNumbers.id": phone_number_id,
            };
            let update = doc! { "$set": set_fields };
            // TS uses `updateOne` — match. We don't `upsert` because the
            // positional operator requires a matching array element.
            let opts = UpdateOptions::builder().upsert(false).build();
            coll.update_one(filter, update)
                .with_options(opts)
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::anyhow!(
                        "phone-sync: local profile mirror failed for project {} / phone {}: {e}",
                        project.id,
                        phone_number_id
                    ))
                })?;
        }

        info!(
            project_id = %project.id,
            phone_number_id,
            "phone-sync: profile updated"
        );
        Ok(())
    }
}
