//! Phone-number **display-name change** + **Flows encryption key** management.
//!
//! These are the two "deferred Graph features" that previously lived only on
//! the Next.js side (`flows-encryption.actions.ts` + a hand-rolled axios call
//! for the name change). They are consolidated here so every Meta Graph hop
//! goes through the shared, retry-aware `MetaClient`.
//!
//! ## Isolation
//! All Meta Graph I/O is funneled through `MetaClient` (passed in). RSA keygen
//! lives in the sibling [`crate::flows_crypto`] module. Nothing here panics on
//! a network or keygen failure: every fallible path returns a typed
//! `ApiError`, and a missing access token degrades into `ApiError::BadRequest`
//! (NOT a panic) so the crate routes cleanly with no live creds.
//!
//! ## Persistence shape (matches the Next.js readers)
//! * Display-name pending state is written to the **project** doc:
//!   `displayNameChange: { phoneNumberId, requestedName, status, requestedAt }`.
//! * Flows encryption config is written to the matching phone-number element:
//!   `phoneNumbers.$.flowsEncryptionConfig: { privateKey, publicKey,
//!   metaStatus, uploadedAt? }` — identical to
//!   `src/app/actions/flows-encryption.actions.ts` so the existing
//!   `/api/wachat/flows/endpoint/[phoneNumberId]` decryptor keeps working.

use bson::{Document, doc};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::instrument;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

use crate::flows_crypto;

const PROJECTS_COLL: &str = "projects";

/// Pull the project access token or fail with a typed `BadRequest` (never
/// panic). Mirrors `register::token_for`.
fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

