//! Mongo-backed pieces of the Ad Manager surface.
//!
//! - `users.metaAdAccounts[]`  — list of connected ad accounts on the
//!   user doc. Read by `getAdAccounts`, mutated by `deleteAdAccount`.
//! - `ad_campaigns`            — local "quick create" Click-to-WhatsApp
//!   ad records (NOT a mirror of every Meta campaign). Joined to
//!   Graph for live status + insights.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const USERS_COLL: &str = "users";
const AD_CAMPAIGNS_COLL: &str = "ad_campaigns";

// ---------------------------------------------------------------------------
// Bodies / responses
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdAccountsResult {
    pub accounts: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAdAccountBody {
    pub account_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCampaignsResult {
    pub campaigns: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLocalCampaignsBody {
    pub ad_account_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertLocalCampaignBody {
    pub ad_account_id: String,
    pub name: String,
    pub status: String,
    pub daily_budget: f64,
    pub meta_campaign_id: String,
    pub meta_ad_set_id: String,
    pub meta_ad_creative_id: String,
    pub meta_ad_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLocalCampaignsByMetaIdBody {
    pub meta_campaign_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLocalStatusBody {
    pub meta_campaign_id: String,
    pub status: String,
}

// ---------------------------------------------------------------------------
// metaAdAccounts (lives on the user doc)
// ---------------------------------------------------------------------------

pub async fn get_ad_accounts(mongo: &MongoHandle, user_oid: ObjectId) -> Result<AdAccountsResult> {
    let users = mongo.collection::<Document>(USERS_COLL);
    let user = users
        .find_one(doc! { "_id": user_oid })
        .projection(doc! { "metaAdAccounts": 1 })
        .await
        .map_err(internal)?;
    let Some(u) = user else {
        return Ok(AdAccountsResult {
            accounts: Value::Array(Vec::new()),
            error: Some("Authentication required.".to_owned()),
        });
    };
    let accounts = u
        .get_array("metaAdAccounts")
        .map(|arr| Value::Array(arr.iter().cloned().map(bson_to_json).collect()))
        .unwrap_or_else(|_| Value::Array(Vec::new()));
    Ok(AdAccountsResult {
        accounts,
        error: None,
    })
}

pub async fn delete_ad_account(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    account_id: &str,
) -> Result<SuccessResult> {
    let users = mongo.collection::<Document>(USERS_COLL);
    users
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$pull": { "metaAdAccounts": { "id": account_id } } },
        )
        .await
        .map_err(internal)?;
    Ok(SuccessResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// ad_campaigns collection (local "quick create" mirrors)
// ---------------------------------------------------------------------------

pub async fn list_local_campaigns(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    ad_account_id: &str,
) -> Result<LocalCampaignsResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    let cursor = coll
        .find(doc! { "adAccountId": ad_account_id, "userId": user_oid })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(internal)?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(internal)?;
    Ok(LocalCampaignsResult {
        campaigns: Value::Array(docs.into_iter().map(doc_to_json).collect()),
        error: None,
    })
}

pub async fn insert_local_campaign(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    body: InsertLocalCampaignBody,
) -> Result<SuccessResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    coll.insert_one(doc! {
        "userId": user_oid,
        "adAccountId": &body.ad_account_id,
        "name": &body.name,
        "status": &body.status,
        "dailyBudget": body.daily_budget,
        "metaCampaignId": &body.meta_campaign_id,
        "metaAdSetId": &body.meta_ad_set_id,
        "metaAdCreativeId": &body.meta_ad_creative_id,
        "metaAdId": &body.meta_ad_id,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(internal)?;
    Ok(SuccessResult {
        success: true,
        error: None,
    })
}

pub async fn delete_local_campaigns_by_meta_id(
    mongo: &MongoHandle,
    meta_campaign_id: &str,
) -> Result<SuccessResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    coll.delete_many(doc! { "metaCampaignId": meta_campaign_id })
        .await
        .map_err(internal)?;
    Ok(SuccessResult {
        success: true,
        error: None,
    })
}

pub async fn update_local_campaign_status(
    mongo: &MongoHandle,
    meta_campaign_id: &str,
    status: &str,
) -> Result<SuccessResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    coll.update_one(
        doc! { "metaCampaignId": meta_campaign_id },
        doc! { "$set": { "status": status } },
    )
    .await
    .map_err(internal)?;
    Ok(SuccessResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CountResult {
    pub count: u64,
}

pub async fn count_local_campaigns_for_user(
    mongo: &MongoHandle,
    user_oid: ObjectId,
) -> Result<CountResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    let n = coll
        .count_documents(doc! { "userId": user_oid })
        .await
        .map_err(internal)?;
    Ok(CountResult { count: n })
}

pub async fn count_local_campaigns_global(mongo: &MongoHandle) -> Result<CountResult> {
    let coll = mongo.collection::<Document>(AD_CAMPAIGNS_COLL);
    let n = coll.count_documents(doc! {}).await.map_err(internal)?;
    Ok(CountResult { count: n })
}

// ---------------------------------------------------------------------------
// metaAdAccounts upsert (called from the OAuth callback flow)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetMetaAdAccountsBody {
    pub accounts: Vec<MetaAdAccountInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaAdAccountInput {
    pub id: String,
    pub name: String,
    pub account_id: String,
}

pub async fn set_meta_ad_accounts(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    accounts: Vec<MetaAdAccountInput>,
) -> Result<SuccessResult> {
    let users = mongo.collection::<Document>(USERS_COLL);
    let arr: Vec<Bson> = accounts
        .into_iter()
        .map(|a| {
            Bson::Document(doc! {
                "id": a.id,
                "name": a.name,
                "account_id": a.account_id,
            })
        })
        .collect();
    users
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$set": { "metaAdAccounts": Bson::Array(arr) } },
        )
        .await
        .map_err(internal)?;
    Ok(SuccessResult {
        success: true,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Helpers (BSON ↔ JSON, mirroring qr-codes/url-shortener behavior)
// ---------------------------------------------------------------------------

fn internal(e: impl Into<anyhow::Error>) -> ApiError {
    ApiError::Internal(e.into())
}

fn doc_to_json(doc: Document) -> Value {
    bson_to_json(Bson::Document(doc))
}

pub(crate) fn bson_to_json(b: Bson) -> Value {
    match b {
        Bson::Double(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(s) => Value::String(s),
        Bson::Array(arr) => Value::Array(arr.into_iter().map(bson_to_json).collect()),
        Bson::Document(d) => {
            let mut m = Map::with_capacity(d.len());
            for (k, v) in d.into_iter() {
                m.insert(k, bson_to_json(v));
            }
            Value::Object(m)
        }
        Bson::Boolean(b) => Value::Bool(b),
        Bson::Null => Value::Null,
        Bson::Int32(i) => Value::Number(i.into()),
        Bson::Int64(i) => Value::Number(i.into()),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => {
            let ch = dt.to_chrono();
            Value::String(ch.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        }
        Bson::Timestamp(ts) => Value::String(format!("{}:{}", ts.time, ts.increment)),
        Bson::Decimal128(d) => Value::String(d.to_string()),
        Bson::RegularExpression(r) => Value::String(format!("/{}/{}", r.pattern, r.options)),
        Bson::JavaScriptCode(c) => Value::String(c),
        Bson::JavaScriptCodeWithScope(j) => Value::String(j.code),
        Bson::Symbol(s) => Value::String(s),
        Bson::Binary(_) | Bson::Undefined | Bson::MaxKey | Bson::MinKey | Bson::DbPointer(_) => {
            Value::Null
        }
    }
}
