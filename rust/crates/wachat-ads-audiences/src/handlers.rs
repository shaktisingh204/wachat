//! HTTP handlers for the Ad Manager Audiences-and-Targeting domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/ad-manager.actions.ts` (Audiences + Targeting + Reach
//! slice). The TS originals return `{ data?, error? }` envelopes and never
//! throw — handlers below mirror that convention so callers branch on
//! `body.error` rather than HTTP status.
//!
//! ## Auth
//!
//! Every endpoint requires a valid JWT (extracted as [`AuthUser`]). The
//! user's `adManagerAccessToken` is then resolved off the `users`
//! collection — same field the TS `requireToken()` helper reads from the
//! session object.

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
    AckResult, AudienceUsersBody, AudiencesResp, BrowseTargetingQuery, CreateCustomAudienceBody,
    CreateLookalikeBody, CreateRfpBody, CreateSavedAudienceBody, DeliveryEstimateBody, ListResp,
    ReachEstimateBody, SearchTargetingQuery, ShareAudienceBody, SuggestTargetingBody,
    TargetingSentenceLinesBody, ValidateTargetingBody, ValueResp, WebsiteRetargetingBody,
};
use crate::state::WachatAdsAudiencesState;

const USERS_COLLECTION: &str = "users";

const ERR_AD_MANAGER_NOT_CONNECTED: &str = "Ad Manager account not connected.";

/// Same field list the TS `AUDIENCE_FIELDS` constant builds.
const AUDIENCE_FIELDS: &str = "id,name,description,subtype,data_source,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,time_created,time_updated,retention_days,lookalike_spec,customer_file_source,rule,rule_aggregation,is_value_based";

const SAVED_AUDIENCE_FIELDS: &str =
    "id,name,description,targeting,approximate_count_lower_bound,run_status";

const SHARED_ACCOUNTS_FIELDS: &str = "id,account_id,name";

const RFP_FIELDS: &str = "id,name,status,budget,reservation_status,impression_curve,prediction_mode,start_time,end_time,target_audience_size,frequency_cap";

// =========================================================================
//  Token + helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Mirrors the TS `requireToken()` helper: looks up `adManagerAccessToken`
/// on the user document and returns a friendly error string when absent.
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
            warn!("[ads-audiences] failed to load user doc: {e}");
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

fn json_stringify(v: &Value) -> std::result::Result<String, String> {
    serde_json::to_string(v).map_err(|_| "Invalid payload.".to_owned())
}

// =========================================================================
//  CUSTOM AUDIENCES
// =========================================================================

// ---- getCustomAudiences --------------------------------------------------

