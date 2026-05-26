//! HTTP handlers for the Ad Accounts & Business domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/ad-manager.actions.ts`. The TS originals return
//! `{ data?, error?, … }` envelopes and never throw — we follow the
//! same convention so callers can branch on `body.error` without
//! special-casing 4xx vs JSON envelope errors.
//!
//! ## User-doc resolution
//!
//! Unlike the page-scoped Facebook crates, ad-manager actions don't
//! load a `projects` doc — they read `adManagerAccessToken` /
//! `metaSuiteAccessToken` / `metaAdAccounts` directly off the user
//! document. [`load_user_doc`] performs that single Mongo lookup and
//! returns the typed token + ad-account fields.
//!
//! ## Token plumbing
//!
//! The TS code passes the access token as `?access_token=…` on every
//! Graph API call. We instead let `MetaClient` set
//! `Authorization: Bearer` — Meta accepts both forms equivalently.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use wachat_meta_client::{MetaClient, MetaError};

use crate::dto::{
    ActivitiesQuery, AdAccountsResp, DataResp, DeleteAdAccountResp, ListResp, PagesResp,
    SpendQuery,
};
use crate::state::WachatAdsAccountsState;

const USERS_COLLECTION: &str = "users";

// =========================================================================
//  User helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Lightweight projection of the `users` doc fields the ad-manager
/// handlers care about. Loaded as `Document` first so we can keep the
/// `metaAdAccounts` array as raw BSON for `getAdAccounts`.
pub struct UserCtx {
    pub id: ObjectId,
    pub ad_manager_access_token: Option<String>,
    pub meta_suite_access_token: Option<String>,
    pub meta_ad_accounts: Vec<Value>,
}

/// Resolve the caller's user doc and project the fields we care about.
///
/// Mirrors `getSession()` in the TS code — the JWT-derived user id is
/// the source of truth, and we pull the rest from Mongo. Unknown user
/// id → `Unauthorized`. Decoding errors on individual fields are
/// non-fatal so callers can still surface a friendly "not connected"
/// error message rather than a 500.
pub async fn load_user_doc(user: &AuthUser, mongo: &MongoHandle) -> Result<UserCtx> {
    let user_oid = parse_user_oid(user)?;
    let coll = mongo.collection::<Document>(USERS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": user_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::Unauthorized("user not found".to_owned()))?;

    let ad_manager_access_token = doc
        .get_str("adManagerAccessToken")
        .ok()
        .map(|s| s.to_owned());
    let meta_suite_access_token = doc
        .get_str("metaSuiteAccessToken")
        .ok()
        .map(|s| s.to_owned());

    let meta_ad_accounts = match doc.get_array("metaAdAccounts") {
        Ok(arr) => arr
            .iter()
            .map(|b| sabnode_db::bson_to_clean_json(b.clone()))
            .collect(),
        Err(_) => Vec::new(),
    };

    Ok(UserCtx {
        id: user_oid,
        ad_manager_access_token,
        meta_suite_access_token,
        meta_ad_accounts,
    })
}

const ERR_AD_MANAGER_NOT_CONNECTED: &str = "Ad Manager account not connected.";
const ERR_FACEBOOK_NOT_CONNECTED: &str = "Facebook account not connected.";

fn require_ad_manager_token(u: &UserCtx) -> std::result::Result<&str, &'static str> {
    u.ad_manager_access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_AD_MANAGER_NOT_CONNECTED)
}

fn require_meta_suite_token(u: &UserCtx) -> std::result::Result<&str, &'static str> {
    u.meta_suite_access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_FACEBOOK_NOT_CONNECTED)
}

/// Mirror the TS `withActPrefix` helper.
fn with_act_prefix(id: &str) -> String {
    if id.is_empty() || id.starts_with("act_") {
        id.to_owned()
    } else {
        format!("act_{id}")
    }
}

/// Squash a `MetaError` into the `String` shape TS callers expect.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

async fn graph_get(
    meta: &MetaClient,
    path: &str,
    token: &str,
) -> std::result::Result<Value, MetaError> {
    meta.get_json::<Value>(path, token).await
}

