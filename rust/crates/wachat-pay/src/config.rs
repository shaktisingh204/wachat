//! Payment configuration CRUD against Meta + local mirror in `projects`.
//!
//! TS source: `src/app/actions/whatsapp-pay.actions.ts`. The legacy file
//! pinned `API_VERSION = 'v24.0'` — but each `MetaClient` carries its own
//! version (the API crate constructs one against `v23.0`), and Meta accepts
//! `payment_configurations` calls on either. We defer to the caller's
//! `MetaClient`.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Body for `POST /v1/wachat/pay/projects/{id}/configurations`.
///
/// Mirrors `handleCreatePaymentConfiguration` form fields. When
/// `provider_name == "upi_vpa"` the caller must supply `merchant_vpa`;
/// otherwise `redirect_url` is required (matches the TS conditional at
/// line 78). We pass both through optionally and let Meta enforce the
/// final shape.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConfigBody {
    pub configuration_name: String,
    pub purpose_code: String,
    pub merchant_category_code: String,
    pub provider_name: String,
    #[serde(default)]
    pub merchant_vpa: Option<String>,
    #[serde(default)]
    pub redirect_url: Option<String>,
}

/// Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/data-endpoint`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDataEndpointBody {
    pub data_endpoint_url: String,
}

/// Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/regenerate-oauth`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateOauthBody {
    pub redirect_url: String,
}

/// Body for `POST /v1/wachat/pay/projects/{id}/configurations/{name}/sync-local`.
///
/// The TS `handlePaymentConfigurationUpdate` accepted `updateValue: any`. We
/// keep that "anything goes" semantics by typing the payload as
/// `serde_json::Value` and only requiring the array key
/// (`configuration_name`) used to match-or-append the array element.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLocalBody {
    pub configuration_name: String,
    /// Full update value to write into the `paymentConfiguration[]` slot.
    pub update_value: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ListResponse {
    pub configurations: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConfigResponse {
    pub configuration: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateResponse {
    pub message: String,
    /// Present iff the provider is non-UPI (Meta returns an OAuth URL the
    /// merchant must open to complete provider onboarding).
    pub oauth_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OauthResponse {
    pub oauth_url: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

fn waba_for(project: &Project) -> Result<&str> {
    project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))
}

// ---------------------------------------------------------------------------
// Meta calls
// ---------------------------------------------------------------------------

/// `GET {wabaId}/payment_configurations`. The TS extracts
/// `data[0].payment_configurations` — Meta wraps the list under the WABA
/// envelope. If the envelope is empty or shape-shifted, we return `[]`.
pub async fn list(meta: &MetaClient, project: &Project) -> Result<ListResponse> {
    #[derive(Deserialize)]
    struct Envelope {
        #[serde(default)]
        data: Vec<EnvelopeItem>,
    }
    #[derive(Deserialize)]
    struct EnvelopeItem {
        #[serde(default)]
        payment_configurations: Vec<Value>,
    }

    let path = format!("{}/payment_configurations", waba_for(project)?);
    let resp: Envelope = meta.get_json(&path, token_for(project)?).await?;
    let configs = resp
        .data
        .into_iter()
        .next()
        .map(|e| e.payment_configurations)
        .unwrap_or_default();
    Ok(ListResponse {
        configurations: configs,
    })
}

/// `GET {wabaId}/payment_configuration/{name}`. The TS unwraps `data[0]`
/// and treats an empty list as "not found".
pub async fn get_by_name(
    meta: &MetaClient,
    project: &Project,
    config_name: &str,
) -> Result<ConfigResponse> {
    #[derive(Deserialize)]
    struct Envelope {
        #[serde(default)]
        data: Vec<Value>,
    }

    let path = format!(
        "{}/payment_configuration/{}",
        waba_for(project)?,
        config_name
    );
    let resp: Envelope = meta.get_json(&path, token_for(project)?).await?;
    let configuration = resp
        .data
        .into_iter()
        .next()
        .ok_or_else(|| ApiError::NotFound(format!("payment configuration {config_name}")))?;
    Ok(ConfigResponse { configuration })
}

/// `POST {wabaId}/payment_configurations`. Returns the create message and
/// optional `oauth_url` (only present for non-UPI providers).
pub async fn create(
    meta: &MetaClient,
    project: &Project,
    body: CreateConfigBody,
) -> Result<CreateResponse> {
    let mut payload = serde_json::Map::new();
    payload.insert(
        "configuration_name".into(),
        Value::String(body.configuration_name),
    );
    payload.insert("purpose_code".into(), Value::String(body.purpose_code));
    payload.insert(
        "merchant_category_code".into(),
        Value::String(body.merchant_category_code),
    );
    payload.insert(
        "provider_name".into(),
        Value::String(body.provider_name.clone()),
    );
    if body.provider_name == "upi_vpa" {
        if let Some(vpa) = body.merchant_vpa {
            payload.insert("merchant_vpa".into(), Value::String(vpa));
        }
    } else if let Some(redirect) = body.redirect_url {
        payload.insert("redirect_url".into(), Value::String(redirect));
    }

    let path = format!("{}/payment_configurations", waba_for(project)?);
    let resp: Value = meta
        .post_json(&path, token_for(project)?, &Value::Object(payload))
        .await?;

    let oauth_url = resp
        .get("oauth_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_owned());
    let message = if oauth_url.is_some() {
        "Configuration created. Please complete the provider onboarding.".to_owned()
    } else {
        "UPI VPA configuration created successfully.".to_owned()
    };

    Ok(CreateResponse { message, oauth_url })
}

/// `POST {wabaId}/payment_configuration/{name}` with `data_endpoint_url`.
pub async fn update_data_endpoint(
    meta: &MetaClient,
    project: &Project,
    config_name: &str,
    body: UpdateDataEndpointBody,
) -> Result<()> {
    if body.data_endpoint_url.is_empty() {
        return Err(ApiError::BadRequest(
            "Data Endpoint URL is required.".to_owned(),
        ));
    }
    let path = format!(
        "{}/payment_configuration/{}",
        waba_for(project)?,
        config_name
    );
    let payload = serde_json::json!({ "data_endpoint_url": body.data_endpoint_url });
    let _: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    Ok(())
}

/// `POST {wabaId}/generate_payment_configuration_oauth_link`.
pub async fn regenerate_oauth(
    meta: &MetaClient,
    project: &Project,
    config_name: &str,
    body: RegenerateOauthBody,
) -> Result<OauthResponse> {
    if body.redirect_url.is_empty() || config_name.is_empty() {
        return Err(ApiError::BadRequest(
            "Configuration name and redirect URL are required.".to_owned(),
        ));
    }
    let path = format!(
        "{}/generate_payment_configuration_oauth_link",
        waba_for(project)?
    );
    let payload = serde_json::json!({
        "configuration_name": config_name,
        "redirect_url": body.redirect_url,
    });
    let resp: Value = meta.post_json(&path, token_for(project)?, &payload).await?;
    let oauth_url = resp
        .get("oauth_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "Meta response missing oauth_url for generate_payment_configuration_oauth_link"
            ))
        })?
        .to_owned();
    Ok(OauthResponse { oauth_url })
}

