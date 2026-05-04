//! Mongo-backed token storage.
//!
//! ## Collection layout
//!
//! Tokens are read from / written to the **`projects`** collection (legacy
//! Next.js convention — see `src/app/actions/whatsapp.actions.ts`, line 73:
//! `db.collection('projects').findOne({ wabaId: wabaId, ... })`). There is no
//! dedicated `meta_tokens` collection; the field names this store touches are
//! `wabaId`, `accessToken`, `phoneNumbers`, `tokenType`, `tokenExpiresAt`,
//! `tokenRefreshedAt`, `createdAt`, `updatedAt`.
//!
//! ## Construction
//!
//! Use [`TokenStore::new`] in production (defaults to `"projects"`) or
//! [`TokenStore::with_collection`] when you need to override (tests,
//! migrations).

use bson::{Document, doc};
use chrono::Utc;
use mongodb::options::{FindOneOptions, ReturnDocument, UpdateOptions};
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use tracing::{debug, info, warn};

use crate::error::MetaAuthError;
use crate::types::{TokenRecord, TokenType, mask};

/// Default Mongo collection — same one the legacy Next.js code reads from.
pub const DEFAULT_COLLECTION: &str = "projects";

/// Cheap, cloneable handle to the token storage layer.
#[derive(Debug, Clone)]
pub struct TokenStore {
    mongo: MongoHandle,
    collection: String,
}

impl TokenStore {
    /// Construct a store backed by the default `projects` collection.
    pub fn new(mongo: MongoHandle) -> Self {
        Self {
            mongo,
            collection: DEFAULT_COLLECTION.to_owned(),
        }
    }

    /// Construct a store with an explicit collection name. Useful for tests
    /// (point at a temporary collection) or one-off migrations.
    pub fn with_collection(mongo: MongoHandle, collection: impl Into<String>) -> Self {
        Self {
            mongo,
            collection: collection.into(),
        }
    }

    /// Name of the collection this store reads/writes.
    pub fn collection_name(&self) -> &str {
        &self.collection
    }

    fn coll(&self) -> mongodb::Collection<Document> {
        self.mongo.collection::<Document>(&self.collection)
    }

    /// Look up the token document for a given WABA. Returns `Ok(None)` if the
    /// project exists but has no `accessToken` field, or if the project does
    /// not exist at all.
    pub async fn get_for_waba(&self, waba_id: &str) -> Result<Option<TokenRecord>, ApiError> {
        let filter = doc! { "wabaId": waba_id };
        let projection = projection_doc();

        let opts = FindOneOptions::builder().projection(projection).build();
        let raw = self
            .coll()
            .find_one(filter)
            .with_options(opts)
            .await
            .map_err(MetaAuthError::from)?;

        let Some(doc) = raw else {
            debug!(waba_id, "no project document for WABA");
            return Ok(None);
        };

        document_to_record(&doc).map(Some).map_err(Into::into)
    }

    /// Look up the token for a given phone-number ID by traversing the
    /// `phoneNumbers[].id` array on the project document. Returns `Ok(None)`
    /// when no project owns the phone number.
    pub async fn get_for_phone_number(
        &self,
        phone_number_id: &str,
    ) -> Result<Option<TokenRecord>, ApiError> {
        // Match against the array element using the standard Mongo dot-path
        // form — this is the same shape the TS uses (e.g. whatsapp.actions.ts
        // line 326: `{ _id: ..., "phoneNumbers.id": phoneNumberId }`).
        let filter = doc! { "phoneNumbers.id": phone_number_id };
        let projection = projection_doc();

        let opts = FindOneOptions::builder().projection(projection).build();
        let raw = self
            .coll()
            .find_one(filter)
            .with_options(opts)
            .await
            .map_err(MetaAuthError::from)?;

        let Some(doc) = raw else {
            debug!(phone_number_id, "no project owns this phone number");
            return Ok(None);
        };

        document_to_record(&doc).map(Some).map_err(Into::into)
    }

    /// Upsert a token record. Always stamps `updated_at = Utc::now()` and
    /// sets `createdAt` only on insert (`$setOnInsert`). The phone-number
    /// list is rebuilt from `record.phone_number_ids`.
    ///
    /// Logs the masked token (last 4 chars only) — never the raw value.
    pub async fn upsert(&self, record: &TokenRecord) -> Result<(), ApiError> {
        let now = bson::DateTime::from_chrono(Utc::now());

        let phone_numbers: Vec<Document> = record
            .phone_number_ids
            .iter()
            .map(|id| doc! { "id": id })
            .collect();

        let token_type_str = match record.token_type {
            TokenType::SystemUser => "system_user",
            TokenType::UserAccess => "user_access",
            TokenType::LongLivedUser => "long_lived_user",
        };

        let mut set = doc! {
            "wabaId": &record.waba_id,
            "accessToken": &record.access_token,
            "tokenType": token_type_str,
            "phoneNumbers": phone_numbers,
            "updatedAt": now,
            "tokenRefreshedAt": now,
        };
        if let Some(expires_at) = record.expires_at {
            set.insert("tokenExpiresAt", bson::DateTime::from_chrono(expires_at));
        }

        let update = doc! {
            "$set": set,
            "$setOnInsert": {
                "createdAt": bson::DateTime::from_chrono(record.created_at),
            },
        };

        let opts = UpdateOptions::builder().upsert(true).build();
        let result = self
            .coll()
            .update_one(doc! { "wabaId": &record.waba_id }, update)
            .with_options(opts)
            .await
            .map_err(MetaAuthError::from)?;

        info!(
            waba_id = %record.waba_id,
            access_token = %mask(&record.access_token),
            token_type = token_type_str,
            matched = result.matched_count,
            upserted = result.upserted_id.is_some(),
            "token upserted",
        );

        Ok(())
    }