fn pull_data_array(v: &Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  getAdAccounts  (GET /)
// =========================================================================

pub async fn get_ad_accounts(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
) -> Json<AdAccountsResp> {
    match load_user_doc(&user, &s.mongo).await {
        Ok(u) => Json(AdAccountsResp {
            accounts: u.meta_ad_accounts,
            ..Default::default()
        }),
        Err(_) => Json(AdAccountsResp {
            accounts: Vec::new(),
            error: Some("Authentication required.".to_owned()),
        }),
    }
}

// =========================================================================
//  syncAdAccounts  (POST /sync)
// =========================================================================

pub async fn sync_ad_accounts(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
) -> Json<AdAccountsResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(AdAccountsResp {
                accounts: Vec::new(),
                error: Some("Authentication required.".to_owned()),
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(AdAccountsResp {
                accounts: Vec::new(),
                error: Some(e.to_owned()),
            });
        }
    };

    let path = "me/adaccounts?fields=id,name,account_id";
    match graph_get(&s.meta, path, token).await {
        Ok(v) => {
            let accounts = pull_data_array(&v);
            let user_oid = u.id;
            let coll = s.mongo.collection::<Document>(USERS_COLLECTION);
            
            let mut bson_accounts = Vec::new();
            for acc in &accounts {
                let id = acc.get("id").and_then(|v| v.as_str());
                let name = acc.get("name").and_then(|v| v.as_str());
                let account_id = acc.get("account_id").and_then(|v| v.as_str());
                if let (Some(id), Some(name), Some(account_id)) = (id, name, account_id) {
                    bson_accounts.push(bson::Bson::Document(doc! {
                        "id": id,
                        "name": name,
                        "account_id": account_id,
                    }));
                }
            }
            
            let res = coll
                .update_one(
                    doc! { "_id": user_oid },
                    doc! { "$set": { "metaAdAccounts": bson::Bson::Array(bson_accounts) } },
                )
                .await;
                
            if let Err(e) = res {
                return Json(AdAccountsResp {
                    accounts,
                    error: Some(format!("Failed to sync ad accounts: {}", e)),
                });
            }
            
            Json(AdAccountsResp {
                accounts,
                ..Default::default()
            })
        }
        Err(e) => Json(AdAccountsResp {
            accounts: Vec::new(),
            error: Some(err_msg(e)),
        }),
    }
}

// =========================================================================
//  getAdAccountDetails  (GET /:ad_account_id)
// =========================================================================

