//! Commerce-Manager Graph API forwarders.
//!
//! Mirrors:
//!  * `getCommerceMerchantSettings` (lines ~1477–1505)
//!  * `getFacebookOrders`           (lines ~1507–1539)
//!  * `fulfillOrder`                (lines ~3870–3889)
//!  * `cancelOrder`                 (lines ~3891–3912)
//!  * `refundOrder`                 (lines ~3914–3935)
//!
//! The `Page → commerce_merchant_settings` lookup needs the project's
//! `facebookPageId`, which the typed `wachat_types::Project` struct does
//! not currently model. We re-read the project as a raw Mongo `Document`
//! to pluck that one field; the access-token gate has already happened in
//! the router via `load_project_for`.

use bson::{Document, doc};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ApiError::BadRequest("Access denied.".to_owned()))
}

/// Fetch `facebookPageId` for the project. Returns the same envelope the
/// legacy `getCommerceMerchantSettings` produced when missing.
async fn facebook_page_id_for(mongo: &MongoHandle, project: &Project) -> Result<String> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| {
            ApiError::BadRequest("Project not found or is not configured for Facebook.".to_owned())
        })?;
    let page_id = doc
        .get_str("facebookPageId")
        .ok()
        .map(|s| s.to_owned())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest("Project not found or is not configured for Facebook.".to_owned())
        })?;
    Ok(page_id)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceSettingsResp {
    pub settings: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrdersResp {
    pub orders: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AckResp {
    pub success: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingInfo {
    pub carrier: String,
    pub tracking_number: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FulfillBody {
    pub tracking_info: TrackingInfo,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasonBody {
    #[serde(default)]
    pub reason: Option<String>,
}

/// Wrapper Meta returns when `fields=commerce_merchant_settings{...}` is
/// requested on a Page node.
#[derive(Debug, Deserialize)]
struct PageSettingsEnvelope {
    #[serde(default)]
    commerce_merchant_settings: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct DataEnvelope {
    #[serde(default)]
    data: Vec<Value>,
}

/// `getCommerceMerchantSettings(projectId)` — pulls the Page's nested
/// commerce-manager settings sub-object. Returns 400 when the page has no
/// shop set up, matching the legacy envelope.
pub async fn get_commerce_merchant_settings(
    mongo: &MongoHandle,
    meta: &MetaClient,
    project: &Project,
) -> Result<CommerceSettingsResp> {
    let token = token_for(project)?;
    let page_id = facebook_page_id_for(mongo, project).await?;
    let path = format!(
        "{page_id}?fields=commerce_merchant_settings%7Bid,commerce_manager_url,display_name,shops%7D"
    );
    let env: PageSettingsEnvelope = meta.get_json(&path, token).await?;
    let settings = env.commerce_merchant_settings.ok_or_else(|| {
        ApiError::BadRequest(
            "No Commerce Merchant Settings found for this Page. Please set up a shop in Meta Commerce Manager."
                .to_owned(),
        )
    })?;
    Ok(CommerceSettingsResp { settings })
}

/// `getFacebookOrders(projectId)` — chains the commerce-settings lookup,
/// pulls the `id`, then lists orders against
/// `/{commerceAccountId}/orders`.
pub async fn get_facebook_orders(
    mongo: &MongoHandle,
    meta: &MetaClient,
    project: &Project,
) -> Result<OrdersResp> {
    let CommerceSettingsResp { settings } = get_commerce_merchant_settings(mongo, meta, project)
        .await
        .map_err(|e| match e {
            ApiError::BadRequest(m) => {
                ApiError::BadRequest(format!("Could not retrieve commerce settings: {m}"))
            }
            other => other,
        })?;

    let commerce_account_id = settings
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_owned())
        .ok_or_else(|| {
            ApiError::BadRequest(
                "Commerce Account ID not found. Ensure a shop is set up and connected.".to_owned(),
            )
        })?;

    let token = token_for(project)?;
    let path = format!(
        "{commerce_account_id}/orders?fields=id,buyer_details,order_status,estimated_payment_details,created,updated"
    );
    let env: DataEnvelope = meta.get_json(&path, token).await?;
    Ok(OrdersResp { orders: env.data })
}

/// `fulfillOrder(orderId, projectId, trackingInfo)` —
/// `POST /{orderId}/shipments` with `{tracking: {...}}`.
pub async fn fulfill_order(
    meta: &MetaClient,
    project: &Project,
    order_id: &str,
    tracking: TrackingInfo,
) -> Result<AckResp> {
    let token = token_for(project)?;
    let payload = json!({
        "tracking": {
            "carrier": tracking.carrier,
            "tracking_number": tracking.tracking_number,
        },
    });
    let path = format!("{order_id}/shipments");
    let _: Value = meta.post_json(&path, token, &payload).await?;
    Ok(AckResp { success: true })
}

/// `cancelOrder(orderId, projectId, reason?)` —
/// `POST /{orderId}/cancellations`. Reason is optional.
pub async fn cancel_order(
    meta: &MetaClient,
    project: &Project,
    order_id: &str,
    reason: Option<String>,
) -> Result<AckResp> {
    let token = token_for(project)?;
    let mut payload = serde_json::Map::new();
    if let Some(r) = reason.filter(|s| !s.is_empty()) {
        payload.insert("reason".to_owned(), Value::String(r));
    }
    let body = Value::Object(payload);
    let path = format!("{order_id}/cancellations");
    let _: Value = meta.post_json(&path, token, &body).await?;
    Ok(AckResp { success: true })
}

/// `refundOrder(orderId, projectId, reason?)` —
/// `POST /{orderId}/refunds`. Reason is optional.
pub async fn refund_order(
    meta: &MetaClient,
    project: &Project,
    order_id: &str,
    reason: Option<String>,
) -> Result<AckResp> {
    let token = token_for(project)?;
    let mut payload = serde_json::Map::new();
    if let Some(r) = reason.filter(|s| !s.is_empty()) {
        payload.insert("reason".to_owned(), Value::String(r));
    }
    let body = Value::Object(payload);
    let path = format!("{order_id}/refunds");
    let _: Value = meta.post_json(&path, token, &body).await?;
    Ok(AckResp { success: true })
}
