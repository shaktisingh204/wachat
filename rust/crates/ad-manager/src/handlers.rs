//! Axum handlers — bind the proxy + store layers to HTTP routes.

use axum::{
    Json,
    extract::{Multipart, Path, State},
};
use futures::future::join_all;
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::bson_helpers::oid_from_str;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    graph::{self, GraphProxyBody, GraphProxyResult, TokenKind, fetch_token, missing_token_error},
    state::AdManagerState,
    store::{
        self, AdAccountsResult, CountResult, DeleteAdAccountBody, DeleteLocalCampaignsByMetaIdBody,
        InsertLocalCampaignBody, ListLocalCampaignsBody, LocalCampaignsResult,
        SetMetaAdAccountsBody, SuccessResult, UpdateLocalStatusBody,
    },
};

// ---------------------------------------------------------------------------
// Generic Graph proxy
// ---------------------------------------------------------------------------

pub async fn graph_proxy(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<GraphProxyBody>,
) -> Result<Json<GraphProxyResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(graph::proxy(&s, oid, body).await?))
}

// ---------------------------------------------------------------------------
// Ad accounts (Mongo-backed)
// ---------------------------------------------------------------------------

pub async fn get_ad_accounts(
    user: AuthUser,
    State(s): State<AdManagerState>,
) -> Result<Json<AdAccountsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::get_ad_accounts(&s.mongo, oid).await?))
}

pub async fn delete_ad_account(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<DeleteAdAccountBody>,
) -> Result<Json<SuccessResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::delete_ad_account(&s.mongo, oid, &body.account_id).await?,
    ))
}

// ---------------------------------------------------------------------------
// Local ad_campaigns CRUD
// ---------------------------------------------------------------------------

pub async fn list_local_campaigns(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<ListLocalCampaignsBody>,
) -> Result<Json<LocalCampaignsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::list_local_campaigns(&s.mongo, oid, &body.ad_account_id).await?,
    ))
}

pub async fn insert_local_campaign(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<InsertLocalCampaignBody>,
) -> Result<Json<SuccessResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::insert_local_campaign(&s.mongo, oid, body).await?,
    ))
}

pub async fn delete_local_campaigns_by_meta_id(
    _user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<DeleteLocalCampaignsByMetaIdBody>,
) -> Result<Json<SuccessResult>> {
    Ok(Json(
        store::delete_local_campaigns_by_meta_id(&s.mongo, &body.meta_campaign_id).await?,
    ))
}

pub async fn update_local_campaign_status(
    _user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<UpdateLocalStatusBody>,
) -> Result<Json<SuccessResult>> {
    Ok(Json(
        store::update_local_campaign_status(&s.mongo, &body.meta_campaign_id, &body.status).await?,
    ))
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

pub async fn count_local_campaigns_user(
    user: AuthUser,
    State(s): State<AdManagerState>,
) -> Result<Json<CountResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::count_local_campaigns_for_user(&s.mongo, oid).await?,
    ))
}

pub async fn count_local_campaigns_global(
    user: AuthUser,
    State(s): State<AdManagerState>,
) -> Result<Json<CountResult>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(sabnode_common::ApiError::Forbidden(
            "admin role required".to_owned(),
        ));
    }
    Ok(Json(store::count_local_campaigns_global(&s.mongo).await?))
}

pub async fn set_meta_ad_accounts(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<SetMetaAdAccountsBody>,
) -> Result<Json<SuccessResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::set_meta_ad_accounts(&s.mongo, oid, body.accounts).await?,
    ))
}

