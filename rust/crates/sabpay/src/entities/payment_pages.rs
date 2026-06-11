//! SabPay Payment Pages — `page_…` no-code hosted pages.
//!
//! A payment page is a shareable, hosted form a merchant publishes at
//! `/pay/<slug>`. It collects a (fixed or customer-decided) amount plus a set of
//! custom fields; submitting it from the public endpoint spins up a regular
//! `pay_…` payment session linked back via `paymentPageId`, so the finalize
//! chokepoint and webhooks behave exactly like any other source.
//!
//! Mirrors the `orders` reference module: DTOs → `doc_to_*` mapper →
//! `{userId, mode}`-scoped store fns → Axum handlers. Routes are wired centrally
//! in `lib.rs`. Public handlers carry no `AuthUser`; they resolve the owning
//! user from the page doc's `userId` for branding, like `handlers::public_get_payment`.

use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::dto::CreatePaymentBody;
use crate::ids::new_id;
use crate::store::{
    self, bool_or, iso_opt, num_opt_i64, str_opt, str_or, user_oid, validate_amount,
};

const COLL: &str = store::PAYMENT_PAGES;
const DEFAULT_NAME: &str = "My business";
const ALLOWED_FIELD_TYPES: &[&str] = &["text", "email", "phone", "number"];
const MAX_FIELDS: usize = 10;

