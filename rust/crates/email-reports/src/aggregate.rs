//! Aggregator function — runs a Mongo `$facet` over `email_events`
//! and upserts one row per `(scope, scopeId, bucket, bucketAt)` tuple
//! into `email_reports_cache`.
//!
//! The `email-reports-worker` binary calls this on a tokio interval
//! (typically every 5 minutes for `hour`/`day`, every hour for
//! `lifetime`). The worker itself is one tier up — this module just
//! provides the building blocks.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, TimeZone, Timelike, Utc};
use email_types::collections::{EVENTS, REPORTS_CACHE};
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::dto::{Bucket, ReportMetrics};

/// Public worker entrypoint. Aggregates the tenant's events at the
/// requested bucket granularity and upserts the resulting rows into
/// `email_reports_cache`.
///
/// For `Lifetime`, `bucketAt` is pinned to the Unix epoch so the
/// upsert key stays stable across runs.
pub async fn aggregate_for_tenant(
    mongo: &MongoHandle,
    tenant_id: &str,
    bucket: Bucket,
) -> Result<u64> {
    let tenant_oid = ObjectId::parse_str(tenant_id)
        .map_err(|_| ApiError::BadRequest("invalid tenant id".to_owned()))?;
    let now = Utc::now();

    // ----- campaigns -----
    let n_campaigns = aggregate_scope(mongo, tenant_oid, bucket, Scope::Campaign, now).await?;
    // ----- journeys -----
    let n_journeys = aggregate_scope(mongo, tenant_oid, bucket, Scope::Journey, now).await?;
    // ----- account rollup (no scopeId) -----
    let n_account = aggregate_scope(mongo, tenant_oid, bucket, Scope::Account, now).await?;

    Ok(n_campaigns + n_journeys + n_account)
}

#[derive(Debug, Clone, Copy)]
enum Scope {
    Campaign,
    Journey,
    Account,
}

impl Scope {
    fn as_str(self) -> &'static str {
        match self {
            Scope::Campaign => "campaign",
            Scope::Journey => "journey",
            Scope::Account => "account",
        }
    }
    fn group_field(self) -> Option<&'static str> {
        match self {
            Scope::Campaign => Some("$campaignId"),
            Scope::Journey => Some("$journeyId"),
            Scope::Account => None,
        }
    }
}

async fn aggregate_scope(
    mongo: &MongoHandle,
    tenant: ObjectId,
    bucket: Bucket,
    scope: Scope,
    now: DateTime<Utc>,
) -> Result<u64> {
    let bucket_at = match bucket {
        Bucket::Lifetime => Utc.timestamp_opt(0, 0).single().unwrap(),
        Bucket::Day => now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc(),
        Bucket::Hour => Utc
            .with_ymd_and_hms(
                now.year(),
                now.month(),
                now.day(),
                now.hour(),
                0,
                0,
            )
            .single()
            .unwrap_or(now),
    };

    let mut match_doc = doc! { "userId": tenant };
    // For campaign/journey scopes, only consider rows that carry the id.
    match scope {
        Scope::Campaign => {
            match_doc.insert("campaignId", doc! { "$exists": true, "$ne": bson::Bson::Null });
        }
        Scope::Journey => {
            match_doc.insert("journeyId", doc! { "$exists": true, "$ne": bson::Bson::Null });
        }
        Scope::Account => {}
    }

    let group_id: bson::Bson = match scope.group_field() {
        Some(f) => bson::Bson::String(f.to_owned()),
        None => bson::Bson::Null,
    };

    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! {
            "$group": {
                "_id": group_id,
                "sent": { "$sum": { "$cond": [{ "$eq": ["$kind", "send"] }, 1, 0] } },
                "delivered": { "$sum": { "$cond": [{ "$eq": ["$kind", "delivered"] }, 1, 0] } },
                "opened": { "$sum": { "$cond": [{ "$eq": ["$kind", "open"] }, 1, 0] } },
                "clicked": { "$sum": { "$cond": [{ "$eq": ["$kind", "click"] }, 1, 0] } },
                "bouncedHard": { "$sum": { "$cond": [{ "$eq": ["$kind", "bounce_hard"] }, 1, 0] } },
                "bouncedSoft": { "$sum": { "$cond": [{ "$eq": ["$kind", "bounce_soft"] }, 1, 0] } },
                "complained": { "$sum": { "$cond": [{ "$eq": ["$kind", "complaint"] }, 1, 0] } },
                "unsubscribed": { "$sum": { "$cond": [{ "$eq": ["$kind", "unsubscribe"] }, 1, 0] } },
                "uniqueOpenSet": { "$addToSet": {
                    "$cond": [{ "$eq": ["$kind", "open"] }, "$email", "$$REMOVE"]
                } },
                "uniqueClickSet": { "$addToSet": {
                    "$cond": [{ "$eq": ["$kind", "click"] }, "$email", "$$REMOVE"]
                } },
            }
        },
        doc! {
            "$project": {
                "_id": 1,
                "sent": 1,
                "delivered": 1,
                "opened": 1,
                "clicked": 1,
                "bounced": { "$add": ["$bouncedHard", "$bouncedSoft"] },
                "complained": 1,
                "unsubscribed": 1,
                "uniqueOpens": { "$size": "$uniqueOpenSet" },
                "uniqueClicks": { "$size": "$uniqueClickSet" },
            }
        },
    ];

    let cursor = mongo
        .collection::<Document>(EVENTS)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_events.aggregate")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("aggregate.drain")))?;

    let cache = mongo.collection::<Document>(REPORTS_CACHE);
    let bucket_str = bucket.as_str();
    let scope_str = scope.as_str();
    let bucket_at_bson = bson::DateTime::from_chrono(bucket_at);
    let updated_at_bson = bson::DateTime::from_chrono(now);

    let mut count: u64 = 0;
    for d in &docs {
        let scope_id_opt = d.get("_id").and_then(|b| match b {
            bson::Bson::ObjectId(o) => Some(*o),
            _ => None,
        });

        let metrics = doc! {
            "sent": get_i64(d, "sent"),
            "delivered": get_i64(d, "delivered"),
            "opened": get_i64(d, "opened"),
            "uniqueOpens": get_i64(d, "uniqueOpens"),
            "clicked": get_i64(d, "clicked"),
            "uniqueClicks": get_i64(d, "uniqueClicks"),
            "bounced": get_i64(d, "bounced"),
            "complained": get_i64(d, "complained"),
            "unsubscribed": get_i64(d, "unsubscribed"),
        };

        let mut filter = doc! {
            "userId": tenant,
            "scope": scope_str,
            "bucket": bucket_str,
            "bucketAt": bucket_at_bson,
        };
        match scope_id_opt {
            Some(o) => {
                filter.insert("scopeId", o);
            }
            None => {
                filter.insert("scopeId", bson::Bson::Null);
            }
        }

        let update = doc! {
            "$set": {
                "metrics": metrics,
                "updatedAt": updated_at_bson,
            },
            "$setOnInsert": {
                "userId": tenant,
                "scope": scope_str,
                "scopeId": match scope_id_opt {
                    Some(o) => bson::Bson::ObjectId(o),
                    None => bson::Bson::Null,
                },
                "bucket": bucket_str,
                "bucketAt": bucket_at_bson,
            },
        };

        cache
            .update_one(filter, update)
            .upsert(true)
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("email_reports_cache.update_one"),
                )
            })?;
        count += 1;
    }

    Ok(count)
}