// ---------------------------------------------------------------------------
// Aggregating handlers (compose multiple Graph calls + reshape).
// These previously lived in `ad-manager-features.actions.ts` as
// per-page server actions. Moving them to Rust eliminates the chatty
// TS↔Rust round-trips when computing a single page tile.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
pub struct CompareCampaignsBody {
    pub campaign_ids: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareCampaignsResult {
    pub comparisons: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn compare_campaigns(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<CompareCampaignsBody>,
) -> Result<Json<CompareCampaignsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let mut tasks = Vec::with_capacity(body.campaign_ids.len());
    for id in &body.campaign_ids {
        let s = s.clone();
        let id = id.clone();
        let proxy_body = GraphProxyBody {
            path: format!("{id}/insights"),
            method: "GET".to_owned(),
            params: serde_json::json!({
                "fields": "campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr,actions",
                "date_preset": "last_30d",
            })
            .as_object()
            .unwrap()
            .clone(),
            body: None,
            token_kind: TokenKind::AdManager,
        };
        tasks.push(async move {
            let res = graph::proxy(&s, oid, proxy_body).await;
            (id, res)
        });
    }
    let mut comparisons = Vec::with_capacity(body.campaign_ids.len());
    for (id, res) in join_all(tasks).await {
        let mut entry = serde_json::Map::new();
        entry.insert("campaignId".to_owned(), Value::String(id));
        if let Ok(r) = res {
            if let Some(data) = r
                .data
                .as_ref()
                .and_then(|d| d.get("data"))
                .and_then(Value::as_array)
                .and_then(|arr| arr.first())
                .and_then(Value::as_object)
            {
                for (k, v) in data {
                    entry.insert(k.clone(), v.clone());
                }
            }
        }
        comparisons.push(Value::Object(entry));
    }
    Ok(Json(CompareCampaignsResult {
        comparisons,
        error: None,
    }))
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetRecommendationsResult {
    pub recommendations: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_budget_recommendations(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Path(ad_account_id): Path<String>,
) -> Result<Json<BudgetRecommendationsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let act = with_act_prefix(&ad_account_id);

    // Active campaigns + insights for the ad account.
    let campaigns_body = GraphProxyBody {
        path: format!("{act}/campaigns"),
        method: "GET".to_owned(),
        params: serde_json::json!({
            "fields": "id,name,status,daily_budget,lifetime_budget",
            "effective_status": "[\"ACTIVE\"]",
            "limit": 20,
        })
        .as_object()
        .unwrap()
        .clone(),
        body: None,
        token_kind: TokenKind::AdManager,
    };
    let campaigns_res = graph::proxy(&s, oid, campaigns_body).await?;
    if let Some(err) = campaigns_res.error {
        return Ok(Json(BudgetRecommendationsResult {
            recommendations: Vec::new(),
            error: Some(err),
        }));
    }
    let campaigns: Vec<Value> = campaigns_res
        .data
        .as_ref()
        .and_then(|d| d.get("data"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if campaigns.is_empty() {
        return Ok(Json(BudgetRecommendationsResult {
            recommendations: Vec::new(),
            error: None,
        }));
    }

    let insights_body = GraphProxyBody {
        path: format!("{act}/insights"),
        method: "GET".to_owned(),
        params: serde_json::json!({
            "fields": "campaign_id,campaign_name,spend,impressions,clicks,cpc,ctr,actions",
            "level": "campaign",
            "date_preset": "last_7d",
            "limit": 20,
        })
        .as_object()
        .unwrap()
        .clone(),
        body: None,
        token_kind: TokenKind::AdManager,
    };
    let insights_res = graph::proxy(&s, oid, insights_body).await?;
    if let Some(err) = insights_res.error {
        return Ok(Json(BudgetRecommendationsResult {
            recommendations: Vec::new(),
            error: Some(err),
        }));
    }
    let insights: Vec<Value> = insights_res
        .data
        .as_ref()
        .and_then(|d| d.get("data"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let recommendations = insights
        .iter()
        .map(|ins| {
            let spend = num(ins.get("spend"));
            let clicks = num(ins.get("clicks"));
            let cpc = num(ins.get("cpc"));
            let ctr = num(ins.get("ctr"));
            let campaign_id = ins
                .get("campaign_id")
                .and_then(Value::as_str)
                .unwrap_or("");
            let campaign_name = ins
                .get("campaign_name")
                .and_then(Value::as_str)
                .unwrap_or("");
            let daily_budget = campaigns
                .iter()
                .find(|c| c.get("id").and_then(Value::as_str) == Some(campaign_id))
                .and_then(|c| c.get("daily_budget"))
                .map(|v| num(Some(v)) / 100.0)
                .unwrap_or(0.0);

            let (recommendation, reason) = if ctr > 2.0 && cpc < 0.5 {
                (
                    "increase",
                    format!("High CTR ({ctr}%) and low CPC (${cpc:.2}) — increase budget to scale."),
                )
            } else if ctr < 0.5 && spend > 10.0 {
                (
                    "decrease",
                    format!("Low CTR ({ctr}%) with significant spend — reduce budget or optimize creative."),
                )
            } else if clicks == 0.0 && spend > 5.0 {
                (
                    "pause",
                    format!("No clicks after ${spend:.2} spend — consider pausing."),
                )
            } else {
                ("maintain", "Performance is within expected range.".to_owned())
            };

            serde_json::json!({
                "campaignId": campaign_id,
                "campaignName": campaign_name,
                "spend": spend,
                "clicks": clicks,
                "cpc": cpc,
                "ctr": ctr,
                "dailyBudget": daily_budget,
                "recommendation": recommendation,
                "reason": reason,
            })
        })
        .collect();

    Ok(Json(BudgetRecommendationsResult {
        recommendations,
        error: None,
    }))
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionFunnelResult {
    pub funnel: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_conversion_funnel(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Path(ad_account_id): Path<String>,
) -> Result<Json<ConversionFunnelResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let act = with_act_prefix(&ad_account_id);
    let body = GraphProxyBody {
        path: format!("{act}/insights"),
        method: "GET".to_owned(),
        params: serde_json::json!({
            "fields": "impressions,reach,clicks,actions,action_values,spend",
            "date_preset": "last_30d",
        })
        .as_object()
        .unwrap()
        .clone(),
        body: None,
        token_kind: TokenKind::AdManager,
    };
    let res = graph::proxy(&s, oid, body).await?;
    if let Some(err) = res.error {
        return Ok(Json(ConversionFunnelResult {
            funnel: Value::Null,
            error: Some(err),
        }));
    }
    let row = res
        .data
        .as_ref()
        .and_then(|d| d.get("data"))
        .and_then(Value::as_array)
        .and_then(|arr| arr.first())
        .cloned()
        .unwrap_or(Value::Object(serde_json::Map::new()));

    let impressions = num(row.get("impressions"));
    let reach = num(row.get("reach"));
    let clicks = num(row.get("clicks"));
    let spend = num(row.get("spend"));
    let actions: Vec<Value> = row
        .get("actions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let action_value = |types: &[&str]| -> f64 {
        actions
            .iter()
            .find(|a| {
                a.get("action_type")
                    .and_then(Value::as_str)
                    .map(|t| types.iter().any(|x| x == &t))
                    .unwrap_or(false)
            })
            .map(|a| num(a.get("value")))
            .unwrap_or(0.0)
    };

    let leads = action_value(&["lead"]);
    let purchases = action_value(&["purchase", "offsite_conversion.fb_pixel_purchase"]);
    let add_to_cart = action_value(&["offsite_conversion.fb_pixel_add_to_cart"]);

    Ok(Json(ConversionFunnelResult {
        funnel: serde_json::json!({
            "impressions": impressions,
            "reach": reach,
            "clicks": clicks,
            "addToCart": add_to_cart,
            "leads": leads,
            "purchases": purchases,
            "spend": spend,
        }),
        error: None,
    }))
}

/// Coerce a `Value` to `f64` — accepts numbers and numeric strings,
/// returns `0.0` otherwise. Mirrors the legacy `Number(x) || 0` idiom.
fn num(v: Option<&Value>) -> f64 {
    match v {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(Value::String(s)) => s.parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

// ---------------------------------------------------------------------------
// Decorated local-campaigns list — merges `ad_campaigns` rows with the
// live Graph status + insights for their `metaAdId`s. Replaces the legacy
// `getAdCampaigns` server action.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecoratedCampaignsBody {
    pub ad_account_id: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecoratedCampaignsResult {
    pub campaigns: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn decorated_local_campaigns(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<DecoratedCampaignsBody>,
) -> Result<Json<DecoratedCampaignsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let local = store::list_local_campaigns(&s.mongo, oid, &body.ad_account_id).await?;
    let mut campaigns: Vec<Value> = match local.campaigns {
        Value::Array(a) => a,
        _ => Vec::new(),
    };
    if campaigns.is_empty() {
        return Ok(Json(DecoratedCampaignsResult {
            campaigns,
            error: None,
        }));
    }

    let ad_ids: Vec<String> = campaigns
        .iter()
        .filter_map(|c| c.get("metaAdId").and_then(Value::as_str).map(str::to_owned))
        .filter(|s| !s.is_empty())
        .collect();
    if ad_ids.is_empty() {
        return Ok(Json(DecoratedCampaignsResult {
            campaigns,
            error: None,
        }));
    }

    // Single Graph call: `/?ids=A,B,C&fields=status,insights{...}` returns
    // a map keyed by ad ID. Mirrors what the legacy axios call did.
    let proxy_body = GraphProxyBody {
        path: String::new(),
        method: "GET".to_owned(),
        params: serde_json::json!({
            "ids": ad_ids.join(","),
            "fields": "status,insights{impressions, clicks, spend, ctr}",
        })
        .as_object()
        .unwrap()
        .clone(),
        body: None,
        token_kind: TokenKind::AdManager,
    };
    let res = graph::proxy(&s, oid, proxy_body).await?;
    let by_id = res
        .data
        .as_ref()
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    for c in &mut campaigns {
        if let Some(meta_ad_id) = c.get("metaAdId").and_then(Value::as_str).map(str::to_owned) {
            if let Some(remote) = by_id.get(&meta_ad_id).and_then(Value::as_object) {
                if let Some(obj) = c.as_object_mut() {
                    if let Some(status) = remote.get("status") {
                        obj.insert("status".to_owned(), status.clone());
                    }
                    let insight = remote
                        .get("insights")
                        .and_then(|i| i.get("data"))
                        .and_then(Value::as_array)
                        .and_then(|arr| arr.first())
                        .cloned()
                        .unwrap_or(Value::Object(serde_json::Map::new()));
                    obj.insert("insights".to_owned(), insight);
                }
            }
        }
    }

    Ok(Json(DecoratedCampaignsResult {
        campaigns,
        error: None,
    }))
}

// ---------------------------------------------------------------------------
// Reshape: `/{adSetId}/ads` with insights flattened + imageUrl coalesced.
// Replaces the legacy `getAds` shim.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReshapedAdsBody {
    pub ad_set_id: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReshapedAdsResult {
    pub ads: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn reshaped_ads(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<ReshapedAdsBody>,
) -> Result<Json<ReshapedAdsResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let proxy_body = GraphProxyBody {
        path: format!("{}/ads", body.ad_set_id),
        method: "GET".to_owned(),
        params: serde_json::json!({
            "fields": "id,name,status,creative{image_url,thumbnail_url,object_story_spec},insights{impressions,clicks,spend,ctr}",
        })
        .as_object()
        .unwrap()
        .clone(),
        body: None,
        token_kind: TokenKind::AdManager,
    };
    let res = graph::proxy(&s, oid, proxy_body).await?;
    if let Some(err) = res.error {
        return Ok(Json(ReshapedAdsResult {
            ads: Vec::new(),
            error: Some(err),
        }));
    }

    let raw: Vec<Value> = res
        .data
        .as_ref()
        .and_then(|d| d.get("data"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let ads = raw
        .into_iter()
        .map(|mut ad| {
            let insights = ad
                .get("insights")
                .and_then(|i| i.get("data"))
                .and_then(Value::as_array)
                .and_then(|arr| arr.first())
                .cloned()
                .unwrap_or(Value::Object(serde_json::Map::new()));
            let image_url = ad
                .get("creative")
                .and_then(|c| c.get("image_url").or_else(|| c.get("thumbnail_url")))
                .or_else(|| {
                    ad.get("creative")
                        .and_then(|c| c.get("object_story_spec"))
                        .and_then(|o| o.get("link_data"))
                        .and_then(|l| l.get("image_url"))
                })
                .cloned()
                .unwrap_or(Value::Null);
            if let Some(obj) = ad.as_object_mut() {
                obj.insert("insights".to_owned(), insights);
                obj.insert("imageUrl".to_owned(), image_url);
            }
            ad
        })
        .collect();

    Ok(Json(ReshapedAdsResult { ads, error: None }))
}

// ---------------------------------------------------------------------------
// Multi-step quick-create: campaign → ad set → creative → ad, then insert
// into `ad_campaigns`. Replaces `handleCreateAdCampaign`.
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCreateBody {
    pub ad_account_id: String,
    pub facebook_page_id: String,
    pub campaign_name: String,
    pub daily_budget_minor: i64,
    pub ad_message: String,
    pub destination_url: String,
    #[serde(default = "default_objective")]
    pub objective: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub image_hash: Option<String>,
    #[serde(default = "default_country")]
    pub target_country: String,
    #[serde(default = "default_min_age")]
    pub min_age: i64,
    #[serde(default = "default_max_age")]
    pub max_age: i64,
}

fn default_objective() -> String {
    "OUTCOME_TRAFFIC".to_owned()
}
fn default_status() -> String {
    "PAUSED".to_owned()
}
fn default_country() -> String {
    "IN".to_owned()
}
fn default_min_age() -> i64 {
    18
}
fn default_max_age() -> i64 {
    65
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCreateResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn quick_create_campaign(
    user: AuthUser,
    State(s): State<AdManagerState>,
    Json(body): Json<QuickCreateBody>,
) -> Result<Json<QuickCreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(quick_create_campaign_inner(&s, oid, body).await))
}

/// Reusable inner — runs the full campaign → ad-set → creative → ad
/// orchestration plus the local mirror insert. Both the JSON `quick_create_campaign`
/// handler and the multipart `from_form::create_ad_campaign` entrypoint
/// call into this so the logic exists in exactly one place.
pub async fn quick_create_campaign_inner(
    s: &AdManagerState,
    oid: bson::oid::ObjectId,
    body: QuickCreateBody,
) -> QuickCreateResult {
    let act = with_act_prefix(&body.ad_account_id);

    let camp = match graph_post::<Value>(
        &s,
        oid,
        &format!("{act}/campaigns"),
        serde_json::json!({
            "name": body.campaign_name,
            "objective": body.objective,
            "status": body.status,
            "special_ad_categories": [],
        }),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return QuickCreateResult {
                message: None,
                error: Some(e),
            };
        }
    };
    let campaign_id = match camp.get("id").and_then(Value::as_str) {
        Some(id) => id.to_owned(),
        None => {
            return QuickCreateResult {
                message: None,
                error: Some("Failed to create campaign.".to_owned()),
            };
        }
    };

    let adset = match graph_post::<Value>(
        &s,
        oid,
        &format!("{act}/adsets"),
        serde_json::json!({
            "name": format!("{} Ad Set", body.campaign_name),
            "campaign_id": campaign_id,
            "daily_budget": body.daily_budget_minor,
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "LINK_CLICKS",
            "targeting": {
                "geo_locations": { "countries": [body.target_country] },
                "age_min": body.min_age,
                "age_max": body.max_age,
            },
            "status": body.status,
        }),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return QuickCreateResult {
                message: None,
                error: Some(e),
            };
        }
    };
    let ad_set_id = match adset.get("id").and_then(Value::as_str) {
        Some(id) => id.to_owned(),
        None => {
            return QuickCreateResult {
                message: None,
                error: Some("Failed to create ad set.".to_owned()),
            };
        }
    };

    let mut link_data = serde_json::json!({
        "message": body.ad_message,
        "link": body.destination_url,
        "call_to_action": {
            "type": "LEARN_MORE",
            "value": { "link": body.destination_url },
        },
    });
    if let Some(h) = body.image_hash.as_deref().filter(|s| !s.is_empty()) {
        link_data["image_hash"] = Value::String(h.to_owned());
    } else {
        link_data["image_url"] = Value::String("https://placehold.co/1200x628.png".to_owned());
    }
    let creative = match graph_post::<Value>(
        &s,
        oid,
        &format!("{act}/adcreatives"),
        serde_json::json!({
            "name": format!("{} Ad Creative", body.campaign_name),
            "object_story_spec": {
                "page_id": body.facebook_page_id,
                "link_data": link_data,
            },
        }),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return QuickCreateResult {
                message: None,
                error: Some(e),
            };
        }
    };
    let creative_id = match creative.get("id").and_then(Value::as_str) {
        Some(id) => id.to_owned(),
        None => {
            return QuickCreateResult {
                message: None,
                error: Some("Failed to create creative.".to_owned()),
            };
        }
    };

    let ad = match graph_post::<Value>(
        &s,
        oid,
        &format!("{act}/ads"),
        serde_json::json!({
            "name": format!("{} Ad", body.campaign_name),
            "adset_id": ad_set_id,
            "creative": { "creative_id": creative_id },
            "status": body.status,
        }),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return QuickCreateResult {
                message: None,
                error: Some(e),
            };
        }
    };
    let ad_id = match ad.get("id").and_then(Value::as_str) {
        Some(id) => id.to_owned(),
        None => {
            return QuickCreateResult {
                message: None,
                error: Some("Failed to create ad.".to_owned()),
            };
        }
    };

    // Mirror into local `ad_campaigns` collection. Best-effort — Graph
    // already succeeded, so we don't want to surface a Mongo error here.
    if let Err(e) = store::insert_local_campaign(
        &s.mongo,
        oid,
        store::InsertLocalCampaignBody {
            ad_account_id: act,
            name: body.campaign_name.clone(),
            status: body.status.clone(),
            daily_budget: (body.daily_budget_minor as f64) / 100.0,
            meta_campaign_id: campaign_id,
            meta_ad_set_id: ad_set_id,
            meta_ad_creative_id: creative_id,
            meta_ad_id: ad_id,
        },
    )
    .await
    {
        tracing::warn!(error = %e, "ad-manager: local campaign mirror insert failed");
    }

    QuickCreateResult {
        message: Some(format!(
            "Ad campaign \"{}\" created successfully!",
            body.campaign_name
        )),
        error: None,
    }
}

/// Internal helper: POST a JSON body to the Graph proxy and return the
/// `data` field on success, or a string error on failure.
async fn graph_post<T: serde::de::DeserializeOwned>(
    s: &AdManagerState,
    user_oid: bson::oid::ObjectId,
    path: &str,
    body: Value,
) -> std::result::Result<T, String> {
    let body_map = body
        .as_object()
        .cloned()
        .ok_or_else(|| "graph_post: body must be a JSON object".to_owned())?;
    let proxy_body = GraphProxyBody {
        path: path.to_owned(),
        method: "POST".to_owned(),
        params: serde_json::Map::new(),
        body: Some(body_map),
        token_kind: TokenKind::AdManager,
    };
    let res = graph::proxy(s, user_oid, proxy_body)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(err) = res.error {
        return Err(err);
    }
    let value = res.data.unwrap_or(Value::Null);
    serde_json::from_value::<T>(value).map_err(|e| format!("graph_post decode: {e}"))
}

// ---------------------------------------------------------------------------
// Multipart uploads (image / video). Forwards to graph.facebook.com with the
// resolved adManager token. Endpoint is `/upload/{kind}` where kind is
// "image" or "video".
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadImageResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadVideoResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UploadQuery {
    pub kind: String,
}

pub async fn upload_asset(
    user: AuthUser,
    State(s): State<AdManagerState>,
    axum::extract::Path(kind): axum::extract::Path<String>,
    mut multipart: Multipart,
) -> Result<Json<Value>> {
    let oid = oid_from_str(&user.user_id)?;
    let token = match fetch_token(&s.mongo, oid, TokenKind::AdManager).await? {
        Some(t) => t,
        None => {
            return Ok(Json(serde_json::json!({
                "error": missing_token_error(TokenKind::AdManager),
            })));
        }
    };

    let mut ad_account_id: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: String = "upload".to_owned();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| sabnode_common::ApiError::BadRequest(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        match name.as_str() {
            "adAccountId" => {
                ad_account_id = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| sabnode_common::ApiError::BadRequest(format!("{e}")))?,
                );
            }
            "file" => {
                if let Some(fname) = field.file_name() {
                    file_name = fname.to_owned();
                }
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| sabnode_common::ApiError::BadRequest(format!("{e}")))?;
                file_bytes = Some(bytes.to_vec());
            }
            _ => {}
        }
    }

    let acc = match ad_account_id {
        Some(a) if !a.is_empty() => with_act_prefix(&a),
        _ => {
            return Ok(Json(
                serde_json::json!({ "error": "Ad Account ID required" }),
            ));
        }
    };
    let bytes = match file_bytes {
        Some(b) if !b.is_empty() => b,
        _ => return Ok(Json(serde_json::json!({ "error": "No file provided" }))),
    };

    // Build multipart form for Graph.
    let endpoint_segment = match kind.as_str() {
        "image" => "adimages",
        "video" => "advideos",
        _ => {
            return Ok(Json(
                serde_json::json!({ "error": "Unsupported upload kind" }),
            ));
        }
    };
    let form_field_name = match kind.as_str() {
        "image" => "filename",
        "video" => "source",
        _ => "filename",
    };
    let url = format!(
        "https://graph.facebook.com/{}/{}/{}",
        s.graph_version, acc, endpoint_segment
    );
    let form = reqwest::multipart::Form::new()
        .text("access_token", token)
        .part(
            form_field_name.to_owned(),
            reqwest::multipart::Part::bytes(bytes).file_name(file_name),
        );

    let res = match s.http.post(&url).multipart(form).send().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(Json(serde_json::json!({
                "error": format!("Failed to upload: {e}"),
            })));
        }
    };
    let json: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => {
            return Ok(Json(serde_json::json!({
                "error": format!("graph response not JSON: {e}"),
            })));
        }
    };

    if let Some(err) = json
        .pointer("/error/message")
        .and_then(Value::as_str)
        .map(str::to_owned)
    {
        return Ok(Json(serde_json::json!({ "error": err })));
    }

    if kind == "image" {
        let images = json.get("images").and_then(Value::as_object);
        if let Some(map) = images {
            if let Some((_k, v)) = map.iter().next() {
                let hash = v.get("hash").and_then(Value::as_str).map(str::to_owned);
                let url = v.get("url").and_then(Value::as_str).map(str::to_owned);
                return Ok(Json(serde_json::json!({
                    "imageHash": hash,
                    "imageUrl": url,
                })));
            }
        }
        return Ok(Json(serde_json::json!({
            "error": "Failed to upload image",
        })));
    }
    if kind == "video" {
        let video_id = json.get("id").and_then(Value::as_str).map(str::to_owned);
        return Ok(Json(serde_json::json!({ "videoId": video_id })));
    }
    Ok(Json(
        serde_json::json!({ "error": "Unsupported upload kind" }),
    ))
}

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
