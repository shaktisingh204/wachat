use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::state::TelegramAdsState;

const PROJECTS: &str = "projects";
const CAMPAIGNS: &str = "telegram_ads_campaigns";

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "campaignId")]
    pub campaign_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampaignRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "platformId")]
    pub platform_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "landingUrl")]
    pub landing_url: Option<String>,
    #[serde(rename = "budgetCents")]
    pub budget_cents: i64,
    pub impressions: i64,
    pub clicks: i64,
    pub notes: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default, rename = "pageSize")]
    pub page_size: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default, rename = "createdFrom")]
    pub created_from: Option<String>,
    #[serde(default, rename = "createdTo")]
    pub created_to: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub campaigns: Vec<CampaignRow>,
    pub total: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "campaignId")]
    pub campaign_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "platformId")]
    pub platform_id: Option<String>,
    #[serde(default, rename = "landingUrl")]
    pub landing_url: Option<String>,
    #[serde(default, rename = "budgetCents")]
    pub budget_cents: Option<i64>,
    #[serde(default)]
    pub impressions: Option<i64>,
    #[serde(default)]
    pub clicks: Option<i64>,
    #[serde(default)]
    pub notes: Option<String>,
}

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()
                .and_then(|nd| nd.and_hms_opt(0, 0, 0))
                .map(|ndt| Utc.from_utc_datetime(&ndt))
        })
}

async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

fn doc_to_row(d: &Document) -> Option<CampaignRow> {
    Some(CampaignRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        platform_id: d.get_str("platformId").ok().map(str::to_owned),
        landing_url: d.get_str("landingUrl").ok().map(str::to_owned),
        budget_cents: d
            .get_i64("budgetCents")
            .or_else(|_| d.get_i32("budgetCents").map(i64::from))
            .unwrap_or(0),
        impressions: d
            .get_i64("impressions")
            .or_else(|_| d.get_i32("impressions").map(i64::from))
            .unwrap_or(0),
        clicks: d
            .get_i64("clicks")
            .or_else(|_| d.get_i32("clicks").map(i64::from))
            .unwrap_or(0),
        notes: d.get_str("notes").unwrap_or("").to_owned(),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn empty_list(err_msg: Option<String>) -> ListResp {
    ListResp {
        campaigns: vec![],
        total: 0,
        has_more: false,
        page: 1,
        page_size: 20,
        error: err_msg,
    }
}

fn build_list_filter(project_oid: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "projectId": project_oid };
    if let Some(s) = q.status.as_deref() {
        if s != "all" && !s.is_empty() {
            filter.insert("status", s);
        }
    }
    if let Some(search) = q.search.as_deref() {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let escaped = regex::escape(trimmed);
            let regex = doc! { "$regex": escaped, "$options": "i" };
            filter.insert(
                "$or",
                vec![
                    doc! { "name": regex.clone() },
                    doc! { "notes": regex.clone() },
                    doc! { "platformId": regex },
                ],
            );
        }
    }
    let mut created_range = doc! {};
    if let Some(from) = q.created_from.as_deref() {
        if let Some(d) = parse_iso(from) {
            created_range.insert("$gte", bson::DateTime::from_millis(d.timestamp_millis()));
        }
    }
    if let Some(to) = q.created_to.as_deref() {
        if let Some(d) = parse_iso(to) {
            created_range.insert("$lte", bson::DateTime::from_millis(d.timestamp_millis()));
        }
    }
    if !created_range.is_empty() {
        filter.insert("createdAt", created_range);
    }
    filter
}

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return Json(empty_list(Some("projectId is required".to_owned()))),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(empty_list(Some(e))),
    };

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(20).clamp(1, 100);
    let skip = (page - 1) * page_size;
    let filter = build_list_filter(project_oid, &q);

    let coll = s.mongo.collection::<Document>(CAMPAIGNS);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };

    let cursor = match coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    let campaigns: Vec<CampaignRow> = docs.iter().filter_map(doc_to_row).collect();
    let has_more = skip + (campaigns.len() as i64) < total;
    Json(ListResp {
        campaigns,
        total,
        has_more,
        page,
        page_size,
        error: None,
    })
}

