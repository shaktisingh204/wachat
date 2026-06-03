//! CRUD handlers for `crm_facebook_leadgen_config` and the activity log.
//!
//! | Method | Path                              | Handler            |
//! |--------|-----------------------------------|--------------------|
//! | GET    | `/config`                         | [`get_config`]     |
//! | POST   | `/config`                         | [`upsert_config`]  |
//! | DELETE | `/config/{form_id}`               | [`delete_form`]    |
//! | GET    | `/config/forms`                   | [`list_config_forms`] |
//! | GET    | `/activity`                       | [`get_activity`]   |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use serde_json::Value;
use tracing::warn;

use crate::dto::{
    ActivityEntry, ActivityResp, ConfigResp, FacebookLeadGenForm, FormsResp, LeadGenConfig,
};
use crate::state::WachatFacebookLeadGenState;

const CONFIG_COLL: &str = "crm_facebook_leadgen_config";
const ACTIVITY_COLL: &str = "crm_facebook_leadgen_activity";

fn pull_data_array(v: &Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  GET /config
// =========================================================================

pub async fn get_config(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
) -> Json<ConfigResp> {
    let coll = s.mongo.collection::<LeadGenConfig>(CONFIG_COLL);
    match coll.find_one(doc! { "tenantId": &user.user_id }).await {
        Ok(config) => Json(ConfigResp {
            config,
            error: None,
        }),
        Err(e) => {
            warn!("get_config: mongo error: {e}");
            Json(ConfigResp {
                config: None,
                error: Some(e.to_string()),
            })
        }
    }
}

// =========================================================================
//  POST /config  — upsert the entire config document
// =========================================================================

pub async fn upsert_config(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Json(mut input): Json<LeadGenConfig>,
) -> Json<ConfigResp> {
    // Always scope to the authenticated tenant.
    input.tenant_id = user.user_id.clone();
    let now = bson::DateTime::from_chrono(Utc::now());
    input.updated_at = Some(now);

    // Convert input to a BSON document for the $set payload.
    let set_doc = match bson::to_document(&input) {
        Ok(d) => d,
        Err(e) => {
            return Json(ConfigResp {
                config: None,
                error: Some(format!("serialization error: {e}")),
            });
        }
    };

    let coll = s.mongo.collection::<Document>(CONFIG_COLL);
    let filter = doc! { "tenantId": &user.user_id };
    let update = doc! {
        "$set": set_doc,
        "$setOnInsert": { "createdAt": now },
    };

    match coll.update_one(filter, update).upsert(true).await {
        Err(e) => {
            warn!("upsert_config: mongo error: {e}");
            Json(ConfigResp {
                config: None,
                error: Some(e.to_string()),
            })
        }
        Ok(_) => {
            let typed = s.mongo.collection::<LeadGenConfig>(CONFIG_COLL);
            match typed.find_one(doc! { "tenantId": &user.user_id }).await {
                Ok(config) => Json(ConfigResp {
                    config,
                    error: None,
                }),
                Err(e) => Json(ConfigResp {
                    config: None,
                    error: Some(e.to_string()),
                }),
            }
        }
    }
}

// =========================================================================
//  DELETE /config/{form_id}  — pull one form from the forms array
// =========================================================================

pub async fn delete_form(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Path(form_id): Path<String>,
) -> Json<ConfigResp> {
    let coll = s.mongo.collection::<Document>(CONFIG_COLL);
    let filter = doc! { "tenantId": &user.user_id };
    let update = doc! { "$pull": { "forms": { "formId": &form_id } } };

    match coll.update_one(filter, update).await {
        Err(e) => {
            warn!("delete_form: mongo error: {e}");
            Json(ConfigResp {
                config: None,
                error: Some(e.to_string()),
            })
        }
        Ok(_) => {
            let typed = s.mongo.collection::<LeadGenConfig>(CONFIG_COLL);
            match typed.find_one(doc! { "tenantId": &user.user_id }).await {
                Ok(config) => Json(ConfigResp {
                    config,
                    error: None,
                }),
                Err(e) => Json(ConfigResp {
                    config: None,
                    error: Some(e.to_string()),
                }),
            }
        }
    }
}

// =========================================================================
//  GET /config/forms  — list Lead Gen forms using the CRM config token
// =========================================================================

pub async fn list_config_forms(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
) -> Json<FormsResp> {
    // Load config to get pageId + pageAccessToken.
    let coll = s.mongo.collection::<LeadGenConfig>(CONFIG_COLL);
    let config = match coll.find_one(doc! { "tenantId": &user.user_id }).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return Json(FormsResp {
                forms: None,
                error: Some("Integration not configured. Set up Connection tab first.".to_owned()),
            });
        }
        Err(e) => {
            return Json(FormsResp {
                forms: None,
                error: Some(e.to_string()),
            });
        }
    };

    if config.page_id.is_empty() || config.page_access_token.is_empty() {
        return Json(FormsResp {
            forms: None,
            error: Some("Page ID and Access Token are required.".to_owned()),
        });
    }

    let path = format!(
        "{}/leadgen_forms?fields=id,name,status,leads_count,created_time,expired_leads_count&limit=50",
        config.page_id
    );

    match s
        .meta
        .get_json::<Value>(&path, &config.page_access_token)
        .await
    {
        Ok(v) => {
            let raw = pull_data_array(&v);
            let mut forms = Vec::with_capacity(raw.len());
            for entry in raw {
                if let Ok(f) = serde_json::from_value::<FacebookLeadGenForm>(entry) {
                    forms.push(f);
                }
            }
            Json(FormsResp {
                forms: Some(forms),
                error: None,
            })
        }
        Err(e) => Json(FormsResp {
            forms: None,
            error: Some(e.to_string()),
        }),
    }
}

// =========================================================================
//  GET /activity  — last 100 activity log entries for the tenant
// =========================================================================

pub async fn get_activity(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
) -> Json<ActivityResp> {
    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(100)
        .build();

    let coll = s.mongo.collection::<ActivityEntry>(ACTIVITY_COLL);
    match coll
        .find(doc! { "tenantId": &user.user_id })
        .with_options(opts)
        .await
    {
        Ok(cursor) => match cursor.try_collect::<Vec<ActivityEntry>>().await {
            Ok(entries) => Json(ActivityResp {
                entries,
                error: None,
            }),
            Err(e) => Json(ActivityResp {
                entries: vec![],
                error: Some(e.to_string()),
            }),
        },
        Err(e) => Json(ActivityResp {
            entries: vec![],
            error: Some(e.to_string()),
        }),
    }
}
