//! WABA setup proxies — thin wrappers around three direct Meta Cloud API
//! calls the legacy `_createProjectFromWaba` / project rename helpers in
//! `src/app/actions/whatsapp.actions.ts` made via `axios` / `fetch`.
//!
//! These all hit `graph.facebook.com` and are pre-project (i.e. there is
//! no persisted `accessToken` on disk yet at call time) — so the access
//! token is supplied by the caller, never fetched from Mongo here.

use sabnode_common::Result;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;

// ---------------------------------------------------------------------------
// GET /me/businesses
// ---------------------------------------------------------------------------

/// One entry in Meta's `GET /me/businesses` `data[]`. We only project the
/// `id` (used to seed `businessId` for catalog features) plus an optional
/// `name` for diagnostics — extra Meta fields are ignored on decode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Business {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BusinessesResponse {
    pub data: Vec<Business>,
}

/// `GET /me/businesses` — returns the list of Meta Business Accounts owned
/// by whoever owns `access_token`. Used by `_createProjectFromWaba` when
/// `includeCatalog=true` to seed `businessId` on the new project.
pub async fn get_me_businesses(
    meta: &MetaClient,
    access_token: &str,
) -> Result<BusinessesResponse> {
    #[derive(Deserialize)]
    struct Raw {
        #[serde(default)]
        data: Vec<Business>,
    }
    let raw: Raw = meta.get_json("me/businesses", access_token).await?;
    Ok(BusinessesResponse { data: raw.data })
}

// ---------------------------------------------------------------------------
// GET /{wabaId}?fields=name
// ---------------------------------------------------------------------------

/// Result of `GET /v1/wachat/config/waba/:wabaId/details` — Meta's project
/// (WABA) display name. Mirrors what the legacy code parsed out of
/// `GET /{wabaId}?fields=name`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WabaDetails {
    pub name: String,
}

pub async fn get_waba_details(
    meta: &MetaClient,
    waba_id: &str,
    access_token: &str,
) -> Result<WabaDetails> {
    let path = format!("{waba_id}?fields=name");
    let raw: WabaDetails = meta.get_json(&path, access_token).await?;
    Ok(raw)
}

// ---------------------------------------------------------------------------
// POST /{wabaId} — rename
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWabaNameBody {
    pub name: String,
}

/// `POST /{wabaId}` with `{ name }` — renames the WABA on Meta's side.
/// The legacy code wrote this through `axios.post`; the Rust hop unifies
/// retry/backoff handling with every other Meta call in the system.
pub async fn update_waba_name(
    meta: &MetaClient,
    waba_id: &str,
    access_token: &str,
    name: &str,
) -> Result<Value> {
    let resp: Value = meta
        .post_json(waba_id, access_token, &json!({ "name": name }))
        .await?;
    Ok(resp)
}