/* ── DTOs ────────────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageField {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentPageOut {
    pub id: String,
    pub mode: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub slug: String,
    pub amount_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_amount: Option<i64>,
    pub fields: Vec<PageField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branding_image_url: Option<String>,
    pub active: bool,
    pub url: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageBody {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub slug: String,
    pub amount_type: String,
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub min_amount: Option<i64>,
    #[serde(default)]
    pub fields: Option<Vec<PageField>>,
    #[serde(default)]
    pub branding_image_url: Option<String>,
    /// Set by the public API from the key prefix; the dashboard omits it.
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageBody {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub amount: Option<i64>,
    #[serde(default)]
    pub min_amount: Option<i64>,
    #[serde(default)]
    pub fields: Option<Vec<PageField>>,
    #[serde(default)]
    pub branding_image_url: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SlugQuery {
    #[serde(default)]
    pub slug: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PageList {
    pub pages: Vec<PaymentPageOut>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlugAvailable {
    pub available: bool,
}

/* ── public view DTO ─────────────────────────────────────────────────────── */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPageView {
    pub mode: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub slug: String,
    pub amount_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_amount: Option<i64>,
    pub fields: Vec<PageField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branding_image_url: Option<String>,
    pub business: crate::dto::CheckoutBusiness,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SessionBody {
    /// Required (paise) for a `customer_decided` page; ignored for `fixed`.
    #[serde(default)]
    pub amount: Option<i64>,
    /// Submitted custom field values, key → value.
    #[serde(default)]
    pub fields: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOut {
    pub checkout_url: String,
    pub payment_id: String,
}

/* ── mapper ──────────────────────────────────────────────────────────────── */

fn doc_to_fields(d: &Document) -> Vec<PageField> {
    d.get_array("fields")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_document())
                .map(|f| PageField {
                    key: str_or(f, "key", ""),
                    label: str_or(f, "label", ""),
                    field_type: str_or(f, "type", "text"),
                    required: bool_or(f, "required", false),
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn doc_to_page(d: &Document) -> PaymentPageOut {
    let slug = str_or(d, "slug", "");
    PaymentPageOut {
        id: str_or(d, "pageId", ""),
        mode: str_or(d, "mode", "test"),
        title: str_or(d, "title", ""),
        description: str_opt(d, "description"),
        slug: slug.clone(),
        amount_type: str_or(d, "amountType", "fixed"),
        amount: num_opt_i64(d, "amount"),
        min_amount: num_opt_i64(d, "minAmount"),
        fields: doc_to_fields(d),
        branding_image_url: str_opt(d, "brandingImageUrl"),
        active: bool_or(d, "active", true),
        url: format!("{}/pay/{}", store::app_url(), slug),
        created_at: iso_opt(d, "createdAt").unwrap_or_else(store::now_iso),
    }
}

/* ── validation ──────────────────────────────────────────────────────────── */

/// `^[a-z0-9-]{3,60}$` without pulling in the regex crate.
fn valid_slug(slug: &str) -> bool {
    let len = slug.len();
    (3..=60).contains(&len)
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Validate the custom-field schema: at most 10, each key 1..=40 chars, type in
/// the allowed set. Returns the cleaned fields as BSON ready to insert.
fn validate_fields(fields: &[PageField]) -> Result<Vec<Bson>> {
    if fields.len() > MAX_FIELDS {
        return Err(ApiError::Validation(format!(
            "A payment page supports at most {MAX_FIELDS} custom fields."
        )));
    }
    let mut out = Vec::with_capacity(fields.len());
    for f in fields {
        let key = f.key.trim();
        if key.is_empty() || key.len() > 40 {
            return Err(ApiError::Validation(
                "Each field key must be 1–40 characters.".to_owned(),
            ));
        }
        if !ALLOWED_FIELD_TYPES.contains(&f.field_type.as_str()) {
            return Err(ApiError::Validation(format!(
                "Field type must be one of: {}.",
                ALLOWED_FIELD_TYPES.join(", ")
            )));
        }
        let label = {
            let t = f.label.trim();
            if t.is_empty() { key } else { t }
        };
        out.push(Bson::Document(doc! {
            "key": key.chars().take(40).collect::<String>(),
            "label": label.chars().take(120).collect::<String>(),
            "type": &f.field_type,
            "required": f.required,
        }));
    }
    Ok(out)
}

/// Build a metadata object from submitted field values (string values only),
/// reusing the shared notes limits (≤20 keys, key ≤40, value ≤500).
fn metadata_from_fields(submitted: &Option<Value>) -> Result<Option<Value>> {
    let Some(Value::Object(map)) = submitted else {
        return Ok(None);
    };
    if map.is_empty() {
        return Ok(None);
    }
    let mut out = serde_json::Map::new();
    for (k, v) in map {
        let key: String = k.trim().chars().take(40).collect();
        if key.is_empty() {
            continue;
        }
        // Coerce scalar submissions to strings; reject nested objects/arrays.
        let value = match v {
            Value::String(s) => s.chars().take(500).collect::<String>(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Null => continue,
            _ => {
                return Err(ApiError::BadRequest(
                    "Submitted field values must be strings.".to_owned(),
                ));
            }
        };
        out.insert(key, Value::String(value));
    }
    if out.is_empty() {
        return Ok(None);
    }
    if out.len() > 20 {
        return Err(ApiError::BadRequest(
            "A payment page supports at most 20 submitted fields.".to_owned(),
        ));
    }
    Ok(Some(Value::Object(out)))
}

/* ── store ───────────────────────────────────────────────────────────────── */

async fn get_doc(mongo: &MongoHandle, uid: ObjectId, id: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "pageId": id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.get")))
}

/// Slug uniqueness is enforced across ALL users in this collection (a slug maps
/// to a single public `/pay/<slug>` URL).
async fn slug_taken(mongo: &MongoHandle, slug: &str) -> Result<bool> {
    let found = mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "slug": slug })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.slug")))?;
    Ok(found.is_some())
}

async fn get_active_by_slug(mongo: &MongoHandle, slug: &str) -> Result<Option<Document>> {
    mongo
        .collection::<Document>(COLL)
        .find_one(doc! { "slug": slug, "active": true })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.by_slug")))
}

/* ── dashboard handlers ──────────────────────────────────────────────────── */

pub async fn list_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PageList>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = q.mode.as_deref().unwrap_or(&merchant.mode).to_owned();
    let mut filter = doc! { "userId": uid, "mode": &mode };
    if let Some(b) = q.before.as_deref() {
        filter.insert("createdAt", doc! { "$lt": b });
    }
    let cursor = mongo
        .collection::<Document>(COLL)
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(q.limit.unwrap_or(50).clamp(1, 100))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.list")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.collect")))?;
    Ok(Json(PageList {
        pages: docs.iter().map(doc_to_page).collect(),
    }))
}

