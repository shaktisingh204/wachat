//! HTTP handlers for the Ad Manager Pixels-and-friends domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/ad-manager.actions.ts` (Pixels + Conversions API +
//! Offline Events + Lead Gen + Catalogs slice). The TS originals return
//! `{ data?, error? }` envelopes and never throw — handlers below mirror
//! that convention so callers branch on `body.error` rather than HTTP
//! status.
//!
//! ## Auth
//!
//! Every endpoint requires a valid JWT (extracted as [`AuthUser`]). The
//! user's `adManagerAccessToken` is then resolved off the `users`
//! collection — same field the TS `requireToken()` helper reads from the
//! session object.
//!
//! ## Token plumbing
//!
//! The TS code passes `?access_token=…` on every Graph API call. We let
//! `MetaClient` send the token via `Authorization: Bearer` instead — Meta
//! accepts both forms equivalently.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::warn;
use wachat_meta_client::{MetaClient, MetaError};

use crate::dto::{
    AckResult, ConversionApiEventBody, CreateCustomConversionBody, CreatePixelBody,
    CreateProductSetBody, LeadsQuery, ListResp, PixelStatsQuery, SharePixelBody,
    UploadOfflineEventsBody, ValueResp,
};
use crate::state::WachatAdsPixelsState;

const USERS_COLLECTION: &str = "users";

const ERR_AD_MANAGER_NOT_CONNECTED: &str = "Ad Manager account not connected.";

const CUSTOM_CONVERSION_FIELDS: &str = "id,name,description,custom_event_type,rule,account_id,aggregation_rule,creation_time,last_fired_time,pixel,default_conversion_value";

// =========================================================================
//  Token helper
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Mirrors the TS `requireToken()` helper at the top of
/// `ad-manager.actions.ts`: looks up `adManagerAccessToken` on the user
/// document and returns a friendly error string when absent.
async fn require_ad_manager_token(
    user: &AuthUser,
    mongo: &MongoHandle,
) -> std::result::Result<String, String> {
    let user_oid = parse_user_oid(user).map_err(|_| "Authentication required.".to_owned())?;

    let users = mongo.collection::<Document>(USERS_COLLECTION);
    let doc = match users.find_one(doc! { "_id": user_oid }).await {
        Ok(Some(d)) => d,
        Ok(None) => return Err(ERR_AD_MANAGER_NOT_CONNECTED.to_owned()),
        Err(e) => {
            warn!("[ads-pixels] failed to load user doc: {e}");
            return Err(ERR_AD_MANAGER_NOT_CONNECTED.to_owned());
        }
    };

    match doc
        .get_str("adManagerAccessToken")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(t) => Ok(t.to_owned()),
        None => Err(ERR_AD_MANAGER_NOT_CONNECTED.to_owned()),
    }
}

/// Squash a `MetaError` into the `String` shape the TS callers expect.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

/// Mirror the TS `withActPrefix` helper.
fn with_act_prefix(id: &str) -> String {
    if id.is_empty() {
        return id.to_owned();
    }
    if id.starts_with("act_") {
        id.to_owned()
    } else {
        format!("act_{id}")
    }
}

fn strip_act_prefix(id: &str) -> &str {
    id.strip_prefix("act_").unwrap_or(id)
}

async fn graph_get(
    meta: &MetaClient,
    path: &str,
    token: &str,
) -> std::result::Result<Value, MetaError> {
    meta.get_json::<Value>(path, token).await
}