    /// Invalidate a token by clearing `accessToken` and stamping
    /// `tokenInvalidatedAt`. Returns `Ok(())` even when the project does not
    /// exist — callers that need an error should call `get_for_waba` first.
    pub async fn invalidate(&self, waba_id: &str) -> Result<(), ApiError> {
        let now = bson::DateTime::from_chrono(Utc::now());

        let update = doc! {
            "$set": {
                "tokenInvalidatedAt": now,
                "updatedAt": now,
            },
            "$unset": {
                "accessToken": "",
                "tokenExpiresAt": "",
            },
        };

        let result = self
            .coll()
            .update_one(doc! { "wabaId": waba_id }, update)
            .await
            .map_err(MetaAuthError::from)?;

        if result.matched_count == 0 {
            warn!(waba_id, "invalidate: no project document matched");
        } else {
            info!(waba_id, "token invalidated");
        }

        Ok(())
    }

    /// Convenience helper: read the raw access token for a WABA. Returns the
    /// `NotFound` variant of [`MetaAuthError`] when the document or token is
    /// absent. Useful for callers that always need a token (HTTP handlers
    /// that proxy to Meta).
    pub async fn require_token_for_waba(&self, waba_id: &str) -> Result<String, ApiError> {
        let rec = self.get_for_waba(waba_id).await?;
        match rec {
            Some(r) if !r.access_token.is_empty() => Ok(r.access_token),
            _ => Err(MetaAuthError::NotFound {
                kind: "wabaId",
                id: waba_id.to_owned(),
            }
            .into()),
        }
    }
}

/// Projection passed to every read — keep documents small and avoid pulling
/// large project metadata we don't need for token operations.
fn projection_doc() -> Document {
    doc! {
        "wabaId": 1,
        "accessToken": 1,
        "tokenType": 1,
        "tokenExpiresAt": 1,
        "phoneNumbers": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "tokenRefreshedAt": 1,
    }
}

fn document_to_record(raw: &Document) -> Result<TokenRecord, MetaAuthError> {
    let waba_id = raw
        .get_str("wabaId")
        .map_err(|e| MetaAuthError::UnexpectedResponse(format!("missing wabaId: {e}")))?
        .to_owned();

    let access_token = raw.get_str("accessToken").unwrap_or_default().to_owned();

    let token_type = match raw.get_str("tokenType").ok() {
        Some("system_user") => TokenType::SystemUser,
        Some("user_access") => TokenType::UserAccess,
        Some("long_lived_user") => TokenType::LongLivedUser,
        // Default to `LongLivedUser` for legacy documents that pre-date the
        // typed field — that matches the typical TS flow which exchanges
        // short-lived tokens for long-lived ones before persistence.
        _ => TokenType::LongLivedUser,
    };

    let phone_number_ids = raw
        .get_array("phoneNumbers")
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_document())
                .filter_map(|d| d.get_str("id").ok().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let expires_at = raw
        .get_datetime("tokenExpiresAt")
        .ok()
        .map(|dt| chrono::DateTime::<Utc>::from(*dt));

    let created_at = raw
        .get_datetime("createdAt")
        .ok()
        .map(|dt| chrono::DateTime::<Utc>::from(*dt))
        .unwrap_or_else(|| chrono::DateTime::<Utc>::from_timestamp(0, 0).expect("epoch is valid"));

    let updated_at = raw
        .get_datetime("updatedAt")
        .ok()
        .or_else(|| raw.get_datetime("tokenRefreshedAt").ok())
        .map(|dt| chrono::DateTime::<Utc>::from(*dt))
        .unwrap_or(created_at);

    Ok(TokenRecord {
        waba_id,
        phone_number_ids,
        access_token,
        token_type,
        expires_at,
        created_at,
        updated_at,
    })
}

// `ReturnDocument` is imported eagerly so future helpers (find-and-modify,
// atomic invalidate-and-return) don't need to add the import — silence the
// dead-code warning until those land.
#[allow(dead_code)]
const _RETURN_DOC: ReturnDocument = ReturnDocument::After;