pub async fn get_custom_audiences(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
) -> Json<AudiencesResp> {
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(AudiencesResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    if ad_account_id.is_empty() {
        return Json(AudiencesResp {
            audiences: Some(Vec::new()),
            ..Default::default()
        });
    }

    let path = format!(
        "{}/customaudiences?fields={}&limit=100",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(AUDIENCE_FIELDS)
    );
    match graph_get(&s.meta, &path, &token).await {
        Ok(v) => Json(AudiencesResp {
            audiences: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(AudiencesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- createCustomAudience ------------------------------------------------

pub async fn create_custom_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreateCustomAudienceBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.subtype.trim().is_empty() {
        return Json(AckResult {
            error: Some("subtype is required.".to_owned()),
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
    payload.insert("subtype".into(), Value::String(body.subtype));
    if let Some(d) = body.description {
        payload.insert("description".into(), Value::String(d));
    }
    if let Some(s) = body.customer_file_source {
        payload.insert("customer_file_source".into(), Value::String(s));
    }
    if let Some(d) = body.retention_days {
        payload.insert("retention_days".into(), Value::Number(d.into()));
    }
    if let Some(rule) = body.rule {
        match json_stringify(&rule) {
            Ok(s) => {
                payload.insert("rule".into(), Value::String(s));
            }
            Err(e) => {
                return Json(AckResult {
                    error: Some(e),
                    ..Default::default()
                });
            }
        }
    }

    let path = format!("{}/customaudiences", with_act_prefix(&ad_account_id));
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

// ---- createLookalikeAudience --------------------------------------------

pub async fn create_lookalike_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreateLookalikeBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.origin_audience_id.trim().is_empty() {
        return Json(AckResult {
            error: Some("origin_audience_id is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.country.trim().is_empty() {
        return Json(AckResult {
            error: Some("country is required.".to_owned()),
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

    let ratio = body.ratio.unwrap_or(0.01);
    let lookalike_spec = json!({
        "type": "similarity",
        "country": body.country,
        "ratio": ratio,
    });
    let lookalike_spec_str = match json_stringify(&lookalike_spec) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let payload = json!({
        "name": body.name,
        "subtype": "LOOKALIKE",
        "origin_audience_id": body.origin_audience_id,
        "lookalike_spec": lookalike_spec_str,
    });

    let path = format!("{}/customaudiences", with_act_prefix(&ad_account_id));
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &payload)
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

// ---- deleteCustomAudience -----------------------------------------------

pub async fn delete_custom_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
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

    match s.meta.delete(&audience_id, &token).await {
        Ok(()) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- addUsersToCustomAudience -------------------------------------------

pub async fn add_users_to_custom_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
    Json(body): Json<AudienceUsersBody>,
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

    let inner = json!({
        "schema": body.schema,
        "data": body.hashed_users,
    });
    let payload_str = match json_stringify(&inner) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!("{audience_id}/users");
    let payload = json!({ "payload": payload_str });
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &payload)
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

// ---- removeUsersFromCustomAudience --------------------------------------
//
// The TS implementation issues `DELETE` with a JSON body. `MetaClient::delete`
// doesn't accept a body, but Meta's Marketing API equivalently accepts the
// payload via a `?payload=…` query string on DELETE — this is what we use
// here.

pub async fn remove_users_from_custom_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
    Json(body): Json<AudienceUsersBody>,
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

    let inner = json!({
        "schema": body.schema,
        "data": body.hashed_users,
    });
    let payload_str = match json_stringify(&inner) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{audience_id}/users?payload={}",
        urlencoding::encode(&payload_str)
    );
    match s.meta.delete(&path, &token).await {
        Ok(()) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// ---- shareCustomAudience ------------------------------------------------

pub async fn share_custom_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
    Json(body): Json<ShareAudienceBody>,
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

    let prefixed: Vec<String> = body
        .account_ids
        .iter()
        .map(|a| with_act_prefix(a))
        .collect();
    let arr_str = match json_stringify(&Value::Array(
        prefixed.into_iter().map(Value::String).collect(),
    )) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!("{audience_id}/adaccounts");
    let payload = json!({ "adaccounts": arr_str });
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &payload)
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

// ---- listSharedAudienceAccounts -----------------------------------------

pub async fn list_shared_audience_accounts(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
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
        "{audience_id}/adaccounts?fields={}",
        urlencoding::encode(SHARED_ACCOUNTS_FIELDS)
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

// ---- createWebsiteRetargetingAudience -----------------------------------
//
// Wraps `createCustomAudience` with `subtype=WEBSITE` and the supplied rule.
// Mirrors the TS helper of the same name.

pub async fn create_website_retargeting_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<WebsiteRetargetingBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.pixel_id.trim().is_empty() {
        return Json(AckResult {
            error: Some("pixel_id is required.".to_owned()),
            ..Default::default()
        });
    }

    // Delegate to create_custom_audience with the synthesized fields. We
    // inline the call to avoid double Mongo round-trips.
    let inner = CreateCustomAudienceBody {
        name: body.name,
        description: None,
        subtype: "WEBSITE".to_owned(),
        customer_file_source: None,
        retention_days: Some(body.retention_days.unwrap_or(180)),
        rule: Some(body.rule),
    };
    create_custom_audience(user, State(s), Path(ad_account_id), Json(inner)).await
}

// =========================================================================
//  SAVED AUDIENCES
// =========================================================================

pub async fn get_saved_audiences(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
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
        "{}/saved_audiences?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(SAVED_AUDIENCE_FIELDS)
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

pub async fn create_saved_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreateSavedAudienceBody>,
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

    let targeting_str = match json_stringify(&body.targeting) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let payload = json!({
        "name": body.name,
        "description": body.description.unwrap_or_default(),
        "targeting": targeting_str,
    });

    let path = format!("{}/saved_audiences", with_act_prefix(&ad_account_id));
    match s
        .meta
        .post_json::<_, Value>(&path, &token, &payload)
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

pub async fn delete_saved_audience(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(audience_id): Path<String>,
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

    match s.meta.delete(&audience_id, &token).await {
        Ok(()) => Json(AckResult {
            success: Some(true),
            ..Default::default()
        }),
        Err(e) => Json(AckResult {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  TARGETING SEARCH / BROWSE / SUGGEST / VALIDATE
// =========================================================================

pub async fn search_targeting(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Query(q): Query<SearchTargetingQuery>,
) -> Json<ListResp> {
    if q.q.trim().is_empty() {
        return Json(ListResp {
            error: Some("Query string `q` is required.".to_owned()),
            ..Default::default()
        });
    }
    let token = match require_ad_manager_token(&user, &s.mongo).await {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let typ = q.type_.as_deref().unwrap_or("adinterest");
    let mut path = format!(
        "search?type={}&q={}&limit=25",
        urlencoding::encode(typ),
        urlencoding::encode(&q.q)
    );
    if typ == "adgeolocation" {
        if let Some(loc_csv) = q.location_types.as_deref() {
            let parts: Vec<Value> = loc_csv
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| Value::String(s.to_owned()))
                .collect();
            if !parts.is_empty() {
                if let Ok(s) = serde_json::to_string(&Value::Array(parts)) {
                    path.push_str("&location_types=");
                    path.push_str(&urlencoding::encode(&s));
                }
            }
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

pub async fn browse_targeting(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Query(q): Query<BrowseTargetingQuery>,
) -> Json<ListResp> {
    if q.type_.trim().is_empty() {
        return Json(ListResp {
            error: Some("Query string `type` is required.".to_owned()),
            ..Default::default()
        });
    }
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
        "targetingbrowse?type={}",
        urlencoding::encode(&q.type_)
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

pub async fn suggest_targeting(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Json(body): Json<SuggestTargetingBody>,
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

    let interest_list_str = match serde_json::to_string(&body.interest_list) {
        Ok(s) => s,
        Err(_) => {
            return Json(ListResp {
                error: Some("Invalid interestList payload.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "search?type=adinterestsuggestion&interest_list={}&limit=25",
        urlencoding::encode(&interest_list_str)
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

pub async fn validate_targeting(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Json(body): Json<ValidateTargetingBody>,
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

    let names: Vec<String> = body.interests.iter().map(|i| i.name.clone()).collect();
    let ids: Vec<String> = body.interests.iter().map(|i| i.id.clone()).collect();
    let names_str = match serde_json::to_string(&names) {
        Ok(s) => s,
        Err(_) => String::from("[]"),
    };
    let ids_str = match serde_json::to_string(&ids) {
        Ok(s) => s,
        Err(_) => String::from("[]"),
    };

    let path = format!(
        "search?type=adinterestvalid&interest_list={}&interest_fbid_list={}",
        urlencoding::encode(&names_str),
        urlencoding::encode(&ids_str),
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

// ---- getTargetingSentenceLines ------------------------------------------

pub async fn get_targeting_sentence_lines(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<TargetingSentenceLinesBody>,
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

    let targeting_str = match json_stringify(&body.targeting) {
        Ok(s) => s,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{}/targetingsentencelines?targeting_spec={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(&targeting_str)
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

// =========================================================================
//  REACH / DELIVERY ESTIMATES
// =========================================================================

pub async fn get_reach_estimate(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<ReachEstimateBody>,
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

    let targeting_str = match json_stringify(&body.targeting) {
        Ok(s) => s,
        Err(e) => {
            return Json(ValueResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut path = format!(
        "{}/reachestimate?targeting_spec={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(&targeting_str)
    );
    if let Some(g) = body.optimization_goal.as_deref() {
        if !g.is_empty() {
            path.push_str("&optimization_goal=");
            path.push_str(&urlencoding::encode(g));
        }
    }
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

pub async fn get_delivery_estimate(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<DeliveryEstimateBody>,
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
    if body.optimization_goal.trim().is_empty() {
        return Json(ValueResp {
            error: Some("optimization_goal is required.".to_owned()),
            ..Default::default()
        });
    }

    let targeting_str = match json_stringify(&body.targeting_spec) {
        Ok(s) => s,
        Err(e) => {
            return Json(ValueResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut path = format!(
        "{}/delivery_estimate?targeting_spec={}&optimization_goal={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(&targeting_str),
        urlencoding::encode(&body.optimization_goal),
    );
    if let Some(b) = body.daily_budget {
        path.push_str("&daily_budget=");
        path.push_str(&b.to_string());
    }
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

// =========================================================================
//  REACH-AND-FREQUENCY PREDICTIONS
// =========================================================================

pub async fn create_reach_frequency_prediction(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
    Path(ad_account_id): Path<String>,
    Json(body): Json<CreateRfpBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return Json(AckResult {
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    if body.start_time.trim().is_empty() || body.end_time.trim().is_empty() {
        return Json(AckResult {
            error: Some("start_time and end_time are required.".to_owned()),
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

    let target_spec_str = match json_stringify(&body.target_spec) {
        Ok(s) => s,
        Err(e) => {
            return Json(AckResult {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut payload = serde_json::Map::new();
    payload.insert("name".into(), Value::String(body.name));
    payload.insert("target_spec".into(), Value::String(target_spec_str));
    payload.insert("budget".into(), Value::Number(body.budget.into()));
    payload.insert("start_time".into(), Value::String(body.start_time));
    payload.insert("end_time".into(), Value::String(body.end_time));
    payload.insert(
        "buying_type".into(),
        Value::String(body.buying_type.unwrap_or_else(|| "RESERVED".to_owned())),
    );
    if let Some(v) = body.prediction_mode {
        payload.insert("prediction_mode".into(), Value::Number(v.into()));
    }
    if let Some(v) = body.story_event_type {
        payload.insert("story_event_type".into(), Value::Number(v.into()));
    }
    if let Some(v) = body.destination_id {
        payload.insert("destination_id".into(), Value::String(v));
    }
    if let Some(v) = body.destination_ids {
        if let Ok(s) = serde_json::to_string(&v) {
            payload.insert("destination_ids".into(), Value::String(s));
        }
    }
    if let Some(v) = body.instream_packages {
        if let Ok(s) = serde_json::to_string(&v) {
            payload.insert("instream_packages".into(), Value::String(s));
        }
    }
    // campaign_group_id is consumed for API parity but the TS code does not
    // currently forward it (matches the legacy behaviour).
    let _ = body.campaign_group_id;

    let path = format!(
        "{}/reachfrequencypredictions",
        with_act_prefix(&ad_account_id)
    );
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

pub async fn list_reach_frequency_predictions(
    user: AuthUser,
    State(s): State<WachatAdsAudiencesState>,
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
        "{}/reachfrequencypredictions?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(RFP_FIELDS)
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