fn pull_data_array(v: Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  PIXELS
// =========================================================================

// ---- listPixels ----------------------------------------------------------

pub async fn list_pixels(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(ad_account_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{}/adspixels?fields=id,name,code,last_fired_time,is_created_by_business,creation_time,owner_business",
        with_act_prefix(&ad_account_id)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- createPixel ---------------------------------------------------------

pub async fn create_pixel(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreatePixelBody>,
) -> Json<AckResult> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!("{}/adspixels", with_act_prefix(&ad_account_id));
    let payload = json!({ "name": body.name });
    match s.meta.post_json::<_, Value>(&path, &token, &payload).await {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- getPixelStats -------------------------------------------------------

pub async fn get_pixel_stats(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(pixel_id): Path<String>,
    Query(q): Query<PixelStatsQuery>,
) -> Json<ValueResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ValueResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let agg = q.aggregation.as_deref().unwrap_or("event");
    let path = format!("{pixel_id}/stats?aggregation={}", urlencoding::encode(agg));
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ValueResp {
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(ValueResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- sharePixelWithAdAccount --------------------------------------------

pub async fn share_pixel_with_ad_account(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(pixel_id): Path<String>,
    Json(body): Json<SharePixelBody>,
) -> Json<AckResult> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!("{pixel_id}/shared_accounts");
    let payload = json!({ "account_id": strip_act_prefix(&body.ad_account_id) });
    match s.meta.post_json::<_, Value>(&path, &token, &payload).await {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  CUSTOM CONVERSIONS
// =========================================================================

pub async fn list_custom_conversions(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(ad_account_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{}/customconversions?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(CUSTOM_CONVERSION_FIELDS)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

/// Note: the same name `createCustomConversion` exists in
/// `ad-manager-features.actions.ts`; this port disambiguates by sourcing
/// from `ad-manager.actions.ts` (the Pixels slice).
pub async fn create_custom_conversion(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreateCustomConversionBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.custom_event_type.trim().is_empty() {
        return Json(AckResult {
            error: Some("custom_event_type is required.".to_owned()),
            ..Default::default()
        });
    }

    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let rule_str = match serde_json::to_string(&body.rule) {
        Ok(s) => s,
        Err(_) => {
            return Json(AckResult {
                error: Some("Invalid rule payload.".to_owned()),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("name".into(), Value::String(body.name));
    payload.insert(
        "description".into(),
        Value::String(body.description.unwrap_or_default()),
    );
    payload.insert(
        "custom_event_type".into(),
        Value::String(body.custom_event_type),
    );
    payload.insert("rule".into(), Value::String(rule_str));
    if let Some(v) = body.default_conversion_value {
        if let Some(num) = serde_json::Number::from_f64(v) {
            payload.insert("default_conversion_value".into(), Value::Number(num));
        }
    }

    let path = format!("{}/customconversions", with_act_prefix(&ad_account_id));
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &Value::Object(payload))
        .await
    {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  CONVERSIONS API + OFFLINE EVENTS
// =========================================================================

pub async fn send_conversion_api_event(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(pixel_id): Path<String>,
    Json(body): Json<ConversionApiEventBody>,
) -> Json<AckResult> {
    if pixel_id.trim().is_empty() {
        return Json(AckResult {
            error: Some("Invalid pixel id.".to_owned()),
            ..Default::default()
        });
    }
    if body.event_name.trim().is_empty() {
        return Json(AckResult {
            error: Some("event_name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.event_time <= 0 {
        return Json(AckResult {
            error: Some("event_time must be positive.".to_owned()),
            ..Default::default()
        });
    }

    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    // Build the single-event payload Graph expects (a JSON-stringified
    // array of one event).
    let mut event = serde_json::Map::new();
    event.insert("event_name".into(), Value::String(body.event_name));
    event.insert("event_time".into(), Value::Number(body.event_time.into()));
    event.insert(
        "action_source".into(),
        Value::String(body.action_source.unwrap_or_else(|| "website".to_owned())),
    );
    if let Some(url) = body.event_source_url {
        event.insert("event_source_url".into(), Value::String(url));
    }
    event.insert("user_data".into(), body.user_data);
    if let Some(custom) = body.custom_data {
        event.insert("custom_data".into(), custom);
    }
    let events_array = Value::Array(vec![Value::Object(event)]);
    let data_str = match serde_json::to_string(&events_array) {
        Ok(s) => s,
        Err(_) => {
            return Json(AckResult {
                error: Some("Failed to encode event payload.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{pixel_id}/events");
    let payload = json!({ "data": data_str });
    match s.meta.post_json::<_, Value>(&path, &token, &payload).await {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn list_offline_event_sets(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(ad_account_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,description,event_stats,valid_entries,matched_entries";
    let path = format!(
        "{}/offline_conversion_data_sets?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn upload_offline_events(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(data_set_id): Path<String>,
    Json(body): Json<UploadOfflineEventsBody>,
) -> Json<AckResult> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let data_str = match serde_json::to_string(&body.events) {
        Ok(s) => s,
        Err(_) => {
            return Json(AckResult {
                error: Some("Failed to encode events payload.".to_owned()),
                ..Default::default()
            });
        }
    };

    // Mirror the TS `upload_tag: sabnode_${Date.now()}` convention.
    let upload_tag = format!("sabnode_{}", chrono::Utc::now().timestamp_millis());

    let path = format!("{data_set_id}/events");
    let payload = json!({
        "upload_tag": upload_tag,
        "data": data_str,
    });
    match s.meta.post_json::<_, Value>(&path, &token, &payload).await {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  LEAD GEN FORMS
// =========================================================================

pub async fn list_lead_gen_forms(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(page_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,status,locale,leads_count,created_time,privacy_policy_url";
    let path = format!(
        "{page_id}/leadgen_forms?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn get_leads_from_form(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(form_id): Path<String>,
    Query(q): Query<LeadsQuery>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let fields = "id,created_time,field_data,form_id,ad_id,adset_id,campaign_id";
    let mut path = format!("{form_id}/leads?fields={}", urlencoding::encode(fields));
    if let Some(since) = q.since {
        let filtering = json!([{
            "field": "time_created",
            "operator": "GREATER_THAN",
            "value": since,
        }]);
        let filtering_str = match serde_json::to_string(&filtering) {
            Ok(s) => s,
            Err(_) => String::new(),
        };
        if !filtering_str.is_empty() {
            path.push_str("&filtering=");
            path.push_str(&urlencoding::encode(&filtering_str));
        }
    }

    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  CATALOGS / PRODUCT SETS
// =========================================================================

pub async fn list_catalogs(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(business_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,product_count,vertical,feed_count";
    let path = format!(
        "{business_id}/owned_product_catalogs?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn list_product_sets(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(catalog_id): Path<String>,
) -> Json<ListResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,product_count,filter";
    let path = format!(
        "{catalog_id}/product_sets?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

pub async fn create_product_set(
    user: AuthUser,
    State(s): State<WachatAdsPixelsState>,
    Path(catalog_id): Path<String>,
    Json(body): Json<CreateProductSetBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }

    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("name".into(), Value::String(body.name));
    if let Some(filter) = body.filter {
        match serde_json::to_string(&filter) {
            Ok(s) => {
                payload.insert("filter".into(), Value::String(s));
            }
            Err(_) => {
                return Json(AckResult {
                    error: Some("Invalid filter payload.".to_owned()),
                    ..Default::default()
                });
            }
        }
    }

    let path = format!("{catalog_id}/product_sets");
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &Value::Object(payload))
        .await
    {
        Ok(v) => Json(AckResult {
            success: Some(true),
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}
