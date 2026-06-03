//! Admin-gated dashboard, webhook-log, and broadcast-list handlers.
//!
//! Ports the following TS server actions:
//!
//! - `getAdminDashboardStats` (`src/app/actions/admin.actions.ts`)
//!     → `GET /dashboard-stats`
//! - `getWebhookLogs`         (`src/app/actions/webhook.actions.ts`)
//!     → `GET /webhook-logs`
//! - `getWebhookLogPayload`   (`src/app/actions/webhook.actions.ts`)
//!     → `GET /webhook-logs/{id}/payload`
//! - `getAllBroadcasts`       (`src/app/actions/broadcast.actions.ts`)
//!     → `GET /broadcasts`
//!
//! Every handler runs the `require_admin` gate against the JWT roles claim
//! before touching Mongo — defense-in-depth on top of the `rustAdminFetch`
//! cookie check on the TS side.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::get,
};
use bson::{Document, doc};
use futures::TryStreamExt;
use mongodb::options::{FindOneOptions, FindOptions};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::guard::require_admin;

const WEBHOOK_LOGS_COLL: &str = "webhook_logs";
const BROADCASTS_COLL: &str = "broadcasts";

// ---------------------------------------------------------------------------
// AdminStats — mirrors the TS `AdminStats` type. camelCase via serde rename
// on each sub-struct so the wire shape matches the legacy server action.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CoreStats {
    pub total_users: u64,
    pub approved_users: u64,
    pub pending_users: u64,
    pub total_projects: u64,
    pub total_wabas: u64,
    pub total_plans: u64,
    pub total_transactions: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WachatStats {
    pub broadcasts: u64,
    pub outgoing_messages: u64,
    pub incoming_messages: u64,
    pub contacts: u64,
    pub templates: u64,
    pub library_templates: u64,
    pub flows: u64,
    pub flow_logs: u64,
    pub canned_messages: u64,
    pub activity_logs: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CrmStats {
    pub contacts: u64,
    pub leads: u64,
    pub deals: u64,
    pub invoices: u64,
    pub quotations: u64,
    pub sales_orders: u64,
    pub purchase_orders: u64,
    pub expenses: u64,
    pub products: u64,
    pub employees: u64,
    pub vendors: u64,
    pub tasks: u64,
    pub automations: u64,
    pub forms: u64,
    pub form_submissions: u64,
    pub voucher_entries: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdsStats {
    pub ad_campaigns: u64,
    pub facebook_broadcasts: u64,
    pub facebook_flows: u64,
    pub facebook_subscribers: u64,
    pub meta_flows: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarketingStats {
    pub email_campaigns: u64,
    pub email_contacts: u64,
    pub email_templates: u64,
    pub sms_campaigns: u64,
    pub sms_logs: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlatformStats {
    pub seo_projects: u64,
    pub seo_audits: u64,
    pub seo_keywords: u64,
    pub sabflows: u64,
    pub sabflow_executions: u64,
    pub sabchat_sessions: u64,
    pub team_channels: u64,
    pub team_messages: u64,
    pub team_tasks: u64,
    pub notifications: u64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ToolsStats {
    pub short_urls: u64,
    pub qr_codes: u64,
    pub ecomm_shops: u64,
    pub ecomm_products: u64,
    pub ecomm_orders: u64,
    pub website_pages: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminStats {
    pub core: CoreStats,
    pub wachat: WachatStats,
    pub crm: CrmStats,
    pub ads: AdsStats,
    pub marketing: MarketingStats,
    pub platform: PlatformStats,
    pub tools: ToolsStats,
}

/// Mirror the TS `count(name, filter).catch(() => 0)` helper — never fail the
/// whole dashboard because one collection is missing or unreadable.
async fn count_safe(mongo: &MongoHandle, name: &str, filter: Document) -> u64 {
    mongo
        .collection::<Document>(name)
        .count_documents(filter)
        .await
        .unwrap_or(0)
}

/// `GET /v1/admin/dashboard-stats` — every count in the legacy
/// `getAdminDashboardStats` server action, executed against this Rust
/// process's Mongo connection. Three counts that the TS code dispatched to the
/// Rust BFF (`ad_campaigns`, `short_urls`, `qr_codes`) are now read directly
/// from the local Mongo since we *are* the Rust side.
pub async fn dashboard_stats(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<AdminStats>> {
    require_admin(&user)?;

    // Core
    let total_users = count_safe(&mongo, "users", Document::new()).await;
    let approved_users = count_safe(&mongo, "users", doc! { "isApproved": true }).await;
    let pending_users = count_safe(&mongo, "users", doc! { "isApproved": { "$ne": true } }).await;
    let total_projects = count_safe(&mongo, "projects", Document::new()).await;
    let total_wabas = count_safe(&mongo, "projects", doc! { "wabaId": { "$exists": true } }).await;
    let total_plans = count_safe(&mongo, "plans", Document::new()).await;
    let total_transactions = count_safe(&mongo, "transactions", Document::new()).await;

    // Wachat
    let broadcasts = count_safe(&mongo, "broadcasts", Document::new()).await;
    let outgoing_messages = count_safe(&mongo, "outgoing_messages", Document::new()).await;
    let incoming_messages = count_safe(&mongo, "incoming_messages", Document::new()).await;
    let wa_contacts = count_safe(&mongo, "contacts", Document::new()).await;
    let templates = count_safe(&mongo, "templates", Document::new()).await;
    let library_templates = count_safe(&mongo, "library_templates", Document::new()).await;
    let flows = count_safe(&mongo, "flows", Document::new()).await;
    let flow_logs = count_safe(&mongo, "flow_logs", Document::new()).await;
    let canned_messages = count_safe(&mongo, "canned_messages", Document::new()).await;
    let activity_logs = count_safe(&mongo, "activity_logs", Document::new()).await;

    // CRM
    let crm_contacts = count_safe(&mongo, "crm_contacts", Document::new()).await;
    let crm_leads = count_safe(&mongo, "crm_leads", Document::new()).await;
    let crm_deals = count_safe(&mongo, "crm_deals", Document::new()).await;
    let crm_invoices = count_safe(&mongo, "crm_invoices", Document::new()).await;
    let crm_quotations = count_safe(&mongo, "crm_quotations", Document::new()).await;
    let crm_sales_orders = count_safe(&mongo, "crm_sales_orders", Document::new()).await;
    let crm_purchase_orders = count_safe(&mongo, "crm_purchase_orders", Document::new()).await;
    let crm_expenses = count_safe(&mongo, "crm_expenses", Document::new()).await;
    let crm_products = count_safe(&mongo, "crm_products", Document::new()).await;
    let crm_employees = count_safe(&mongo, "crm_employees", Document::new()).await;
    let crm_vendors = count_safe(&mongo, "crm_vendors", Document::new()).await;
    let crm_tasks = count_safe(&mongo, "crm_tasks", Document::new()).await;
    let crm_automations = count_safe(&mongo, "crm_automations", Document::new()).await;
    let crm_forms = count_safe(&mongo, "crm_forms", Document::new()).await;
    let crm_form_submissions = count_safe(&mongo, "crm_form_submissions", Document::new()).await;
    let crm_voucher_entries = count_safe(&mongo, "crm_voucher_entries", Document::new()).await;

    // Ads — `ad_campaigns` collection is owned by the Rust ad-manager crate.
    let ad_campaigns = count_safe(&mongo, "ad_campaigns", Document::new()).await;
    let facebook_broadcasts = count_safe(&mongo, "facebook_broadcasts", Document::new()).await;
    let facebook_flows = count_safe(&mongo, "facebook_flows", Document::new()).await;
    let facebook_subscribers = count_safe(&mongo, "facebook_subscribers", Document::new()).await;
    let meta_flows = count_safe(&mongo, "meta_flows", Document::new()).await;

    // Marketing
    let email_campaigns = count_safe(&mongo, "email_campaigns", Document::new()).await;
    let email_contacts = count_safe(&mongo, "email_contacts", Document::new()).await;
    let email_templates = count_safe(&mongo, "email_templates", Document::new()).await;
    let sms_campaigns = count_safe(&mongo, "sms_campaigns", Document::new()).await;
    let sms_logs = count_safe(&mongo, "sms_logs", Document::new()).await;

    // Platform
    let seo_projects = count_safe(&mongo, "seo_projects", Document::new()).await;
    let seo_audits = count_safe(&mongo, "seo_audits", Document::new()).await;
    let seo_keywords = count_safe(&mongo, "seo_keywords", Document::new()).await;
    let sabflows = count_safe(&mongo, "sabflows", Document::new()).await;
    let sabflow_executions = count_safe(&mongo, "sabflow_executions", Document::new()).await;
    let sabchat_sessions = count_safe(&mongo, "sabchat_sessions", Document::new()).await;
    let team_channels = count_safe(&mongo, "team_channels", Document::new()).await;
    let team_messages = count_safe(&mongo, "team_messages", Document::new()).await;
    let team_tasks = count_safe(&mongo, "team_tasks", Document::new()).await;
    let notifications = count_safe(&mongo, "notifications", Document::new()).await;

    // Tools — `short_urls` and `qr_codes` are owned by the Rust BFF; we read
    // the local Mongo collections directly here.
    let short_urls = count_safe(&mongo, "short_urls", Document::new()).await;
    let qr_codes = count_safe(&mongo, "qr_codes", Document::new()).await;
    let ecomm_shops = count_safe(&mongo, "ecomm_shops", Document::new()).await;
    let ecomm_products = count_safe(&mongo, "ecomm_products", Document::new()).await;
    let ecomm_orders = count_safe(&mongo, "ecomm_orders", Document::new()).await;
    let website_pages = count_safe(&mongo, "website_pages", Document::new()).await;

    Ok(Json(AdminStats {
        core: CoreStats {
            total_users,
            approved_users,
            pending_users,
            total_projects,
            total_wabas,
            total_plans,
            total_transactions,
        },
        wachat: WachatStats {
            broadcasts,
            outgoing_messages,
            incoming_messages,
            contacts: wa_contacts,
            templates,
            library_templates,
            flows,
            flow_logs,
            canned_messages,
            activity_logs,
        },
        crm: CrmStats {
            contacts: crm_contacts,
            leads: crm_leads,
            deals: crm_deals,
            invoices: crm_invoices,
            quotations: crm_quotations,
            sales_orders: crm_sales_orders,
            purchase_orders: crm_purchase_orders,
            expenses: crm_expenses,
            products: crm_products,
            employees: crm_employees,
            vendors: crm_vendors,
            tasks: crm_tasks,
            automations: crm_automations,
            forms: crm_forms,
            form_submissions: crm_form_submissions,
            voucher_entries: crm_voucher_entries,
        },
        ads: AdsStats {
            ad_campaigns,
            facebook_broadcasts,
            facebook_flows,
            facebook_subscribers,
            meta_flows,
        },
        marketing: MarketingStats {
            email_campaigns,
            email_contacts,
            email_templates,
            sms_campaigns,
            sms_logs,
        },
        platform: PlatformStats {
            seo_projects,
            seo_audits,
            seo_keywords,
            sabflows,
            sabflow_executions,
            sabchat_sessions,
            team_channels,
            team_messages,
            team_tasks,
            notifications,
        },
        tools: ToolsStats {
            short_urls,
            qr_codes,
            ecomm_shops,
            ecomm_products,
            ecomm_orders,
            website_pages,
        },
    }))
}

// ---------------------------------------------------------------------------
// Webhook logs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct WebhookLogsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_webhook_limit")]
    pub limit: u64,
}

fn default_page() -> u64 {
    1
}

fn default_webhook_limit() -> u64 {
    20
}

fn default_broadcast_limit() -> u64 {
    20
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WebhookLogsResponse {
    pub logs: Vec<Value>,
    pub total: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WebhookLogPayloadResponse {
    pub payload: Option<Value>,
}

/// `GET /v1/admin/webhook-logs?projectId=&page=&limit=` — paginated list of
/// captured webhook deliveries with the `payload` field stripped (the list
/// view only needs metadata; the payload is fetched separately).
pub async fn list_webhook_logs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<WebhookLogsQuery>,
) -> Result<Json<WebhookLogsResponse>> {
    require_admin(&user)?;

    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let mut filter = Document::new();
    if let Some(pid) = q.project_id.as_deref().map(str::trim) {
        if !pid.is_empty() {
            let oid = oid_from_str(pid)?;
            filter.insert("projectId", oid);
        }
    }

    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLL);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .projection(doc! { "payload": 0 })
        .skip(skip)
        .limit(limit as i64)
        .build();

    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("webhook_logs.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("webhook_logs.collect")))?;

    let logs: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("webhook_logs.count")))?;

    Ok(Json(WebhookLogsResponse { logs, total }))
}

/// `GET /v1/admin/webhook-logs/{id}/payload` — fetch just the raw payload
/// for a single webhook log. Returns `{ payload: null }` on miss.
pub async fn get_webhook_log_payload(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<WebhookLogPayloadResponse>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLL);

    let opts = FindOneOptions::builder()
        .projection(doc! { "payload": 1 })
        .build();

    let doc_ = coll
        .find_one(doc! { "_id": oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("webhook_logs.find_one")))?;

    let payload = doc_.and_then(|mut d| {
        d.remove("payload").map(|b| {
            let bjson: bson::Bson = b;
            sabnode_db::bson_helpers::bson_to_clean_json(bjson)
        })
    });

    Ok(Json(WebhookLogPayloadResponse { payload }))
}

// ---------------------------------------------------------------------------
// Broadcasts (global admin list)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct BroadcastsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_broadcast_limit")]
    pub limit: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BroadcastsResponse {
    pub broadcasts: Vec<Value>,
    pub total: u64,
}

/// `GET /v1/admin/broadcasts?page=&limit=` — global list of every broadcast
/// across all projects, newest first. Mirrors `getAllBroadcasts`.
pub async fn list_all_broadcasts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<BroadcastsQuery>,
) -> Result<Json<BroadcastsResponse>> {
    require_admin(&user)?;

    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let coll = mongo.collection::<Document>(BROADCASTS_COLL);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit as i64)
        .build();

    let cursor = coll
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.collect")))?;

    let broadcasts: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    let total = coll
        .count_documents(doc! {})
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.count")))?;

    Ok(Json(BroadcastsResponse { broadcasts, total }))
}

/// Routes mounted at `/v1/admin` from [`crate::router`].
pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/dashboard-stats", get(dashboard_stats))
        .route("/webhook-logs", get(list_webhook_logs))
        .route("/webhook-logs/{id}/payload", get(get_webhook_log_payload))
        .route("/broadcasts", get(list_all_broadcasts))
}