pub async fn create_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePageBody>,
) -> Result<Json<PaymentPageOut>> {
    let uid = user_oid(&user)?;
    let merchant = store::get_or_create_merchant(&mongo, uid, DEFAULT_NAME).await?;
    let mode = match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => m.to_owned(),
        _ => merchant.mode.clone(),
    };

    let title: String = body.title.trim().chars().take(140).collect();
    if title.is_empty() {
        return Err(ApiError::Validation("Page title is required.".to_owned()));
    }

    let slug = body.slug.trim().to_lowercase();
    if !valid_slug(&slug) {
        return Err(ApiError::Validation(
            "Slug must be 3–60 chars of lowercase letters, digits, or hyphens.".to_owned(),
        ));
    }
    if slug_taken(&mongo, &slug).await? {
        return Err(ApiError::Conflict(format!("The slug \"{slug}\" is already taken.")));
    }

    let amount_type = body.amount_type.trim();
    let (amount, min_amount) = match amount_type {
        "fixed" => {
            let a = body
                .amount
                .ok_or_else(|| ApiError::Validation("A fixed page requires an amount.".to_owned()))?;
            validate_amount(a)?;
            (Some(a), None)
        }
        "customer_decided" => {
            let min = match body.min_amount {
                Some(m) => {
                    validate_amount(m)?;
                    Some(m)
                }
                None => None,
            };
            (None, min)
        }
        _ => {
            return Err(ApiError::Validation(
                "amountType must be \"fixed\" or \"customer_decided\".".to_owned(),
            ));
        }
    };

    let fields = validate_fields(body.fields.as_deref().unwrap_or(&[]))?;

    let page_id = new_id("page");
    let now = store::now_iso();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "pageId": &page_id,
        "userId": uid,
        "mode": &mode,
        "title": &title,
        "slug": &slug,
        "amountType": amount_type,
        "fields": &fields,
        "active": true,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(desc) = body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("description", desc.chars().take(500).collect::<String>());
    }
    if let Some(a) = amount {
        d.insert("amount", a);
    }
    if let Some(m) = min_amount {
        d.insert("minAmount", m);
    }
    if let Some(img) = body.branding_image_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        d.insert("brandingImageUrl", img.chars().take(1024).collect::<String>());
    }

    mongo
        .collection::<Document>(COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.insert")))?;
    Ok(Json(doc_to_page(&d)))
}

pub async fn get_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PaymentPageOut>> {
    let uid = user_oid(&user)?;
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment page \"{id}\".")))?;
    Ok(Json(doc_to_page(&d)))
}

pub async fn update_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePageBody>,
) -> Result<Json<PaymentPageOut>> {
    let uid = user_oid(&user)?;
    // Load the existing page so amount validation respects its amountType. The
    // slug is immutable after create, so it is never updated here.
    let existing = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment page \"{id}\".")))?;
    let amount_type = str_or(&existing, "amountType", "fixed");

    let mut set = doc! { "updatedAt": store::now_iso() };

    if let Some(title) = body.title.as_deref().map(str::trim) {
        if title.is_empty() {
            return Err(ApiError::Validation("Page title cannot be empty.".to_owned()));
        }
        set.insert("title", title.chars().take(140).collect::<String>());
    }
    if let Some(desc) = body.description {
        let t = desc.trim();
        if t.is_empty() {
            set.insert("description", Bson::Null);
        } else {
            set.insert("description", t.chars().take(500).collect::<String>());
        }
    }
    if let Some(a) = body.amount {
        if amount_type != "fixed" {
            return Err(ApiError::Validation(
                "amount applies only to a fixed page.".to_owned(),
            ));
        }
        validate_amount(a)?;
        set.insert("amount", a);
    }
    if let Some(m) = body.min_amount {
        if amount_type != "customer_decided" {
            return Err(ApiError::Validation(
                "minAmount applies only to a customer-decided page.".to_owned(),
            ));
        }
        validate_amount(m)?;
        set.insert("minAmount", m);
    }
    if let Some(fields) = body.fields.as_ref() {
        set.insert("fields", validate_fields(fields)?);
    }
    if let Some(img) = body.branding_image_url {
        let t = img.trim();
        if t.is_empty() {
            set.insert("brandingImageUrl", Bson::Null);
        } else {
            set.insert("brandingImageUrl", t.chars().take(1024).collect::<String>());
        }
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }

    let res = mongo
        .collection::<Document>(COLL)
        .update_one(doc! { "pageId": &id, "userId": uid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.update")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("No payment page \"{id}\".")));
    }
    let d = get_doc(&mongo, uid, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("No payment page \"{id}\".")))?;
    Ok(Json(doc_to_page(&d)))
}

pub async fn delete_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::dto::Ack>> {
    let uid = user_oid(&user)?;
    let res = mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "pageId": &id, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpay.page.delete")))?;
    if res.deleted_count == 1 {
        Ok(Json(crate::dto::Ack::ok()))
    } else {
        Err(ApiError::NotFound(format!("No payment page \"{id}\".")))
    }
}

