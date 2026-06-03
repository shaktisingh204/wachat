//! Axum handlers for `/v1/email/reports`.

use axum::{
    Json,
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Document, doc, oid::ObjectId};
use email_types::collections::{EVENTS, REPORTS_CACHE};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::aggregate::live_aggregate;
use crate::dto::{
    AccountReport, CampaignReport, CompareBody, CompareResponse, CompareRow, ExportBody,
    JourneyReport, ReportMetrics, RevenueResponse, RevenueRow,
};
use crate::state::EmailReportsState;

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::BadRequest("invalid tenant id in token".to_owned()))
}

fn parse_oid(s: &str, label: &'static str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label} id")))
}

fn doc_metrics(d: &Document) -> ReportMetrics {
    let m = d
        .get_document("metrics")
        .cloned()
        .unwrap_or_else(|_| Document::new());
    ReportMetrics {
        sent: get_u64(&m, "sent"),
        delivered: get_u64(&m, "delivered"),
        opened: get_u64(&m, "opened"),
        unique_opens: get_u64(&m, "uniqueOpens"),
        clicked: get_u64(&m, "clicked"),
        unique_clicks: get_u64(&m, "uniqueClicks"),
        bounced: get_u64(&m, "bounced"),
        complained: get_u64(&m, "complained"),
        unsubscribed: get_u64(&m, "unsubscribed"),
        revenue: m.get_f64("revenue").ok(),
    }
}

fn get_u64(d: &Document, k: &str) -> u64 {
    d.get_i64(k)
        .ok()
        .or_else(|| d.get_i32(k).ok().map(|v| v as i64))
        .unwrap_or(0)
        .max(0) as u64
}