pub async fn upsert(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let now = bson::DateTime::now();
    let coll = s.mongo.collection::<Document>(CAMPAIGNS);

    let mut set = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "status": body.status.unwrap_or_else(|| "draft".to_owned()),
        "budgetCents": body.budget_cents.unwrap_or(0),
        "impressions": body.impressions.unwrap_or(0),
        "clicks": body.clicks.unwrap_or(0),
        "notes": body.notes.unwrap_or_default(),
        "updatedAt": now,
    };
    if let Some(p) = body.platform_id {
        set.insert("platformId", p);
    }
    if let Some(u) = body.landing_url {
        set.insert("landingUrl", u);
    }

    if let Some(cid) = body.campaign_id.as_deref() {
        let oid = match parse_oid(cid) {
            Some(o) => o,
            None => return err("Invalid campaign id."),
        };
        match coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": set },
            )
            .await
        {
            Ok(r) if r.matched_count == 0 => err("Campaign not found."),
            Ok(_) => Json(AckResult {
                success: true,
                campaign_id: Some(cid.to_owned()),
                message: Some("Saved.".to_owned()),
                ..Default::default()
            }),
            Err(e) => err(format!("mongo: {e}")),
        }
    } else {
        set.insert("createdAt", now);
        match coll.insert_one(set).await {
            Ok(res) => {
                let id = res
                    .inserted_id
                    .as_object_id()
                    .map(|o| o.to_hex())
                    .unwrap_or_default();
                Json(AckResult {
                    success: true,
                    campaign_id: Some(id),
                    message: Some("Saved.".to_owned()),
                    ..Default::default()
                })
            }
            Err(e) => err(format!("mongo: {e}")),
        }
    }
}