/// `GET /payment-pages/slug-available?slug=foo` — collection-wide availability.
pub async fn slug_available_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<SlugQuery>,
) -> Result<Json<SlugAvailable>> {
    let _uid = user_oid(&user)?;
    let slug = q.slug.as_deref().unwrap_or("").trim().to_lowercase();
    if !valid_slug(&slug) {
        return Err(ApiError::Validation(
            "Slug must be 3–60 chars of lowercase letters, digits, or hyphens.".to_owned(),
        ));
    }
    let available = !slug_taken(&mongo, &slug).await?;
    Ok(Json(SlugAvailable { available }))
}

/* ── public handlers (no AuthUser; resolve by slug) ──────────────────────── */

/// `GET /public/pages/{slug}` — render config + branding for an active page.
pub async fn public_view_handler(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPageView>> {
    let slug = slug.trim().to_lowercase();
    let d = get_active_by_slug(&mongo, &slug)
        .await?
        .ok_or_else(|| ApiError::NotFound("Page not found.".to_owned()))?;
    let owner = d
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("page missing userId")))?;
    let business = store::merchant_branding(&mongo, owner).await;
    Ok(Json(PublicPageView {
        mode: str_or(&d, "mode", "test"),
        title: str_or(&d, "title", ""),
        description: str_opt(&d, "description"),
        slug,
        amount_type: str_or(&d, "amountType", "fixed"),
        amount: num_opt_i64(&d, "amount"),
        min_amount: num_opt_i64(&d, "minAmount"),
        fields: doc_to_fields(&d),
        branding_image_url: str_opt(&d, "brandingImageUrl"),
        business,
    }))
}

/// `POST /public/pages/{slug}/session` — create a payment from a page submission.
pub async fn public_session_handler(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Json(body): Json<SessionBody>,
) -> Result<Json<SessionOut>> {
    let slug = slug.trim().to_lowercase();
    let page = get_active_by_slug(&mongo, &slug)
        .await?
        .ok_or_else(|| ApiError::NotFound("Page not found.".to_owned()))?;

    let uid = page
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("page missing userId")))?;
    let mode = str_or(&page, "mode", "test");
    let page_id = str_or(&page, "pageId", "");
    let amount_type = str_or(&page, "amountType", "fixed");
    let title = str_or(&page, "title", "Payment");

    // Resolve the amount: fixed pages use the stored amount; customer-decided
    // pages take it from the submission and enforce the minimum.
    let amount = match amount_type.as_str() {
        "fixed" => num_opt_i64(&page, "amount").ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!("fixed page \"{page_id}\" has no amount"))
        })?,
        "customer_decided" => {
            let a = body.amount.ok_or_else(|| {
                ApiError::BadRequest("Please enter an amount.".to_owned())
            })?;
            validate_amount(a)?;
            if let Some(min) = num_opt_i64(&page, "minAmount") {
                if a < min {
                    return Err(ApiError::BadRequest(format!(
                        "Amount must be at least {min} paise."
                    )));
                }
            }
            a
        }
        _ => {
            return Err(ApiError::Internal(anyhow::anyhow!(
                "page \"{page_id}\" has an unknown amountType"
            )));
        }
    };

    let metadata = metadata_from_fields(&body.fields)?;

    let create = CreatePaymentBody {
        amount,
        currency: None,
        description: Some(title),
        customer: None,
        metadata,
        success_url: None,
        cancel_url: None,
        mode: Some(mode.clone()),
        order_id: None,
        customer_id: None,
        payment_link_id: None,
        payment_page_id: Some(page_id),
        invoice_id: None,
        subscription_id: None,
        qr_code_id: None,
    };
    let payment = store::create_payment(&mongo, uid, &mode, create).await?;

    Ok(Json(SessionOut {
        checkout_url: payment.checkout_url,
        payment_id: payment.id,
    }))
}

/* ── for completeness: a small typed wrapper around submitted values ─────── */

/// Coerce submitted field values into a stable string map (unused internally,
/// exported so callers/tests can reuse the same coercion the session applies).
pub fn coerce_submitted(values: &Value) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    if let Value::Object(map) = values {
        for (k, v) in map {
            let s = match v {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => continue,
            };
            out.insert(k.clone(), s);
        }
    }
    out
}