// ===========================================================================
// Campaign / journey / account
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn campaign_report(
    user: AuthUser,
    State(state): State<EmailReportsState>,
    Path(id): Path<String>,
) -> Result<Json<CampaignReport>> {
    let tenant = tenant_oid(&user)?;
    let oid = parse_oid(&id, "campaign")?;

    let cache = state.mongo.collection::<Document>(REPORTS_CACHE);
    let cached = cache
        .find_one(doc! {
            "userId": tenant,
            "scope": "campaign",
            "scopeId": oid,
            "bucket": "lifetime",
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_reports_cache.find_one"))
        })?;

    if let Some(d) = cached {
        let updated_at = d
            .get_datetime("updatedAt")
            .ok()
            .and_then(|dt| dt.try_to_rfc3339_string().ok());
        return Ok(Json(CampaignReport {
            campaign_id: id,
            bucket: "lifetime",
            metrics: doc_metrics(&d),
            updated_at,
            from_cache: true,
        }));
    }

    // Live fallback.
    let filter = doc! { "userId": tenant, "campaignId": oid };
    let metrics = live_aggregate(&state.mongo, filter).await?;
    Ok(Json(CampaignReport {
        campaign_id: id,
        bucket: "lifetime",
        metrics,
        updated_at: None,
        from_cache: false,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn journey_report(
    user: AuthUser,
    State(state): State<EmailReportsState>,
    Path(id): Path<String>,
) -> Result<Json<JourneyReport>> {
    let tenant = tenant_oid(&user)?;
    let oid = parse_oid(&id, "journey")?;

    let cache = state.mongo.collection::<Document>(REPORTS_CACHE);
    let cached = cache
        .find_one(doc! {
            "userId": tenant,
            "scope": "journey",
            "scopeId": oid,
            "bucket": "lifetime",
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_reports_cache.find_one"))
        })?;

    if let Some(d) = cached {
        let updated_at = d
            .get_datetime("updatedAt")
            .ok()
            .and_then(|dt| dt.try_to_rfc3339_string().ok());
        return Ok(Json(JourneyReport {
            journey_id: id,
            bucket: "lifetime",
            metrics: doc_metrics(&d),
            updated_at,
            from_cache: true,
        }));
    }

    let filter = doc! { "userId": tenant, "journeyId": oid };
    let metrics = live_aggregate(&state.mongo, filter).await?;
    Ok(Json(JourneyReport {
        journey_id: id,
        bucket: "lifetime",
        metrics,
        updated_at: None,
        from_cache: false,
    }))
}

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn account_report(
    user: AuthUser,
    State(state): State<EmailReportsState>,
) -> Result<Json<AccountReport>> {
    let tenant = tenant_oid(&user)?;
    let cache = state.mongo.collection::<Document>(REPORTS_CACHE);
    let cached = cache
        .find_one(doc! {
            "userId": tenant,
            "scope": "account",
            "scopeId": bson::Bson::Null,
            "bucket": "lifetime",
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_reports_cache.find_one"))
        })?;

    if let Some(d) = cached {
        return Ok(Json(AccountReport {
            tenant_id: user.tenant_id,
            bucket: "lifetime",
            metrics: doc_metrics(&d),
            from_cache: true,
        }));
    }
    let filter = doc! { "userId": tenant };
    let metrics = live_aggregate(&state.mongo, filter).await?;
    Ok(Json(AccountReport {
        tenant_id: user.tenant_id,
        bucket: "lifetime",
        metrics,
        from_cache: false,
    }))
}

// ===========================================================================
// Compare
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn compare(
    user: AuthUser,
    State(state): State<EmailReportsState>,
    Json(body): Json<CompareBody>,
) -> Result<Json<CompareResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut rows: Vec<CompareRow> = Vec::with_capacity(body.campaign_ids.len());

    for raw in body.campaign_ids {
        let Ok(oid) = ObjectId::parse_str(&raw) else {
            continue;
        };
        // Prefer cached lifetime row.
        let cache = state.mongo.collection::<Document>(REPORTS_CACHE);
        let cached = cache
            .find_one(doc! {
                "userId": tenant,
                "scope": "campaign",
                "scopeId": oid,
                "bucket": "lifetime",
            })
            .await
            .ok()
            .flatten();
        let metrics = if let Some(d) = cached {
            doc_metrics(&d)
        } else {
            live_aggregate(&state.mongo, doc! { "userId": tenant, "campaignId": oid })
                .await
                .unwrap_or_default()
        };
        rows.push(CompareRow {
            campaign_id: raw,
            metrics,
        });
    }
    Ok(Json(CompareResponse { rows }))
}

// ===========================================================================
// Revenue — join clicks against CRM orders by subscriber email.
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn revenue(
    user: AuthUser,
    State(state): State<EmailReportsState>,
) -> Result<Json<RevenueResponse>> {
    let tenant = tenant_oid(&user)?;
    // Aggregate clicks per (campaign, email), then lookup `crm_orders`
    // by `customerEmail`. `crm_orders` is the placeholder collection —
    // when the CRM rebuild swaps to a different shape we change the
    // pipeline here.
    let pipeline = vec![
        doc! { "$match": {
            "userId": tenant,
            "kind": "click",
            "campaignId": { "$exists": true, "$ne": bson::Bson::Null },
        } },
        doc! { "$group": {
            "_id": { "campaignId": "$campaignId", "email": "$email" },
            "clicks": { "$sum": 1 },
        } },
        doc! { "$lookup": {
            "from": "crm_orders",
            "let": { "email": "$_id.email", "uid": tenant },
            "pipeline": [
                { "$match": {
                    "$expr": { "$and": [
                        { "$eq": ["$customerEmail", "$$email"] },
                        { "$eq": ["$userId", "$$uid"] },
                    ] }
                } },
                { "$project": { "total": 1 } },
            ],
            "as": "orders",
        } },
        doc! { "$group": {
            "_id": "$_id.campaignId",
            "orders": { "$sum": { "$size": "$orders" } },
            "revenue": { "$sum": { "$sum": "$orders.total" } },
            "clicks": { "$sum": "$clicks" },
        } },
    ];

    let cursor = state
        .mongo
        .collection::<Document>(EVENTS)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("revenue.aggregate")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("revenue.drain")))?;

    let rows: Vec<RevenueRow> = docs
        .iter()
        .map(|d| {
            let campaign_id = d
                .get("_id")
                .and_then(|b| match b {
                    bson::Bson::ObjectId(o) => Some(o.to_hex()),
                    _ => None,
                })
                .unwrap_or_default();
            RevenueRow {
                campaign_id,
                orders: get_u64(d, "orders"),
                revenue: d.get_f64("revenue").unwrap_or(0.0),
                clicks: get_u64(d, "clicks"),
            }
        })
        .collect();

    Ok(Json(RevenueResponse { rows }))
}

// ===========================================================================
// Export
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn export(
    user: AuthUser,
    State(state): State<EmailReportsState>,
    Json(body): Json<ExportBody>,
) -> Result<Response> {
    let format = body.format.to_lowercase();
    if format == "pdf" {
        // PDF export deferred — return 501 so the client can branch.
        return Ok((
            StatusCode::NOT_IMPLEMENTED,
            "pdf export not yet implemented",
        )
            .into_response());
    }
    if format != "csv" {
        return Err(ApiError::BadRequest("format must be csv or pdf".to_owned()));
    }

    let tenant = tenant_oid(&user)?;
    let scope = body.scope.as_str();
    let metrics =
        match scope {
            "campaign" => {
                let id = body.scope_id.as_deref().ok_or_else(|| {
                    ApiError::BadRequest("scopeId required for campaign".to_owned())
                })?;
                let oid = parse_oid(id, "campaign")?;
                live_aggregate(&state.mongo, doc! { "userId": tenant, "campaignId": oid }).await?
            }
            "journey" => {
                let id = body.scope_id.as_deref().ok_or_else(|| {
                    ApiError::BadRequest("scopeId required for journey".to_owned())
                })?;
                let oid = parse_oid(id, "journey")?;
                live_aggregate(&state.mongo, doc! { "userId": tenant, "journeyId": oid }).await?
            }
            "account" => live_aggregate(&state.mongo, doc! { "userId": tenant }).await?,
            other => {
                return Err(ApiError::BadRequest(format!("unknown scope `{other}`")));
            }
        };

    let csv = format!(
        "metric,value\nsent,{}\ndelivered,{}\nopened,{}\nuniqueOpens,{}\nclicked,{}\nuniqueClicks,{}\nbounced,{}\ncomplained,{}\nunsubscribed,{}\n",
        metrics.sent,
        metrics.delivered,
        metrics.opened,
        metrics.unique_opens,
        metrics.clicked,
        metrics.unique_clicks,
        metrics.bounced,
        metrics.complained,
        metrics.unsubscribed,
    );

    let filename = match body.scope_id.as_deref() {
        Some(s) => format!("email-report-{}-{}.csv", scope, s),
        None => format!("email-report-{}.csv", scope),
    };
    let resp = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(axum::body::Body::from(csv))
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("csv response build")))?;
    Ok(resp)
}