pub async fn delete_campaign(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Path(campaign_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let oid = match parse_oid(&campaign_id) {
        Some(o) => o,
        None => return err("Invalid campaign id."),
    };
    match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            campaign_id: Some(campaign_id),
            message: Some("Deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct DetailResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campaign: Option<CampaignRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn detail(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Path(campaign_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<DetailResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(DetailResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(DetailResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&campaign_id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("Invalid campaign id.".to_owned()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => Json(DetailResp {
            campaign: doc_to_row(&d),
            error: None,
        }),
        Ok(None) => Json(DetailResp {
            error: Some("Campaign not found.".to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(DetailResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsByDayPoint {
    pub date: String,
    pub impressions: i64,
    pub clicks: i64,
    #[serde(rename = "spendCents")]
    pub spend_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TopCampaign {
    #[serde(rename = "campaignId")]
    pub campaign_id: String,
    pub name: String,
    pub impressions: i64,
    pub clicks: i64,
    pub ctr: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct AnalyticsResp {
    #[serde(rename = "totalSpendCents")]
    pub total_spend_cents: i64,
    #[serde(rename = "totalImpressions")]
    pub total_impressions: i64,
    #[serde(rename = "totalClicks")]
    pub total_clicks: i64,
    pub ctr: f64,
    #[serde(rename = "cpmCents")]
    pub cpm_cents: f64,
    #[serde(rename = "cpcCents")]
    pub cpc_cents: f64,
    #[serde(rename = "byDay")]
    pub by_day: Vec<AnalyticsByDayPoint>,
    #[serde(rename = "topCampaigns")]
    pub top_campaigns: Vec<TopCampaign>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Query(q): Query<AnalyticsQuery>,
) -> Json<AnalyticsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(AnalyticsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let now = Utc::now();
    let from = q
        .from
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or_else(|| now - Duration::days(30));
    let to = q.to.as_deref().and_then(parse_iso).unwrap_or(now);

    let mut filter = doc! { "projectId": project_oid };
    let mut range = doc! {};
    range.insert("$gte", bson::DateTime::from_millis(from.timestamp_millis()));
    range.insert("$lte", bson::DateTime::from_millis(to.timestamp_millis()));
    filter.insert("updatedAt", range);

    let cursor = match s.mongo.collection::<Document>(CAMPAIGNS).find(filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let rows: Vec<CampaignRow> = docs.iter().filter_map(doc_to_row).collect();

    let mut total_spend: i64 = 0;
    let mut total_impressions: i64 = 0;
    let mut total_clicks: i64 = 0;

    use std::collections::BTreeMap;
    let mut per_day: BTreeMap<String, (i64, i64, i64)> = BTreeMap::new();

    let mut day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while day <= end_day && guard < 400 {
        per_day.insert(day.format("%Y-%m-%d").to_string(), (0, 0, 0));
        match day.succ_opt() {
            Some(next) => day = next,
            None => break,
        }
        guard += 1;
    }

    for r in &rows {
        total_spend += r.budget_cents;
        total_impressions += r.impressions;
        total_clicks += r.clicks;
        let key = format!(
            "{:04}-{:02}-{:02}",
            r.updated_at.year(),
            r.updated_at.month(),
            r.updated_at.day()
        );
        let entry = per_day.entry(key).or_insert((0, 0, 0));
        entry.0 += r.impressions;
        entry.1 += r.clicks;
        entry.2 += r.budget_cents;
    }

    let by_day: Vec<AnalyticsByDayPoint> = per_day
        .into_iter()
        .map(|(date, (imp, clk, spend))| AnalyticsByDayPoint {
            date,
            impressions: imp,
            clicks: clk,
            spend_cents: spend,
        })
        .collect();

    let ctr = if total_impressions > 0 {
        (total_clicks as f64 / total_impressions as f64) * 100.0
    } else {
        0.0
    };
    let cpm_cents = if total_impressions > 0 {
        (total_spend as f64 / total_impressions as f64) * 1000.0
    } else {
        0.0
    };
    let cpc_cents = if total_clicks > 0 {
        total_spend as f64 / total_clicks as f64
    } else {
        0.0
    };

    let mut sorted = rows.clone();
    sorted.sort_by(|a, b| {
        let ctr_a = if a.impressions > 0 {
            a.clicks as f64 / a.impressions as f64
        } else {
            0.0
        };
        let ctr_b = if b.impressions > 0 {
            b.clicks as f64 / b.impressions as f64
        } else {
            0.0
        };
        ctr_b
            .partial_cmp(&ctr_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let top_campaigns: Vec<TopCampaign> = sorted
        .into_iter()
        .take(5)
        .map(|r| {
            let ctr_v = if r.impressions > 0 {
                (r.clicks as f64 / r.impressions as f64) * 100.0
            } else {
                0.0
            };
            TopCampaign {
                campaign_id: r._id,
                name: r.name,
                impressions: r.impressions,
                clicks: r.clicks,
                ctr: ctr_v,
            }
        })
        .collect();

    Json(AnalyticsResp {
        total_spend_cents: total_spend,
        total_impressions,
        total_clicks,
        ctr,
        cpm_cents,
        cpc_cents,
        by_day,
        top_campaigns,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// CSV import / export
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ImportBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub csv: String,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ImportResp {
    pub success: bool,
    pub inserted: i64,
    pub updated: i64,
    pub skipped: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub async fn import_csv(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Json(body): Json<ImportBody>,
) -> Json<ImportResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ImportResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let mode = body.mode.unwrap_or_else(|| "append".to_owned());
    let replace_stats = mode == "replace_stats";

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(body.csv.as_bytes());

    let headers: Vec<String> = match reader.headers() {
        Ok(h) => h.iter().map(|s| s.trim().to_lowercase()).collect(),
        Err(e) => {
            return Json(ImportResp {
                success: false,
                error: Some(format!("csv header: {e}")),
                ..Default::default()
            });
        }
    };

    let idx = |key: &str| headers.iter().position(|h| h == key);
    let i_name = idx("name");
    let i_impr = idx("impressions");
    let i_clk = idx("clicks");
    let i_budget = idx("budget_cents");
    let i_status = idx("status");
    let i_platform = idx("platform_id");
    let i_landing = idx("landing_url");

    if i_name.is_none() {
        return Json(ImportResp {
            success: false,
            error: Some("CSV must include a 'name' header".to_owned()),
            ..Default::default()
        });
    }

    let coll = s.mongo.collection::<Document>(CAMPAIGNS);
    let now = bson::DateTime::now();
    let mut inserted: i64 = 0;
    let mut updated: i64 = 0;
    let mut skipped: i64 = 0;

    for record in reader.records() {
        let Ok(rec) = record else {
            skipped += 1;
            continue;
        };
        let name = i_name
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();
        if name.is_empty() {
            skipped += 1;
            continue;
        }
        let impressions = i_impr
            .and_then(|i| rec.get(i))
            .and_then(|s| s.trim().parse::<i64>().ok())
            .unwrap_or(0);
        let clicks = i_clk
            .and_then(|i| rec.get(i))
            .and_then(|s| s.trim().parse::<i64>().ok())
            .unwrap_or(0);
        let budget = i_budget
            .and_then(|i| rec.get(i))
            .and_then(|s| s.trim().parse::<i64>().ok())
            .unwrap_or(0);
        let status_v = i_status
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        let platform = i_platform
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        let landing = i_landing
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());

        let match_doc = if let Some(p) = platform.as_deref() {
            doc! { "projectId": project_oid, "platformId": p }
        } else {
            doc! { "projectId": project_oid, "name": &name }
        };
        let existing = coll.find_one(match_doc.clone()).await.ok().flatten();

        let mut set = doc! {
            "projectId": project_oid,
            "name": &name,
            "updatedAt": now,
        };
        if let Some(st) = status_v {
            set.insert("status", st);
        }
        if let Some(p) = platform.clone() {
            set.insert("platformId", p);
        }
        if let Some(l) = landing {
            set.insert("landingUrl", l);
        }
        if replace_stats {
            set.insert("impressions", impressions);
            set.insert("clicks", clicks);
            set.insert("budgetCents", budget);
        } else if existing.is_none() {
            set.insert("impressions", impressions);
            set.insert("clicks", clicks);
            set.insert("budgetCents", budget);
        }

        if existing.is_some() {
            let update_doc = if replace_stats {
                doc! { "$set": set }
            } else {
                doc! {
                    "$set": set,
                    "$inc": {
                        "impressions": impressions,
                        "clicks": clicks,
                        "budgetCents": budget,
                    }
                }
            };
            match coll.update_one(match_doc, update_doc).await {
                Ok(_) => updated += 1,
                Err(_) => skipped += 1,
            }
        } else {
            set.insert("createdAt", now);
            if !set.contains_key("status") {
                set.insert("status", "draft");
            }
            if !set.contains_key("notes") {
                set.insert("notes", "");
            }
            match coll.insert_one(set).await {
                Ok(_) => inserted += 1,
                Err(_) => skipped += 1,
            }
        }
    }

    Json(ImportResp {
        success: true,
        inserted,
        updated,
        skipped,
        error: None,
        message: Some(format!(
            "Imported {inserted} new, updated {updated}, skipped {skipped}."
        )),
    })
}

fn csv_escape(v: &str) -> String {
    if v.contains(',') || v.contains('"') || v.contains('\n') {
        let escaped = v.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        v.to_owned()
    }
}

pub async fn export_csv(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Query(q): Query<ListQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return (StatusCode::BAD_REQUEST, "projectId is required").into_response();
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    let cursor = match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    let rows: Vec<CampaignRow> = docs.iter().filter_map(doc_to_row).collect();

    let mut body = String::from(
        "name,status,platform_id,landing_url,budget_cents,impressions,clicks,notes,created_at,updated_at\n",
    );
    for r in rows {
        body.push_str(&csv_escape(&r.name));
        body.push(',');
        body.push_str(&csv_escape(&r.status));
        body.push(',');
        body.push_str(&csv_escape(r.platform_id.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.landing_url.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&r.budget_cents.to_string());
        body.push(',');
        body.push_str(&r.impressions.to_string());
        body.push(',');
        body.push_str(&r.clicks.to_string());
        body.push(',');
        body.push_str(&csv_escape(&r.notes));
        body.push(',');
        body.push_str(&r.created_at.to_rfc3339());
        body.push(',');
        body.push_str(&r.updated_at.to_rfc3339());
        body.push('\n');
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"telegram-ads.csv\""),
    );
    (StatusCode::OK, headers, body).into_response()
}

// ---------------------------------------------------------------------------
// Bulk delete
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct BulkDeleteBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BulkDeleteResp {
    pub success: bool,
    pub deleted: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub async fn bulk_delete(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Json(body): Json<BulkDeleteBody>,
) -> Json<BulkDeleteResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BulkDeleteResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oids: Vec<Bson> = body
        .ids
        .iter()
        .filter_map(|i| parse_oid(i))
        .map(Bson::ObjectId)
        .collect();
    if oids.is_empty() {
        return Json(BulkDeleteResp {
            success: false,
            error: Some("No valid ids supplied.".to_owned()),
            ..Default::default()
        });
    }
    match s
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .delete_many(doc! { "_id": { "$in": oids }, "projectId": project_oid })
        .await
    {
        Ok(res) => Json(BulkDeleteResp {
            success: true,
            deleted: res.deleted_count as i64,
            error: None,
            message: Some(format!("Deleted {}.", res.deleted_count)),
        }),
        Err(e) => Json(BulkDeleteResp {
            success: false,
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// ---------------------------------------------------------------------------
// UTM link builder
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct UtmBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "campaignId")]
    pub campaign_id: Option<String>,
    #[serde(rename = "landingUrl")]
    pub landing_url: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub medium: Option<String>,
    #[serde(default)]
    pub campaign: Option<String>,
    #[serde(default)]
    pub term: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct UtmResp {
    pub success: bool,
    #[serde(rename = "shortUrl")]
    pub short_url: String,
    #[serde(rename = "longUrl")]
    pub long_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn utm(
    user: AuthUser,
    State(s): State<TelegramAdsState>,
    Json(body): Json<UtmBody>,
) -> Json<UtmResp> {
    if let Err(e) = require_project(&user, &s.mongo, &body.project_id).await {
        return Json(UtmResp {
            success: false,
            short_url: String::new(),
            long_url: String::new(),
            error: Some(e),
        });
    }
    if body.landing_url.trim().is_empty() {
        return Json(UtmResp {
            success: false,
            short_url: String::new(),
            long_url: String::new(),
            error: Some("landingUrl is required".to_owned()),
        });
    }

    let mut params: Vec<(&str, String)> = vec![];
    if let Some(v) = body.source.filter(|s| !s.trim().is_empty()) {
        params.push(("utm_source", v));
    } else {
        params.push(("utm_source", "telegram".to_owned()));
    }
    if let Some(v) = body.medium.filter(|s| !s.trim().is_empty()) {
        params.push(("utm_medium", v));
    } else {
        params.push(("utm_medium", "ads".to_owned()));
    }
    if let Some(v) = body.campaign.filter(|s| !s.trim().is_empty()) {
        params.push(("utm_campaign", v));
    } else if let Some(cid) = body.campaign_id.as_deref() {
        params.push(("utm_campaign", cid.to_owned()));
    }
    if let Some(v) = body.term.filter(|s| !s.trim().is_empty()) {
        params.push(("utm_term", v));
    }
    if let Some(v) = body.content.filter(|s| !s.trim().is_empty()) {
        params.push(("utm_content", v));
    }

    let qs: String = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let separator = if body.landing_url.contains('?') {
        '&'
    } else {
        '?'
    };
    let long_url = format!("{}{}{}", body.landing_url.trim(), separator, qs);

    Json(UtmResp {
        success: true,
        short_url: long_url.clone(),
        long_url,
        error: None,
    })
}
