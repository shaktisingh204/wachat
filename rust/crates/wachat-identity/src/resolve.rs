//! BSUID-first contact resolution.
//!
//! From mid-2026 WhatsApp users can hide their phone number behind a username;
//! businesses then receive a stable **Business-Scoped User ID (BSUID)** instead.
//! This resolves a contact in the `contacts` collection by BSUID first, falling
//! back to phone (`waId`) for pre-BSUID contacts, and creates one if missing —
//! with phone optional. Lets the inbox/contacts surfaces key off BSUID without a
//! hard phone-number requirement.

use bson::{DateTime, Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const CONTACTS_COLL: &str = "contacts";

/// Body for `POST /v1/wachat/identity/projects/{id}/resolve`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveBody {
    /// Business-Scoped User ID (preferred identifier).
    #[serde(default)]
    pub bsuid: Option<String>,
    /// Phone / WhatsApp id — optional, legacy fallback.
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResolveResponse {
    pub contact: Value,
    pub created: bool,
}

pub async fn resolve(
    mongo: &MongoHandle,
    project_id: &ObjectId,
    body: ResolveBody,
) -> Result<ResolveResponse> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    let filter = if let Some(bsuid) = body.bsuid.as_deref() {
        doc! { "projectId": project_id, "bsuid": bsuid }
    } else if let Some(phone) = body.phone.as_deref() {
        doc! { "projectId": project_id, "waId": phone }
    } else {
        return Err(ApiError::BadRequest(
            "resolve requires a bsuid or phone".to_owned(),
        ));
    };

    if let Some(existing) = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("identity.find")))?
    {
        let contact =
            serde_json::to_value(existing).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        return Ok(ResolveResponse {
            contact,
            created: false,
        });
    }

    let mut new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "createdAt": DateTime::now(),
    };
    if let Some(bsuid) = body.bsuid {
        new_doc.insert("bsuid", bsuid);
    }
    if let Some(phone) = body.phone {
        new_doc.insert("waId", phone);
    }
    if let Some(name) = body.name {
        new_doc.insert("name", name);
    }

    coll.insert_one(&new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("identity.insert")))?;

    let contact =
        serde_json::to_value(&new_doc).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(ResolveResponse {
        contact,
        created: true,
    })
}