/// Live aggregation helper — used by the HTTP handlers when the cache
/// row is missing. Computes the same fields the worker would have
/// upserted, but does **not** persist.
pub async fn live_aggregate(
    mongo: &MongoHandle,
    filter: Document,
) -> Result<ReportMetrics> {
    let pipeline = vec![
        doc! { "$match": filter },
        doc! {
            "$group": {
                "_id": bson::Bson::Null,
                "sent": { "$sum": { "$cond": [{ "$eq": ["$kind", "send"] }, 1, 0] } },
                "delivered": { "$sum": { "$cond": [{ "$eq": ["$kind", "delivered"] }, 1, 0] } },
                "opened": { "$sum": { "$cond": [{ "$eq": ["$kind", "open"] }, 1, 0] } },
                "clicked": { "$sum": { "$cond": [{ "$eq": ["$kind", "click"] }, 1, 0] } },
                "bouncedHard": { "$sum": { "$cond": [{ "$eq": ["$kind", "bounce_hard"] }, 1, 0] } },
                "bouncedSoft": { "$sum": { "$cond": [{ "$eq": ["$kind", "bounce_soft"] }, 1, 0] } },
                "complained": { "$sum": { "$cond": [{ "$eq": ["$kind", "complaint"] }, 1, 0] } },
                "unsubscribed": { "$sum": { "$cond": [{ "$eq": ["$kind", "unsubscribe"] }, 1, 0] } },
                "uniqueOpenSet": { "$addToSet": {
                    "$cond": [{ "$eq": ["$kind", "open"] }, "$email", "$$REMOVE"]
                } },
                "uniqueClickSet": { "$addToSet": {
                    "$cond": [{ "$eq": ["$kind", "click"] }, "$email", "$$REMOVE"]
                } },
            }
        },
    ];

    let cursor = mongo
        .collection::<Document>(EVENTS)
        .aggregate(pipeline)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("live_aggregate.aggregate"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("live_aggregate.drain"))
    })?;

    let Some(d) = docs.first() else {
        return Ok(ReportMetrics::default());
    };
    Ok(ReportMetrics {
        sent: get_u64(d, "sent"),
        delivered: get_u64(d, "delivered"),
        opened: get_u64(d, "opened"),
        unique_opens: array_size(d, "uniqueOpenSet"),
        clicked: get_u64(d, "clicked"),
        unique_clicks: array_size(d, "uniqueClickSet"),
        bounced: get_u64(d, "bouncedHard") + get_u64(d, "bouncedSoft"),
        complained: get_u64(d, "complained"),
        unsubscribed: get_u64(d, "unsubscribed"),
        revenue: None,
    })
}

// ---------------------------------------------------------------------------
// utility — Mongo numeric fields land as i32 / i64 depending on driver
// path so we coerce safely.
// ---------------------------------------------------------------------------

fn get_i64(d: &Document, k: &str) -> i64 {
    d.get_i64(k)
        .ok()
        .or_else(|| d.get_i32(k).ok().map(|v| v as i64))
        .unwrap_or(0)
}
fn get_u64(d: &Document, k: &str) -> u64 {
    get_i64(d, k).max(0) as u64
}

fn array_size(d: &Document, k: &str) -> u64 {
    d.get_array(k).ok().map(|a| a.len() as u64).unwrap_or(0)
}