pub async fn get_ad_account_details(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
) -> Json<DataResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(DataResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(DataResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = [
        "id,account_id,name,account_status,currency,timezone_name,business_country_code",
        "amount_spent,balance,spend_cap,funding_source_details",
        "disable_reason,capabilities,business{id,name}",
        "min_daily_budget,min_campaign_group_spend_cap,owner",
        "created_time,age,is_prepay_account",
    ]
    .join(",");
    let path = format!(
        "{}?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(&fields)
    );

    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(DataResp {
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(DataResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  deleteAdAccount  (DELETE /:ad_account_id)
// =========================================================================

pub async fn delete_ad_account(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
) -> Json<DeleteAdAccountResp> {
    let user_oid = match parse_user_oid(&user) {
        Ok(o) => o,
        Err(_) => {
            return Json(DeleteAdAccountResp {
                success: false,
                error: Some("Authentication required".to_owned()),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(USERS_COLLECTION);
    let res = coll
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$pull": { "metaAdAccounts": { "id": &ad_account_id } } },
        )
        .await;
    match res {
        Ok(_) => Json(DeleteAdAccountResp {
            success: true,
            error: None,
        }),
        Err(_) => Json(DeleteAdAccountResp {
            success: false,
            error: Some("Failed to disconnect ad account.".to_owned()),
        }),
    }
}

// =========================================================================
//  listAdAccountUsers  (GET /:ad_account_id/users)
// =========================================================================

pub async fn list_ad_account_users(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,email,role,permitted_tasks,business";
    let path = format!(
        "{}/assigned_users?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  listAdAccountAgencies  (GET /:ad_account_id/agencies)
// =========================================================================

pub async fn list_ad_account_agencies(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,verification_status,permitted_tasks";
    let path = format!(
        "{}/agencies?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getAdAccountSpend  (GET /:ad_account_id/spend)
// =========================================================================

pub async fn get_ad_account_spend(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
    Query(_q): Query<SpendQuery>,
) -> Json<DataResp> {
    // The TS function accepts `since`/`until` arguments but does NOT
    // forward them to Graph (see ad-manager.actions.ts:1472–1480).
    // We accept them here for parity but likewise ignore them.
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(DataResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(DataResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields =
        "amount_spent,balance,currency,funding_source_details,min_daily_budget,spend_cap";
    let path = format!(
        "{}?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(DataResp {
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(DataResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  listBusinessInvoices  (GET /business/:business_id/invoices)
// =========================================================================

pub async fn list_business_invoices(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(business_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,invoice_id,billing_period,billed_amount_details,due_date,issue_date,payment_status,invoice_date,type";
    let path = format!(
        "{business_id}/business_invoices?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  listBusinessUsers  (GET /business/:business_id/users)
// =========================================================================

pub async fn list_business_users(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(business_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,email,role,title,two_fac_status";
    let path = format!(
        "{business_id}/business_users?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  listBusinessPartners  (GET /business/:business_id/partners)
// =========================================================================

pub async fn list_business_partners(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(business_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,verification_status,two_factor_type";
    let path = format!(
        "{business_id}/business_partners?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  listExtendedCredits  (GET /business/:business_id/extended-credits)
// =========================================================================

pub async fn list_extended_credits(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(business_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,credit_type,credit_available,credit_used,legal_entity_name,max_balance,owner_business";
    let path = format!(
        "{business_id}/extendedcredits?fields={}",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getAdAccountCapabilities  (GET /:ad_account_id/capabilities)
// =========================================================================

pub async fn get_ad_account_capabilities(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
) -> Json<DataResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(DataResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(DataResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = [
        "capabilities",
        "business_country_code",
        "min_campaign_group_spend_cap",
        "min_daily_budget",
        "disable_reason",
        "io_number",
        "offsite_pixels_tos_accepted",
        "tos_accepted",
    ]
    .join(",");
    let path = format!(
        "{}?fields={}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(&fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(DataResp {
            data: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(DataResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getAdAccountActivities  (GET /:ad_account_id/activities)
// =========================================================================

pub async fn get_ad_account_activities(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(ad_account_id): Path<String>,
    Query(q): Query<ActivitiesQuery>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some("Authentication required.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_ad_manager_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "actor_name,application_id,event_type,event_time,object_id,object_name,object_type,translated_event_type,extra_data";
    let limit = q.limit.unwrap_or(100);
    let mut path = format!(
        "{}/activities?fields={}&limit={limit}",
        with_act_prefix(&ad_account_id),
        urlencoding::encode(fields),
    );
    if let Some(v) = q.since.as_deref() {
        path.push_str("&since=");
        path.push_str(&urlencoding::encode(v));
    }
    if let Some(v) = q.until.as_deref() {
        path.push_str("&until=");
        path.push_str(&urlencoding::encode(v));
    }

    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(ListResp {
            data: Some(pull_data_array(&v)),
            ..Default::default()
        }),
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getFacebookPagesForAdCreation  (GET /pages)
// =========================================================================

pub async fn get_facebook_pages_for_ad_creation(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
) -> Json<PagesResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(PagesResp {
                error: Some(ERR_FACEBOOK_NOT_CONNECTED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_meta_suite_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(PagesResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,access_token,category,picture{url}";
    let path = format!("me/accounts?fields={}", urlencoding::encode(fields));
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => {
            // The TS code surfaces top-level Graph errors via `throw`.
            // `MetaClient` already does that for HTTP-level errors, but
            // mirror the explicit `data.error.message` check just in case.
            if let Some(err) = v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
                return Json(PagesResp {
                    error: Some(err.to_owned()),
                    ..Default::default()
                });
            }
            Json(PagesResp {
                pages: Some(pull_data_array(&v)),
                ..Default::default()
            })
        }
        Err(e) => Json(PagesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getInstagramAccountsForPage  (GET /pages/:page_id/instagram-accounts)
// =========================================================================

pub async fn get_instagram_accounts_for_page(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(page_id): Path<String>,
) -> Json<ListResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(ListResp {
                error: Some(ERR_FACEBOOK_NOT_CONNECTED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_meta_suite_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(ListResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "instagram_business_account{id,username,profile_picture_url}";
    let path = format!("{page_id}?fields={}", urlencoding::encode(fields));
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => {
            let ig = v.get("instagram_business_account").cloned();
            let data = match ig {
                Some(Value::Null) | None => Vec::new(),
                Some(other) => vec![other],
            };
            Json(ListResp {
                data: Some(data),
                ..Default::default()
            })
        }
        Err(e) => Json(ListResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getInstagramBusinessAccount  (GET /pages/:page_id/instagram-business)
// =========================================================================

pub async fn get_instagram_business_account(
    user: AuthUser,
    State(s): State<WachatAdsAccountsState>,
    Path(page_id): Path<String>,
) -> Json<DataResp> {
    let u = match load_user_doc(&user, &s.mongo).await {
        Ok(u) => u,
        Err(_) => {
            return Json(DataResp {
                error: Some(ERR_FACEBOOK_NOT_CONNECTED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_meta_suite_token(&u) {
        Ok(t) => t,
        Err(e) => {
            return Json(DataResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}";
    let path = format!("{page_id}?fields={}", urlencoding::encode(fields));
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => {
            let ig = v.get("instagram_business_account").cloned();
            Json(DataResp {
                data: Some(ig.unwrap_or(Value::Null)),
                ..Default::default()
            })
        }
        Err(e) => Json(DataResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