/// `DELETE {wabaId}/payment_configuration?configuration_name=...`.
///
/// The TS uses `axios.delete` with a JSON body — Meta's REST docs accept
/// the param either way and `wachat_meta_client::MetaClient::delete`
/// doesn't carry a body, so we pass it as a query parameter (Meta treats
/// the two equivalently for this endpoint).
pub async fn delete(meta: &MetaClient, project: &Project, config_name: &str) -> Result<()> {
    let path = format!(
        "{}/payment_configuration?configuration_name={}",
        waba_for(project)?,
        urlencode(config_name),
    );
    meta.delete(&path, token_for(project)?).await?;
    Ok(())
}

/// Minimal RFC 3986 percent-encoding for query values. Avoids pulling in a
/// full url-encoding crate for one call site. Encodes everything outside
/// the unreserved set.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Local mirror — `projects.paymentConfiguration[]`
// ---------------------------------------------------------------------------

/// Update-or-append a configuration into `projects.paymentConfiguration[]`.
///
/// Mirrors `handlePaymentConfigurationUpdate` (line 225). Match key is
/// `configuration_name`. `update_value` overwrites the slot wholesale.
pub async fn sync_local(
    mongo: &MongoHandle,
    project_id: &ObjectId,
    body: SyncLocalBody,
) -> Result<()> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_value =
        bson::to_bson(&body.update_value).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    // Try to update an existing array element matching the configuration_name.
    let updated = coll
        .update_one(
            doc! {
                "_id": project_id,
                "paymentConfiguration.configuration_name": &body.configuration_name,
            },
            doc! {
                "$set": {
                    "paymentConfiguration.$": new_value.clone(),
                    "updatedAt": now,
                },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    if updated.matched_count == 0 {
        // Either the project lacks the field entirely or has no matching
        // entry. `$push` works for both — Mongo creates the array if absent.
        coll.update_one(
            doc! { "_id": project_id },
            doc! {
                "$push": { "paymentConfiguration": new_value },
                "$set": { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    }

    Ok(())
}
