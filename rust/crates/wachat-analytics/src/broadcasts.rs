//! Broadcast analytics — list latest 100 broadcasts in date range with totals.
//!
//! Mirrors `getBroadcastAnalytics` in `whatsapp-analytics.actions.ts`.
//! Reads the `broadcasts` collection. Uses untyped `Document` because the TS
//! collection carries fields beyond the strongly-typed `Broadcast` projection
//! (e.g. `name`, `templateName`, legacy `contactCount`/`successCount`/
//! `failedCount` int fields).

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

const BROADCASTS_COLL: &str = "broadcasts";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastAnalyticsBody {
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub start_date: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSummary {
    pub name: String,
    pub template_name: String,
    pub contact_count: u64,
    pub success_count: u64,
    pub failed_count: u64,
    pub status: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastAnalyticsResult {
    pub total_broadcasts: u64,
    pub total_contacts: u64,
    pub total_success: u64,
    pub total_failed: u64,
    pub broadcasts: Vec<BroadcastSummary>,
}

pub async fn aggregate(
    mongo: &MongoHandle,
    project_id: ObjectId,
    body: BroadcastAnalyticsBody,
) -> Result<BroadcastAnalyticsResult> {
    let mut filter = doc! { "projectId": project_id };
    if body.start_date.is_some() || body.end_date.is_some() {
        let mut range = Document::new();
        if let Some(s) = body.start_date {
            range.insert("$gte", bson::DateTime::from_chrono(s));
        }
        if let Some(e) = body.end_date {
            range.insert("$lte", bson::DateTime::from_chrono(e));
        }
        filter.insert("createdAt", range);
    }

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(100i64)
        .build();
    let cursor = mongo
        .collection::<Document>(BROADCASTS_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut result = BroadcastAnalyticsResult {
        total_broadcasts: docs.len() as u64,
        ..Default::default()
    };
    for d in docs {
        let contact = doc_u64(&d, "contactCount");
        let success = doc_u64(&d, "successCount");
        let failed = doc_u64(&d, "failedCount");
        result.total_contacts += contact;
        result.total_success += success;
        result.total_failed += failed;
        result.broadcasts.push(BroadcastSummary {
            name: d.get_str("name").unwrap_or("").to_string(),
            template_name: d.get_str("templateName").unwrap_or("").to_string(),
            contact_count: contact,
            success_count: success,
            failed_count: failed,
            status: d.get_str("status").unwrap_or("").to_string(),
            created_at: d.get_datetime("createdAt").ok().map(|dt| dt.to_chrono()),
        });
    }
    Ok(result)
}

fn doc_u64(d: &Document, key: &str) -> u64 {
    d.get_i64(key)
        .ok()
        .map(|x| x.max(0) as u64)
        .or_else(|| d.get_i32(key).ok().map(|x| x.max(0) as u64))
        .unwrap_or(0)
}