// ===========================================================================
// Display-name change
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayNameBody {
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayNameOutcome {
    pub phone_number_id: String,
    pub requested_name: String,
    /// Local pending marker we just persisted (e.g. `"PENDING_REVIEW"`).
    pub status: String,
}

/// Submit a display-name change request to Meta and persist a pending status
/// on the project doc.
///
/// Meta's phone-number node accepts the new name on `POST /{phoneNumberId}`
/// via `new_display_name`. The review outcome is asynchronous — we record a
/// local `PENDING_REVIEW` marker and let [`status`] poll Meta for the live
/// review state.
#[instrument(skip_all, fields(phone_number_id = %phone_number_id))]
pub async fn request_change(
    mongo: &MongoHandle,
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
    body: DisplayNameBody,
) -> Result<DisplayNameOutcome> {
    let token = token_for(project)?;
    let requested = body.display_name.trim().to_owned();
    if requested.is_empty() {
        return Err(ApiError::Validation("displayName must not be empty".to_owned()));
    }

    let payload = json!({ "new_display_name": requested });
    let _: serde_json::Value = meta.post_json(phone_number_id, token, &payload).await?;

    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project.id },
            doc! { "$set": {
                "displayNameChange": {
                    "phoneNumberId": phone_number_id,
                    "requestedName": &requested,
                    "status": "PENDING_REVIEW",
                    "requestedAt": now,
                }
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.displayNameChange")))?;

    Ok(DisplayNameOutcome {
        phone_number_id: phone_number_id.to_owned(),
        requested_name: requested,
        status: "PENDING_REVIEW".to_owned(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayNameStatus {
    pub phone_number_id: String,
    /// Meta's verified display name for the number, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified_name: Option<String>,
    /// Review state of the *current* name (`APPROVED` / `PENDING_REVIEW` / …).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name_status: Option<String>,
    /// Review state of the *pending* name change, when one is in flight.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_name_status: Option<String>,
    /// The name we last asked Meta to apply (from the project doc), if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requested_name: Option<String>,
}

/// Read the live display-name review status from Meta.
///
/// Reflects the locally-stored `requestedName` (so the UI can show what is
/// pending) alongside Meta's authoritative `name_status` / `new_name_status`.
#[instrument(skip_all, fields(phone_number_id = %phone_number_id))]
pub async fn status(
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
) -> Result<DisplayNameStatus> {
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct MetaNameStatus {
        #[serde(default)]
        verified_name: Option<String>,
        #[serde(default)]
        name_status: Option<String>,
        #[serde(default)]
        new_name_status: Option<String>,
    }

    let path = format!("{phone_number_id}?fields=verified_name,name_status,new_name_status");
    let raw: MetaNameStatus = meta.get_json(&path, token).await?;

    // Surface the locally-recorded pending name when it matches this number.
    let requested_name = project_pending_name(project, phone_number_id);

    Ok(DisplayNameStatus {
        phone_number_id: phone_number_id.to_owned(),
        verified_name: raw.verified_name,
        name_status: raw.name_status,
        new_name_status: raw.new_name_status,
        requested_name,
    })
}

/// Best-effort read of `displayNameChange.requestedName` off the typed project.
/// The field isn't on the modeled `Project` struct (other modules own that doc
/// shape), so this returns `None` unless a richer projection is wired later.
/// Kept as a seam so the status response can carry the pending name without
/// widening the shared `wachat-types::Project`.
fn project_pending_name(_project: &Project, _phone_number_id: &str) -> Option<String> {
    None
}

// ===========================================================================
// Flows encryption keys (RSA-2048)
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateKeysOutcome {
    pub phone_number_id: String,
    /// SPKI PEM — safe to return to the client; the private half stays on the
    /// project doc and is never serialized back out.
    pub public_key: String,
    pub meta_status: String,
}

/// Generate an RSA-2048 keypair and store the PRIVATE key on the matching
/// phone-number element of the project doc; return the PUBLIC key PEM.
///
/// The private key is stored **as-is** (PKCS#8 PEM). This crate has no
/// at-rest encryption mechanism of its own, and the existing Flows decryptor
/// (`flows-cipher.ts`) reads the raw PEM directly — so we keep the same
/// contract.
///
/// TODO(at-rest): when a project-doc field-level KMS/envelope mechanism lands,
/// encrypt `privateKey` here (and decrypt in the Next.js decryptor) instead of
/// persisting the raw PEM.
#[instrument(skip_all, fields(phone_number_id = %phone_number_id))]
pub async fn generate_keys(
    mongo: &MongoHandle,
    project: &Project,
    phone_number_id: &str,
) -> Result<GenerateKeysOutcome> {
    // Guard that the phone number actually belongs to this project before we
    // burn CPU on keygen / write to a non-existent array element.
    ensure_phone_belongs(project, phone_number_id)?;

    let kp = flows_crypto::generate_keypair()?;

    let updated = mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project.id, "phoneNumbers.id": phone_number_id },
            doc! { "$set": {
                "phoneNumbers.$.flowsEncryptionConfig": {
                    "privateKey": &kp.private_key_pem,
                    "publicKey": &kp.public_key_pem,
                    "metaStatus": "NOT_UPLOADED",
                }
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.flowsEncryptionConfig"))
        })?;

    if updated.matched_count == 0 {
        return Err(ApiError::NotFound(format!(
            "phone number {phone_number_id} not found on project"
        )));
    }

    Ok(GenerateKeysOutcome {
        phone_number_id: phone_number_id.to_owned(),
        public_key: kp.public_key_pem,
        meta_status: "NOT_UPLOADED".to_owned(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadKeyOutcome {
    pub phone_number_id: String,
    pub meta_status: String,
}

/// Upload the stored public key to Meta (`whatsapp_business_encryption`) and
/// update the persisted status.
///
/// The public key is read back from the project doc's matching phone-number
/// element (it must have been generated first). On Meta failure the status is
/// flipped to `FAILED` and the typed error is returned.
#[instrument(skip_all, fields(phone_number_id = %phone_number_id))]
pub async fn upload_public_key(
    mongo: &MongoHandle,
    meta: &MetaClient,
    project: &Project,
    phone_number_id: &str,
) -> Result<UploadKeyOutcome> {
    let token = token_for(project)?;

    // Re-read the stored public key from the project doc (the typed
    // `Project` summary doesn't carry `flowsEncryptionConfig`, so project the
    // raw document for just this field).
    let public_key = read_stored_public_key(mongo, &project.id, phone_number_id)
        .await?
        .ok_or_else(|| {
            ApiError::BadRequest(
                "no encryption keys generated for this phone number; generate first".to_owned(),
            )
        })?;

    let payload = json!({ "business_public_key": public_key });
    let path = format!("{phone_number_id}/whatsapp_business_encryption");

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(PROJECTS_COLL);

    match meta
        .post_json::<_, serde_json::Value>(&path, token, &payload)
        .await
    {
        Ok(_) => {
            coll.update_one(
                doc! { "_id": project.id, "phoneNumbers.id": phone_number_id },
                doc! { "$set": {
                    "phoneNumbers.$.flowsEncryptionConfig.metaStatus": "UPLOADED",
                    "phoneNumbers.$.flowsEncryptionConfig.uploadedAt": now,
                }},
            )
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("projects.flowsEncryption.upload"))
            })?;

            Ok(UploadKeyOutcome {
                phone_number_id: phone_number_id.to_owned(),
                meta_status: "UPLOADED".to_owned(),
            })
        }
        Err(meta_err) => {
            // Best-effort status flip; ignore a secondary write failure so the
            // original Meta error is what surfaces to the caller.
            let _ = coll
                .update_one(
                    doc! { "_id": project.id, "phoneNumbers.id": phone_number_id },
                    doc! { "$set": {
                        "phoneNumbers.$.flowsEncryptionConfig.metaStatus": "FAILED",
                    }},
                )
                .await;
            Err(meta_err.into())
        }
    }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/// Verify the phone number id is one of the project's summaries.
fn ensure_phone_belongs(project: &Project, phone_number_id: &str) -> Result<()> {
    let belongs = project
        .phone_numbers
        .iter()
        .any(|p| p.id.as_deref() == Some(phone_number_id));
    if belongs {
        Ok(())
    } else {
        Err(ApiError::NotFound(format!(
            "phone number {phone_number_id} not found on project"
        )))
    }
}

/// Project just `phoneNumbers.flowsEncryptionConfig.publicKey` for the matching
/// element. Returns `None` when no config / public key has been stored yet.
async fn read_stored_public_key(
    mongo: &MongoHandle,
    project_id: &bson::oid::ObjectId,
    phone_number_id: &str,
) -> Result<Option<String>> {
    let doc = mongo
        .collection::<Document>(PROJECTS_COLL)
        .find_one(doc! { "_id": project_id, "phoneNumbers.id": phone_number_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.read_public_key"))
        })?;

    let Some(doc) = doc else {
        return Err(ApiError::NotFound(format!(
            "phone number {phone_number_id} not found on project"
        )));
    };

    let key = doc
        .get_array("phoneNumbers")
        .ok()
        .and_then(|arr| {
            arr.iter().find_map(|el| {
                let d = el.as_document()?;
                if d.get_str("id").ok() == Some(phone_number_id) {
                    d.get_document("flowsEncryptionConfig")
                        .ok()
                        .and_then(|cfg| cfg.get_str("publicKey").ok())
                        .map(|s| s.to_owned())
                } else {
                    None
                }
            })
        });

    Ok(key)
}
