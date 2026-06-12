//! HTTP handlers for the online-store surface: storefronts, store products,
//! pricing rules, shipping zones, orders, and abandoned carts.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{Datelike, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use crm_core::{ScopeMode, TenantScope, sabcrm_project_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AddressInput, CreateOrderInput, CreateOrderResponse, CreatePricingRuleInput,
    CreatePricingRuleResponse, CreateShippingZoneInput, CreateShippingZoneResponse,
    CreateStoreProductInput, CreateStoreProductResponse, CreateStorefrontInput,
    CreateStorefrontResponse, DeleteAbandonedCartResponse, DeleteOrderResponse,
    DeletePricingRuleResponse, DeleteShippingZoneResponse, DeleteStoreProductResponse,
    DeleteStorefrontResponse, HomepageBlockInput, ListAbandonedCartsQuery, ListOrdersQuery,
    ListPricingRulesQuery, ListShippingZonesQuery, ListStoreProductsQuery, ListStorefrontsQuery,
    MarkFulfilledInput, MarkPaidInput, MarkRecoveredInput, OrderLineItemInput,
    PricingAppliesInput, PricingConditionInput, ScopeQuery, ShippingMethodInput,
    TrackAbandonedCartInput,
    TrackAbandonedCartResponse, UpdateOrderInput, UpdatePricingRuleInput,
    UpdateShippingZoneInput, UpdateStoreProductInput, UpdateStorefrontInput,
};
use crate::types::{
    Address, CrmStoreAbandonedCart, CrmStoreOrder, CrmStorePricingRule, CrmStoreProduct,
    CrmStoreShippingZone, CrmStorefront, HomepageBlock, OrderLineItem, PricingApplies,
    PricingCondition, ShippingMethod,
};

const STOREFRONTS_COLL: &str = "crm_storefronts";
const PRODUCTS_COLL: &str = "crm_store_products";
const PRICING_RULES_COLL: &str = "crm_store_pricing_rules";
const SHIPPING_ZONES_COLL: &str = "crm_store_shipping_zones";
const ORDERS_COLL: &str = "crm_store_orders";
const ABANDONED_CARTS_COLL: &str = "crm_store_abandoned_carts";

const STOREFRONT_KIND: &str = "storefront";
const PRODUCT_KIND: &str = "store_product";
const PRICING_RULE_KIND: &str = "store_pricing_rule";
const SHIPPING_ZONE_KIND: &str = "store_shipping_zone";
const ORDER_KIND: &str = "store_order";
const ABANDONED_CART_KIND: &str = "store_abandoned_cart";

// ─── Shared helpers ────────────────────────────────────────────────────────

fn ownership_filter(scope: &TenantScope, oid: ObjectId) -> Document {
    let mut filter = scope.filter();
    filter.insert("_id", oid);
    filter
}

/// Resolve the per-request tenant scope from the mount's [`ScopeMode`]:
/// legacy mounts filter by the JWT's `userId`, SabCRM mounts by the
/// caller-supplied (required) `projectId`.
fn resolve_scope(
    mode: ScopeMode,
    user: &AuthUser,
    project_id: Option<&str>,
) -> Result<TenantScope> {
    match mode {
        ScopeMode::User => Ok(TenantScope::User(user_oid(user)?)),
        ScopeMode::Project => Ok(TenantScope::Project(sabcrm_project_oid(project_id)?)),
    }
}

/// `projectId` to stamp on a freshly created document: `Some(...)` only
/// on SabCRM (project) mounts.
fn project_of(scope: &TenantScope) -> Option<ObjectId> {
    match scope {
        TenantScope::Project(p) => Some(*p),
        TenantScope::User(_) => None,
    }
}

fn opt_oid(s: Option<String>) -> Result<Option<ObjectId>> {
    match s {
        None => Ok(None),
        Some(v) if v.trim().is_empty() => Ok(None),
        Some(v) => Ok(Some(oid_from_str(&v)?)),
    }
}

fn store_doc(value: &impl serde::Serialize) -> Document {
    bson::to_document(value).unwrap_or_default()
}

fn homepage_block_from_input(b: HomepageBlockInput) -> HomepageBlock {
    HomepageBlock {
        kind: b.kind,
        config: b.config,
    }
}

fn pricing_condition_from_input(c: PricingConditionInput) -> PricingCondition {
    PricingCondition {
        kind: c.kind,
        value: c.value,
    }
}

fn pricing_applies_from_input(a: PricingAppliesInput) -> Result<PricingApplies> {
    let refs = match a.refs {
        None => None,
        Some(list) => {
            let mut out: Vec<ObjectId> = Vec::with_capacity(list.len());
            for s in list {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    continue;
                }
                out.push(oid_from_str(trimmed)?);
            }
            if out.is_empty() { None } else { Some(out) }
        }
    };
    Ok(PricingApplies { kind: a.kind, refs })
}

fn shipping_method_from_input(m: ShippingMethodInput) -> Result<ShippingMethod> {
    if m.name.trim().is_empty() {
        return Err(ApiError::Validation(
            "shipping method name is required".to_owned(),
        ));
    }
    match m.kind.as_str() {
        "flat" | "weight_based" | "free_above" => {}
        _ => {
            return Err(ApiError::Validation(
                "shipping method kind must be one of flat|weight_based|free_above".to_owned(),
            ));
        }
    }
    Ok(ShippingMethod {
        name: m.name.trim().to_string(),
        kind: m.kind,
        rate: m.rate,
        free_above_subtotal: m.free_above_subtotal,
    })
}

fn address_from_input(a: AddressInput) -> Result<Address> {
    if a.line1.trim().is_empty()
        || a.city.trim().is_empty()
        || a.country.trim().is_empty()
        || a.postal_code.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "address requires line1, city, postalCode, and country".to_owned(),
        ));
    }
    Ok(Address {
        line1: a.line1.trim().to_string(),
        line2: a.line2.map(|v| v.trim().to_string()).filter(|s| !s.is_empty()),
        city: a.city.trim().to_string(),
        state: a.state.trim().to_string(),
        postal_code: a.postal_code.trim().to_string(),
        country: a.country.trim().to_uppercase(),
    })
}

fn order_line_from_input(i: OrderLineItemInput) -> Result<OrderLineItem> {
    if i.title.trim().is_empty() {
        return Err(ApiError::Validation(
            "line item title is required".to_owned(),
        ));
    }
    if i.quantity <= 0.0 {
        return Err(ApiError::Validation(
            "line item quantity must be positive".to_owned(),
        ));
    }
    let product_id = oid_from_str(&i.product_id)?;
    let total = i.total.unwrap_or(i.quantity * i.price);
    Ok(OrderLineItem {
        product_id,
        sku: i.sku,
        title: i.title.trim().to_string(),
        quantity: i.quantity,
        price: i.price,
        total,
    })
}

/// Format `ORD-YYYYMMDD-NNNN` from today plus a 1-based per-day counter.
pub(crate) fn format_order_number(now: chrono::DateTime<Utc>, seq: u64) -> String {
    format!(
        "ORD-{:04}{:02}{:02}-{:04}",
        now.year(),
        now.month(),
        now.day(),
        seq
    )
}

fn day_window(now: chrono::DateTime<Utc>) -> (BsonDateTime, BsonDateTime) {
    let start_naive = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .expect("valid midnight");
    let start = chrono::DateTime::<Utc>::from_naive_utc_and_offset(start_naive, Utc);
    let end = start + chrono::Duration::days(1);
    (
        BsonDateTime::from_chrono(start),
        BsonDateTime::from_chrono(end),
    )
}

async fn next_order_number(
    mongo: &MongoHandle,
    scope: &TenantScope,
    now: chrono::DateTime<Utc>,
) -> Result<String> {
    let (start, end) = day_window(now);
    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);
    let mut day_filter = scope.filter();
    day_filter.insert("createdAt", doc! { "$gte": start, "$lt": end });
    let count = coll
        .count_documents(day_filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.count_day"))
        })?;
    Ok(format_order_number(now, count + 1))
}

// ─── Pure helpers (re-exported from lib.rs) ────────────────────────────────

/// Pure cart snapshot used by [`select_applicable_rules`]. Mirrors only the
/// shape the rule engine actually needs to inspect — keeps the helper
/// callable from background jobs and tests without dragging in a full Mongo
/// `Order` document.
#[derive(Debug, Clone, Default)]
pub struct CartSnapshot {
    pub subtotal: f64,
    pub product_ids: Vec<ObjectId>,
    pub category_ids: Vec<ObjectId>,
    pub tags: Vec<String>,
}

/// Select pricing rules that apply to `cart` at `now`.
///
/// Sorting: by `priority` (descending — higher fires first); ties broken by
/// rule `id` for deterministic ordering. Rules are then walked in priority
/// order and applied **non-overlappingly**: once a rule's `applies` scope
/// touches a product / category, subsequent rules targeting the *same* scope
/// are skipped. Whole-cart (`applies.kind == "all"`) rules consume all
/// remaining capacity, so at most one `"all"` rule wins.
///
/// Returns the rules in evaluation order — callers apply them to the cart
/// total themselves (since discount math depends on rule `kind`).
pub fn select_applicable_rules(
    cart: &CartSnapshot,
    now: chrono::DateTime<Utc>,
    rules: &[CrmStorePricingRule],
) -> Vec<CrmStorePricingRule> {
    let mut candidates: Vec<&CrmStorePricingRule> = rules
        .iter()
        .filter(|r| r.status == "active")
        .filter(|r| {
            r.starts_at
                .map(|s| s.to_chrono() <= now)
                .unwrap_or(true)
                && r.ends_at.map(|e| e.to_chrono() >= now).unwrap_or(true)
        })
        .filter(|r| conditions_match(&r.conditions, cart))
        .collect();

    // Higher priority first; tie-break on _id for stable order.
    candidates.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| a.id.cmp(&b.id))
    });

    let mut chosen: Vec<CrmStorePricingRule> = Vec::new();
    let mut all_taken = false;
    let mut taken_products: Vec<ObjectId> = Vec::new();
    let mut taken_categories: Vec<ObjectId> = Vec::new();

    for r in candidates {
        match r.applies.kind.as_str() {
            "all" => {
                if all_taken {
                    continue;
                }
                all_taken = true;
                chosen.push(r.clone());
            }
            "products" => {
                if all_taken {
                    continue;
                }
                let refs = r.applies.refs.as_deref().unwrap_or(&[]);
                if refs.iter().any(|p| taken_products.contains(p)) {
                    continue;
                }
                taken_products.extend(refs.iter().copied());
                chosen.push(r.clone());
            }
            "categories" => {
                if all_taken {
                    continue;
                }
                let refs = r.applies.refs.as_deref().unwrap_or(&[]);
                if refs.iter().any(|c| taken_categories.contains(c)) {
                    continue;
                }
                taken_categories.extend(refs.iter().copied());
                chosen.push(r.clone());
            }
            _ => {}
        }
    }
    chosen
}

fn conditions_match(conds: &[PricingCondition], cart: &CartSnapshot) -> bool {
    for c in conds {
        match c.kind.as_str() {
            "min_subtotal" => {
                let threshold = c.value.as_f64().unwrap_or(0.0);
                if cart.subtotal < threshold {
                    return false;
                }
            }
            "product_ids" => {
                let arr = match c.value.as_array() {
                    Some(a) => a,
                    None => return false,
                };
                let want: Vec<ObjectId> = arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| ObjectId::parse_str(s).ok())
                    .collect();
                if !want.iter().any(|p| cart.product_ids.contains(p)) {
                    return false;
                }
            }
            "category_ids" => {
                let arr = match c.value.as_array() {
                    Some(a) => a,
                    None => return false,
                };
                let want: Vec<ObjectId> = arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| ObjectId::parse_str(s).ok())
                    .collect();
                if !want.iter().any(|c| cart.category_ids.contains(c)) {
                    return false;
                }
            }
            "tag" => {
                let tag = match c.value.as_str() {
                    Some(s) => s.to_string(),
                    None => return false,
                };
                if !cart.tags.contains(&tag) {
                    return false;
                }
            }
            _ => {}
        }
    }
    true
}

/// Compute shipping cost for `zone` at the given `subtotal` and `weight` (kg).
///
/// Resolution order inside a zone:
///
/// 1. If any `"free_above"` method has `freeAboveSubtotal <= subtotal`, return
///    `0.0` (free shipping wins).
/// 2. Otherwise, return the cheapest of the remaining flat / weight-based
///    methods (`rate` for flat, `rate * weight` for weight-based).
///
/// Returns `None` when no method can be priced (empty `methods`, or every
/// method is `free_above` with a threshold above `subtotal` and no
/// alternative).
pub fn compute_shipping(
    zone: &CrmStoreShippingZone,
    subtotal: f64,
    weight: f64,
) -> Option<f64> {
    let free_unlocked = zone.methods.iter().any(|m| {
        m.kind == "free_above"
            && m.free_above_subtotal
                .map(|t| subtotal >= t)
                .unwrap_or(false)
    });
    if free_unlocked {
        return Some(0.0);
    }
    let mut cheapest: Option<f64> = None;
    for m in &zone.methods {
        let cost = match m.kind.as_str() {
            "flat" => Some(m.rate),
            "weight_based" => Some(m.rate * weight),
            "free_above" => None, // threshold not met, ignore
            _ => None,
        };
        if let Some(c) = cost
            && cheapest.map(|best| c < best).unwrap_or(true)
        {
            cheapest = Some(c);
        }
    }
    cheapest
}

// ─── Storefronts ───────────────────────────────────────────────────────────

pub(crate) fn storefront_list_filter(scope: &TenantScope, status: Option<&str>) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "published" => {
            filter.insert("status", "published");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn normalize_slug(raw: &str) -> String {
    raw.trim().to_lowercase()
}

fn validate_slug(slug: &str) -> Result<()> {
    if slug.is_empty() {
        return Err(ApiError::Validation("slug is required".to_owned()));
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(ApiError::Validation(
            "slug may only contain a-z, 0-9, '-', and '_'".to_owned(),
        ));
    }
    Ok(())
}

async fn ensure_slug_unique(
    mongo: &MongoHandle,
    scope: &TenantScope,
    slug: &str,
    excluding: Option<ObjectId>,
) -> Result<()> {
    let mut filter = scope.filter();
    filter.insert("slug", slug);
    if let Some(oid) = excluding {
        filter.insert("_id", doc! { "$ne": oid });
    }
    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);
    let existing = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.slug_check"))
    })?;
    if existing.is_some() {
        return Err(ApiError::Validation(format!(
            "slug '{slug}' is already in use",
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStorefrontsResponse {
    pub items: Vec<CrmStorefront>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_storefronts(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListStorefrontsQuery>,
) -> Result<Json<ListStorefrontsResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let mut filter = storefront_list_filter(&scope, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "slug", "domain"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.find"))
    })?;
    let mut rows: Vec<CrmStorefront> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListStorefrontsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %storefront_id))]
pub async fn get_storefront(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStorefront>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&storefront_id)?;
    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_storefront(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStorefrontInput>,
) -> Result<Json<CreateStorefrontResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required".to_owned()));
    }
    let slug = normalize_slug(&input.slug);
    validate_slug(&slug)?;
    ensure_slug_unique(&mongo, &scope, &slug, None).await?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmStorefront {
        id: None,
        user_id,
        project_id: project_of(&scope),
        name: input.name.trim().to_string(),
        slug,
        domain: input
            .domain
            .map(|v| v.trim().to_string())
            .filter(|s| !s.is_empty()),
        currency: input.currency.trim().to_uppercase(),
        theme_id: input.theme_id,
        logo_url: input.logo_url,
        homepage_blocks: input
            .homepage_blocks
            .into_iter()
            .map(homepage_block_from_input)
            .collect(),
        status: "draft".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, STOREFRONT_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateStorefrontResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %storefront_id))]
pub async fn update_storefront(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateStorefrontInput>,
) -> Result<Json<CrmStorefront>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&storefront_id)?;
    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.slug {
        let slug = normalize_slug(&v);
        validate_slug(&slug)?;
        ensure_slug_unique(&mongo, &scope, &slug, Some(oid)).await?;
        set.insert("slug", slug);
    }
    if let Some(v) = patch.domain {
        set.insert("domain", v.trim());
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v.trim().to_uppercase());
    }
    if let Some(v) = patch.theme_id {
        set.insert("themeId", v);
    }
    if let Some(v) = patch.logo_url {
        set.insert("logoUrl", v);
    }
    if let Some(v) = patch.homepage_blocks {
        let blocks: Vec<HomepageBlock> = v.into_iter().map(homepage_block_from_input).collect();
        let arr: Vec<Bson> = blocks
            .iter()
            .filter_map(|b| bson::to_document(b).ok().map(Bson::Document))
            .collect();
        set.insert("homepageBlocks", Bson::Array(arr));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("storefront".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("storefront".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        STOREFRONT_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %storefront_id))]
pub async fn archive_storefront(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(storefront_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteStorefrontResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&storefront_id)?;

    let coll = mongo.collection::<CrmStorefront>(STOREFRONTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_storefronts.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("storefront".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, STOREFRONT_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteStorefrontResponse { deleted: true }))
}

// ─── Store products ────────────────────────────────────────────────────────

pub(crate) fn product_list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    storefront_id: Option<ObjectId>,
    category_id: Option<ObjectId>,
) -> Document {
    let mut filter = scope.filter();
    // Default: only `active` products show. Distinct from other list filters
    // — store catalogues don't want drafts polluting the customer UI.
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", "active");
        }
    }
    if let Some(s) = storefront_id {
        filter.insert("storefrontId", s);
    }
    if let Some(c) = category_id {
        filter.insert("categoryIds", c);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStoreProductsResponse {
    pub items: Vec<CrmStoreProduct>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_store_products(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListStoreProductsQuery>,
) -> Result<Json<ListStoreProductsResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let storefront = opt_oid(q.storefront_id.clone())?;
    let category = opt_oid(q.category_id.clone())?;
    let mut filter =
        product_list_filter(&scope, q.status.as_deref(), storefront, category);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "sku", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStoreProduct>(PRODUCTS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.find"))
    })?;
    let mut rows: Vec<CrmStoreProduct> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListStoreProductsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn get_store_product(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStoreProduct>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<CrmStoreProduct>(PRODUCTS_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_product".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_store_product(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStoreProductInput>,
) -> Result<Json<CreateStoreProductResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.sku.trim().is_empty() {
        return Err(ApiError::Validation("sku is required".to_owned()));
    }

    let storefront_oid = oid_from_str(&input.storefront_id)?;
    let item_oid = oid_from_str(&input.item_id)?;
    let category_ids: Vec<ObjectId> = input
        .category_ids
        .into_iter()
        .filter(|s| !s.trim().is_empty())
        .map(|s| oid_from_str(&s))
        .collect::<Result<Vec<_>>>()?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmStoreProduct {
        id: None,
        user_id,
        project_id: project_of(&scope),
        storefront_id: storefront_oid,
        item_id: item_oid,
        sku: input.sku.trim().to_string(),
        title: input.title.trim().to_string(),
        description: input.description,
        images: input.images,
        price: input.price,
        compare_at_price: input.compare_at_price,
        currency: input.currency.trim().to_uppercase(),
        inventory_tracked: input.inventory_tracked,
        stock_status: input
            .stock_status
            .unwrap_or_else(|| "in_stock".to_owned()),
        category_ids,
        tags: input.tags,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmStoreProduct>(PRODUCTS_COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, PRODUCT_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateStoreProductResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn update_store_product(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateStoreProductInput>,
) -> Result<Json<CrmStoreProduct>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&product_id)?;
    let coll = mongo.collection::<CrmStoreProduct>(PRODUCTS_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_product".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.sku {
        set.insert("sku", v.trim());
    }
    if let Some(v) = patch.title {
        set.insert("title", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.images {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("images", Bson::Array(arr));
    }
    if let Some(v) = patch.price {
        set.insert("price", v);
    }
    if let Some(v) = patch.compare_at_price {
        set.insert("compareAtPrice", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v.trim().to_uppercase());
    }
    if let Some(v) = patch.inventory_tracked {
        set.insert("inventoryTracked", v);
    }
    if let Some(v) = patch.stock_status {
        set.insert("stockStatus", v);
    }
    if let Some(v) = patch.category_ids {
        let oids: Vec<ObjectId> = v
            .into_iter()
            .filter(|s| !s.trim().is_empty())
            .map(|s| oid_from_str(&s))
            .collect::<Result<Vec<_>>>()?;
        let arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
        set.insert("categoryIds", Bson::Array(arr));
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", Bson::Array(arr));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_product".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_product".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        PRODUCT_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %product_id))]
pub async fn archive_store_product(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(product_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteStoreProductResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&product_id)?;

    let coll = mongo.collection::<CrmStoreProduct>(PRODUCTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_products.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_product".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, PRODUCT_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteStoreProductResponse { deleted: true }))
}

// ─── Pricing rules ─────────────────────────────────────────────────────────

pub(crate) fn pricing_rule_list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    storefront_id: Option<ObjectId>,
    kind: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = storefront_id {
        filter.insert("storefrontId", s);
    }
    if let Some(k) = kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPricingRulesResponse {
    pub items: Vec<CrmStorePricingRule>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pricing_rules(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListPricingRulesQuery>,
) -> Result<Json<ListPricingRulesResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let storefront = opt_oid(q.storefront_id.clone())?;
    let mut filter = pricing_rule_list_filter(
        &scope,
        q.status.as_deref(),
        storefront,
        q.kind.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "priority": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStorePricingRule>(PRICING_RULES_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_pricing_rules.find"))
    })?;
    let mut rows: Vec<CrmStorePricingRule> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_pricing_rules.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListPricingRulesResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn get_pricing_rule(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStorePricingRule>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<CrmStorePricingRule>(PRICING_RULES_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_pricing_rules.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_pricing_rule".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_pricing_rule(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePricingRuleInput>,
) -> Result<Json<CreatePricingRuleResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    match input.kind.as_str() {
        "percent_off" | "fixed_off" | "buy_x_get_y" | "bundle" => {}
        _ => {
            return Err(ApiError::Validation(
                "kind must be percent_off|fixed_off|buy_x_get_y|bundle".to_owned(),
            ));
        }
    }
    let storefront_oid = oid_from_str(&input.storefront_id)?;
    let applies = pricing_applies_from_input(input.applies)?;
    let conditions: Vec<PricingCondition> = input
        .conditions
        .into_iter()
        .map(pricing_condition_from_input)
        .collect();

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmStorePricingRule {
        id: None,
        user_id,
        project_id: project_of(&scope),
        storefront_id: storefront_oid,
        name: input.name.trim().to_string(),
        kind: input.kind,
        conditions,
        applies,
        value: input.value,
        priority: input.priority.unwrap_or(0),
        starts_at: input.starts_at.map(BsonDateTime::from_chrono),
        ends_at: input.ends_at.map(BsonDateTime::from_chrono),
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmStorePricingRule>(PRICING_RULES_COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_pricing_rules.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, PRICING_RULE_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreatePricingRuleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn update_pricing_rule(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdatePricingRuleInput>,
) -> Result<Json<CrmStorePricingRule>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<CrmStorePricingRule>(PRICING_RULES_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_pricing_rules.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_pricing_rule".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.kind {
        set.insert("kind", v);
    }
    if let Some(v) = patch.conditions {
        let conds: Vec<PricingCondition> =
            v.into_iter().map(pricing_condition_from_input).collect();
        let arr: Vec<Bson> = conds
            .iter()
            .filter_map(|c| bson::to_document(c).ok().map(Bson::Document))
            .collect();
        set.insert("conditions", Bson::Array(arr));
    }
    if let Some(v) = patch.applies {
        let applies = pricing_applies_from_input(v)?;
        if let Ok(doc) = bson::to_document(&applies) {
            set.insert("applies", doc);
        }
    }
    if let Some(v) = patch.value {
        set.insert("value", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.starts_at {
        set.insert("startsAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.ends_at {
        set.insert("endsAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_pricing_rules.update"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_pricing_rule".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_pricing_rules.refetch"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_pricing_rule".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        PRICING_RULE_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn archive_pricing_rule(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeletePricingRuleResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&rule_id)?;

    let coll = mongo.collection::<CrmStorePricingRule>(PRICING_RULES_COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_pricing_rules.archive"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_pricing_rule".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, PRICING_RULE_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeletePricingRuleResponse { deleted: true }))
}

// ─── Shipping zones ────────────────────────────────────────────────────────

pub(crate) fn shipping_zone_list_filter(
    scope: &TenantScope,
    status: Option<&str>,
    storefront_id: Option<ObjectId>,
    country: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = storefront_id {
        filter.insert("storefrontId", s);
    }
    if let Some(c) = country.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("countries", c.to_uppercase());
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListShippingZonesResponse {
    pub items: Vec<CrmStoreShippingZone>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_shipping_zones(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListShippingZonesQuery>,
) -> Result<Json<ListShippingZonesResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let storefront = opt_oid(q.storefront_id.clone())?;
    let mut filter = shipping_zone_list_filter(
        &scope,
        q.status.as_deref(),
        storefront,
        q.country.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStoreShippingZone>(SHIPPING_ZONES_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_shipping_zones.find"),
        )
    })?;
    let mut rows: Vec<CrmStoreShippingZone> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_shipping_zones.collect"),
        )
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListShippingZonesResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %zone_id))]
pub async fn get_shipping_zone(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(zone_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStoreShippingZone>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&zone_id)?;
    let coll = mongo.collection::<CrmStoreShippingZone>(SHIPPING_ZONES_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_shipping_zones.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_shipping_zone".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_shipping_zone(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShippingZoneInput>,
) -> Result<Json<CreateShippingZoneResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let storefront_oid = oid_from_str(&input.storefront_id)?;
    let mut methods: Vec<ShippingMethod> = Vec::with_capacity(input.methods.len());
    for m in input.methods {
        methods.push(shipping_method_from_input(m)?);
    }
    let countries: Vec<String> = input
        .countries
        .into_iter()
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty())
        .collect();

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmStoreShippingZone {
        id: None,
        user_id,
        project_id: project_of(&scope),
        storefront_id: storefront_oid,
        name: input.name.trim().to_string(),
        countries,
        states: input.states,
        methods,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmStoreShippingZone>(SHIPPING_ZONES_COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_shipping_zones.insert"),
        )
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, SHIPPING_ZONE_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateShippingZoneResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %zone_id))]
pub async fn update_shipping_zone(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(zone_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateShippingZoneInput>,
) -> Result<Json<CrmStoreShippingZone>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&zone_id)?;
    let coll = mongo.collection::<CrmStoreShippingZone>(SHIPPING_ZONES_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_shipping_zones.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_shipping_zone".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.countries {
        let arr: Vec<Bson> = v
            .into_iter()
            .map(|c| Bson::String(c.trim().to_uppercase()))
            .collect();
        set.insert("countries", Bson::Array(arr));
    }
    if let Some(v) = patch.states {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("states", Bson::Array(arr));
    }
    if let Some(v) = patch.methods {
        let mut methods: Vec<ShippingMethod> = Vec::with_capacity(v.len());
        for m in v {
            methods.push(shipping_method_from_input(m)?);
        }
        let arr: Vec<Bson> = methods
            .iter()
            .filter_map(|m| bson::to_document(m).ok().map(Bson::Document))
            .collect();
        set.insert("methods", Bson::Array(arr));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_shipping_zones.update"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_shipping_zone".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_shipping_zones.refetch"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_shipping_zone".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        SHIPPING_ZONE_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %zone_id))]
pub async fn archive_shipping_zone(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(zone_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteShippingZoneResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&zone_id)?;

    let coll = mongo.collection::<CrmStoreShippingZone>(SHIPPING_ZONES_COLL);
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_shipping_zones.archive"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_shipping_zone".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, SHIPPING_ZONE_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteShippingZoneResponse { deleted: true }))
}

// ─── Orders ────────────────────────────────────────────────────────────────

pub(crate) fn order_list_filter(
    scope: &TenantScope,
    storefront_id: Option<ObjectId>,
    payment_status: Option<&str>,
    fulfillment_status: Option<&str>,
    customer_email: Option<&str>,
) -> Document {
    let mut filter = scope.filter();
    if let Some(s) = storefront_id {
        filter.insert("storefrontId", s);
    }
    if let Some(p) = payment_status.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("paymentStatus", p);
    }
    if let Some(f) = fulfillment_status.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("fulfillmentStatus", f);
    }
    if let Some(e) = customer_email.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("customerEmail", e.to_lowercase());
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListOrdersResponse {
    pub items: Vec<CrmStoreOrder>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_orders(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListOrdersQuery>,
) -> Result<Json<ListOrdersResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let storefront = opt_oid(q.storefront_id.clone())?;
    let mut filter = order_list_filter(
        &scope,
        storefront,
        q.payment_status.as_deref(),
        q.fulfillment_status.as_deref(),
        q.customer_email.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["orderNumber", "customerEmail", "customerName"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "placedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.find"))
    })?;
    let mut rows: Vec<CrmStoreOrder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListOrdersResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn get_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStoreOrder>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOrderInput>,
) -> Result<Json<CreateOrderResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.line_items.is_empty() {
        return Err(ApiError::Validation(
            "at least one line item is required".to_owned(),
        ));
    }
    if input.customer_email.trim().is_empty() {
        return Err(ApiError::Validation(
            "customerEmail is required".to_owned(),
        ));
    }
    if input.customer_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "customerName is required".to_owned(),
        ));
    }

    let storefront_oid = oid_from_str(&input.storefront_id)?;
    let shipping = address_from_input(input.shipping_address)?;
    let billing = match input.billing_address {
        None => None,
        Some(b) => Some(address_from_input(b)?),
    };

    let mut items: Vec<OrderLineItem> = Vec::with_capacity(input.line_items.len());
    for li in input.line_items {
        items.push(order_line_from_input(li)?);
    }

    let subtotal: f64 = items.iter().map(|i| i.total).sum();
    let discount = input.discount.unwrap_or(0.0);
    let shipping_total = input.shipping_total.unwrap_or(0.0);
    let tax_total = input.tax_total.unwrap_or(0.0);
    let total = subtotal - discount + shipping_total + tax_total;

    let now_chrono = Utc::now();
    let now = BsonDateTime::from_chrono(now_chrono);
    let order_number = next_order_number(&mongo, &scope, now_chrono).await?;

    let mut entity = CrmStoreOrder {
        id: None,
        user_id,
        project_id: project_of(&scope),
        storefront_id: storefront_oid,
        order_number,
        customer_email: input.customer_email.trim().to_lowercase(),
        customer_name: input.customer_name.trim().to_string(),
        customer_phone: input.customer_phone,
        shipping_address: shipping,
        billing_address: billing,
        line_items: items,
        subtotal,
        discount: input.discount,
        shipping_total,
        tax_total,
        total,
        currency: input.currency.trim().to_uppercase(),
        payment_status: "pending".to_owned(),
        payment_method: input.payment_method.trim().to_string(),
        payment_ref: input.payment_ref,
        fulfillment_status: "unfulfilled".to_owned(),
        placed_at: now,
        linked_invoice_id: None,
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, ORDER_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateOrderResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

/// Status transitions only — no line-item / address mutation post-placement.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn update_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(patch): Json<UpdateOrderInput>,
) -> Result<Json<CrmStoreOrder>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.payment_status {
        validate_payment_status(&v)?;
        set.insert("paymentStatus", v);
    }
    if let Some(v) = patch.fulfillment_status {
        validate_fulfillment_status(&v)?;
        set.insert("fulfillmentStatus", v);
    }
    if let Some(v) = patch.payment_ref {
        set.insert("paymentRef", v);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_order".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ORDER_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

pub(crate) fn validate_payment_status(s: &str) -> Result<()> {
    match s {
        "pending" | "paid" | "failed" | "refunded" => Ok(()),
        _ => Err(ApiError::Validation(
            "paymentStatus must be pending|paid|failed|refunded".to_owned(),
        )),
    }
}

pub(crate) fn validate_fulfillment_status(s: &str) -> Result<()> {
    match s {
        "unfulfilled" | "partial" | "fulfilled" | "cancelled" => Ok(()),
        _ => Err(ApiError::Validation(
            "fulfillmentStatus must be unfulfilled|partial|fulfilled|cancelled".to_owned(),
        )),
    }
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn mark_order_paid(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(input): Json<MarkPaidInput>,
) -> Result<Json<CrmStoreOrder>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    if before.payment_status == "paid" {
        return Err(ApiError::Validation(
            "order is already paid".to_owned(),
        ));
    }
    if before.payment_status == "refunded" {
        return Err(ApiError::Validation(
            "cannot mark a refunded order paid".to_owned(),
        ));
    }

    let mut set = doc! {
        "paymentStatus": "paid",
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(r) = input.payment_ref {
        set.insert("paymentRef", r);
    }

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.mark_paid"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_order".to_owned()));
    }

    // TODO(crm-store): when marking paid, optionally create a linked
    // `crm_invoices` row and write its ObjectId to `linkedInvoiceId`. Cross-
    // crate coupling is intentionally deferred — tracked in a follow-up PR.

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ORDER_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn mark_order_fulfilled(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(input): Json<MarkFulfilledInput>,
) -> Result<Json<CrmStoreOrder>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);

    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    let target = input.status.unwrap_or_else(|| "fulfilled".to_owned());
    if target != "fulfilled" && target != "partial" {
        return Err(ApiError::Validation(
            "status must be fulfilled|partial".to_owned(),
        ));
    }
    if before.fulfillment_status == "cancelled" {
        return Err(ApiError::Validation(
            "cancelled orders cannot be fulfilled".to_owned(),
        ));
    }

    let set = doc! {
        "fulfillmentStatus": &target,
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };

    let result = coll
        .update_one(ownership_filter(&scope, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_orders.mark_fulfilled"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_order".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("store_order".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ORDER_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn archive_order(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteOrderResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&order_id)?;

    let coll = mongo.collection::<CrmStoreOrder>(ORDERS_COLL);
    // Orders archive by flipping fulfillment to "cancelled" — orders never
    // hard-delete, audit trail must survive.
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "fulfillmentStatus": "cancelled",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_store_orders.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_order".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ORDER_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteOrderResponse { deleted: true }))
}

// ─── Abandoned carts ───────────────────────────────────────────────────────

pub(crate) fn abandoned_cart_list_filter(
    scope: &TenantScope,
    storefront_id: Option<ObjectId>,
    recovered: Option<bool>,
) -> Document {
    let mut filter = scope.filter();
    if let Some(s) = storefront_id {
        filter.insert("storefrontId", s);
    }
    if let Some(r) = recovered {
        filter.insert("recovered", r);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAbandonedCartsResponse {
    pub items: Vec<CrmStoreAbandonedCart>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_abandoned_carts(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListAbandonedCartsQuery>,
) -> Result<Json<ListAbandonedCartsResponse>> {
    let scope = resolve_scope(mode, &user, q.project_id.as_deref())?;
    let storefront = opt_oid(q.storefront_id.clone())?;
    let mut filter = abandoned_cart_list_filter(&scope, storefront, q.recovered);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["customerEmail", "customerName"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "lastInteractionAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmStoreAbandonedCart>(ABANDONED_CARTS_COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_abandoned_carts.find"),
        )
    })?;
    let mut rows: Vec<CrmStoreAbandonedCart> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_abandoned_carts.collect"),
        )
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListAbandonedCartsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cart_id))]
pub async fn get_abandoned_cart(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(cart_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<CrmStoreAbandonedCart>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&cart_id)?;
    let coll = mongo.collection::<CrmStoreAbandonedCart>(ABANDONED_CARTS_COLL);
    let row = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_abandoned_cart".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn track_abandoned_cart(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Json(input): Json<TrackAbandonedCartInput>,
) -> Result<Json<TrackAbandonedCartResponse>> {
    let scope = resolve_scope(mode, &user, input.project_id.as_deref())?;
    // `userId` is always stamped from the JWT (audit trail + entity
    // field); `projectId` is stamped only on SabCRM (project) mounts.
    let user_id = user_oid(&user)?;
    if input.customer_email.trim().is_empty() {
        return Err(ApiError::Validation(
            "customerEmail is required".to_owned(),
        ));
    }
    let storefront_oid = oid_from_str(&input.storefront_id)?;
    let email = input.customer_email.trim().to_lowercase();

    let mut items: Vec<OrderLineItem> = Vec::with_capacity(input.line_items.len());
    for li in input.line_items {
        items.push(order_line_from_input(li)?);
    }
    let subtotal = input
        .subtotal
        .unwrap_or_else(|| items.iter().map(|i| i.total).sum());

    let coll = mongo.collection::<CrmStoreAbandonedCart>(ABANDONED_CARTS_COLL);
    let mut filter = scope.filter();
    filter.insert("storefrontId", storefront_oid);
    filter.insert("customerEmail", &email);

    let existing = coll.find_one(filter.clone()).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_abandoned_carts.find_one"),
        )
    })?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let line_items_doc: Vec<Bson> = items
        .iter()
        .filter_map(|i| bson::to_document(i).ok().map(Bson::Document))
        .collect();

    if let Some(prev) = existing {
        let mut set = doc! {
            "lineItems": Bson::Array(line_items_doc),
            "subtotal": subtotal,
            "currency": input.currency.trim().to_uppercase(),
            "lastInteractionAt": now,
            "updatedAt": now,
        };
        if let Some(name) = input.customer_name {
            set.insert("customerName", name);
        }
        let prev_id = prev
            .id
            .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("abandoned cart missing _id")))?;
        coll.update_one(
            ownership_filter(&scope, prev_id),
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.update"),
            )
        })?;

        let after = coll
            .find_one(ownership_filter(&scope, prev_id))
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("crm_store_abandoned_carts.refetch"),
                )
            })?
            .ok_or_else(|| ApiError::NotFound("store_abandoned_cart".to_owned()))?;

        if let Some(event) = audit_for_update(
            &user,
            ABANDONED_CART_KIND,
            prev_id,
            Some(store_doc(&prev)),
            Some(store_doc(&after)),
        ) {
            write_audit(&mongo, event).await;
        }

        return Ok(Json(TrackAbandonedCartResponse {
            id: prev_id.to_hex(),
            entity: after,
            created: false,
        }));
    }

    let mut entity = CrmStoreAbandonedCart {
        id: None,
        user_id,
        project_id: project_of(&scope),
        storefront_id: storefront_oid,
        customer_email: email,
        customer_name: input.customer_name,
        line_items: items,
        subtotal,
        currency: input.currency.trim().to_uppercase(),
        last_interaction_at: now,
        recovery_email_sent_at: None,
        recovered: Some(false),
        recovered_order_id: None,
        created_at: now,
        updated_at: None,
    };

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("crm_store_abandoned_carts.insert"),
        )
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, ABANDONED_CART_KIND, new_id, Some(store_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(TrackAbandonedCartResponse {
        id: new_id.to_hex(),
        entity,
        created: true,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cart_id))]
pub async fn mark_cart_recovered(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(cart_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
    Json(input): Json<MarkRecoveredInput>,
) -> Result<Json<CrmStoreAbandonedCart>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&cart_id)?;
    let order_oid = oid_from_str(&input.recovered_order_id)?;

    let coll = mongo.collection::<CrmStoreAbandonedCart>(ABANDONED_CARTS_COLL);
    let before = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_abandoned_cart".to_owned()))?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            ownership_filter(&scope, oid),
            doc! { "$set": {
                "recovered": true,
                "recoveredOrderId": order_oid,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.recover"),
            )
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("store_abandoned_cart".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.refetch"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("store_abandoned_cart".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ABANDONED_CART_KIND,
        oid,
        Some(store_doc(&before)),
        Some(store_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cart_id))]
pub async fn delete_abandoned_cart(
    user: AuthUser,
    Extension(mode): Extension<ScopeMode>,
    State(mongo): State<MongoHandle>,
    Path(cart_id): Path<String>,
    Query(sq): Query<ScopeQuery>,
) -> Result<Json<DeleteAbandonedCartResponse>> {
    let scope = resolve_scope(mode, &user, sq.project_id.as_deref())?;
    let oid = oid_from_str(&cart_id)?;

    let coll = mongo.collection::<CrmStoreAbandonedCart>(ABANDONED_CARTS_COLL);
    let result = coll
        .delete_one(ownership_filter(&scope, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_store_abandoned_carts.delete"),
            )
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("store_abandoned_cart".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ABANDONED_CART_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteAbandonedCartResponse { deleted: true }))
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn rule(
        priority: i32,
        kind_applies: &str,
        refs: Option<Vec<ObjectId>>,
        value: f64,
    ) -> CrmStorePricingRule {
        let now = BsonDateTime::from_chrono(Utc::now());
        CrmStorePricingRule {
            id: Some(ObjectId::new()),
            user_id: ObjectId::new(),
            project_id: None,
            storefront_id: ObjectId::new(),
            name: format!("rule-{priority}"),
            kind: "percent_off".to_owned(),
            conditions: vec![],
            applies: PricingApplies {
                kind: kind_applies.to_owned(),
                refs,
            },
            value,
            priority,
            starts_at: None,
            ends_at: None,
            status: "active".to_owned(),
            created_at: now,
            updated_at: None,
        }
    }

    fn zone(methods: Vec<ShippingMethod>) -> CrmStoreShippingZone {
        let now = BsonDateTime::from_chrono(Utc::now());
        CrmStoreShippingZone {
            id: Some(ObjectId::new()),
            user_id: ObjectId::new(),
            project_id: None,
            storefront_id: ObjectId::new(),
            name: "Z1".to_owned(),
            countries: vec!["IN".to_owned()],
            states: None,
            methods,
            status: "active".to_owned(),
            created_at: now,
            updated_at: None,
        }
    }

    // ─── slug ──────────────────────────────────────────────────────────────

    #[test]
    fn validate_slug_rejects_empty() {
        assert!(validate_slug("").is_err());
    }

    #[test]
    fn validate_slug_rejects_invalid_chars() {
        assert!(validate_slug("my store!").is_err());
        assert!(validate_slug("Hello/World").is_err());
    }

    #[test]
    fn validate_slug_accepts_kebab_and_underscore() {
        assert!(validate_slug("my-store").is_ok());
        assert!(validate_slug("my_store_42").is_ok());
        assert!(validate_slug("shop1").is_ok());
    }

    // ─── product filter ────────────────────────────────────────────────────

    #[test]
    fn product_list_filter_defaults_to_active_only() {
        let user = ObjectId::new();
        let f = product_list_filter(&TenantScope::User(user), None, None, None);
        assert_eq!(f.get_str("status").unwrap(), "active");
    }

    #[test]
    fn product_list_filter_respects_storefront_and_category() {
        let user = ObjectId::new();
        let sf = ObjectId::new();
        let cat = ObjectId::new();
        let f = product_list_filter(&TenantScope::User(user), Some("all"), Some(sf), Some(cat));
        assert!(!f.contains_key("status"));
        assert_eq!(f.get_object_id("storefrontId").unwrap(), sf);
        assert_eq!(f.get_object_id("categoryIds").unwrap(), cat);
    }

    // ─── pricing rules ─────────────────────────────────────────────────────

    #[test]
    fn select_rules_orders_by_priority_descending() {
        let r_low = rule(1, "all", None, 5.0);
        let r_high = rule(10, "all", None, 15.0);
        let cart = CartSnapshot {
            subtotal: 500.0,
            ..Default::default()
        };
        let chosen =
            select_applicable_rules(&cart, Utc::now(), &[r_low.clone(), r_high.clone()]);
        // Only one `"all"` rule can fire (non-overlap), and it must be the
        // higher-priority one.
        assert_eq!(chosen.len(), 1);
        assert_eq!(chosen[0].priority, 10);
    }

    #[test]
    fn select_rules_skips_overlapping_product_scopes() {
        let p1 = ObjectId::new();
        let p2 = ObjectId::new();
        let r1 = rule(20, "products", Some(vec![p1, p2]), 10.0);
        let r2 = rule(10, "products", Some(vec![p2]), 5.0); // overlaps on p2
        let r3 = rule(5, "products", Some(vec![ObjectId::new()]), 3.0);
        let cart = CartSnapshot {
            subtotal: 100.0,
            ..Default::default()
        };
        let chosen = select_applicable_rules(&cart, Utc::now(), &[r1, r2, r3]);
        // r1 fires first, eats {p1,p2}; r2 collides with p2 so is skipped;
        // r3's ref is disjoint so it fires.
        assert_eq!(chosen.len(), 2);
        assert_eq!(chosen[0].priority, 20);
        assert_eq!(chosen[1].priority, 5);
    }

    #[test]
    fn select_rules_filters_inactive_and_out_of_window() {
        let mut r_paused = rule(50, "all", None, 10.0);
        r_paused.status = "paused".to_owned();
        let mut r_expired = rule(40, "all", None, 5.0);
        r_expired.ends_at = Some(BsonDateTime::from_chrono(
            Utc.with_ymd_and_hms(2000, 1, 1, 0, 0, 0).unwrap(),
        ));
        let r_active = rule(30, "all", None, 3.0);
        let cart = CartSnapshot {
            subtotal: 100.0,
            ..Default::default()
        };
        let chosen =
            select_applicable_rules(&cart, Utc::now(), &[r_paused, r_expired, r_active.clone()]);
        assert_eq!(chosen.len(), 1);
        assert_eq!(chosen[0].priority, 30);
    }

    // ─── shipping ──────────────────────────────────────────────────────────

    #[test]
    fn compute_shipping_returns_flat_rate() {
        let z = zone(vec![ShippingMethod {
            name: "Standard".into(),
            kind: "flat".into(),
            rate: 50.0,
            free_above_subtotal: None,
        }]);
        let cost = compute_shipping(&z, 200.0, 2.0).unwrap();
        assert!((cost - 50.0).abs() < 1e-6);
    }

    #[test]
    fn compute_shipping_returns_weight_based_cost() {
        let z = zone(vec![ShippingMethod {
            name: "Heavy".into(),
            kind: "weight_based".into(),
            rate: 30.0, // per kg
            free_above_subtotal: None,
        }]);
        let cost = compute_shipping(&z, 100.0, 3.0).unwrap();
        assert!((cost - 90.0).abs() < 1e-6);
    }

    #[test]
    fn compute_shipping_free_above_threshold_unlocks_free() {
        let z = zone(vec![
            ShippingMethod {
                name: "Standard".into(),
                kind: "flat".into(),
                rate: 50.0,
                free_above_subtotal: None,
            },
            ShippingMethod {
                name: "Free over 500".into(),
                kind: "free_above".into(),
                rate: 0.0,
                free_above_subtotal: Some(500.0),
            },
        ]);
        // Below threshold: pay flat.
        let below = compute_shipping(&z, 200.0, 1.0).unwrap();
        assert!((below - 50.0).abs() < 1e-6);
        // At/above threshold: free wins.
        let above = compute_shipping(&z, 600.0, 1.0).unwrap();
        assert_eq!(above, 0.0);
    }

    #[test]
    fn compute_shipping_picks_cheapest_method_when_multiple_priced() {
        let z = zone(vec![
            ShippingMethod {
                name: "Standard".into(),
                kind: "flat".into(),
                rate: 80.0,
                free_above_subtotal: None,
            },
            ShippingMethod {
                name: "Express by weight".into(),
                kind: "weight_based".into(),
                rate: 20.0,
                free_above_subtotal: None,
            },
        ]);
        // weight_based at 2kg = 40 < flat 80.
        let cost = compute_shipping(&z, 100.0, 2.0).unwrap();
        assert!((cost - 40.0).abs() < 1e-6);
    }

    // ─── orders ────────────────────────────────────────────────────────────

    #[test]
    fn format_order_number_pads_seq_and_date() {
        let t = Utc.with_ymd_and_hms(2026, 5, 17, 12, 0, 0).unwrap();
        assert_eq!(format_order_number(t, 1), "ORD-20260517-0001");
        assert_eq!(format_order_number(t, 42), "ORD-20260517-0042");
        assert_eq!(format_order_number(t, 9999), "ORD-20260517-9999");
    }

    #[test]
    fn format_order_number_pads_single_digit_month_and_day() {
        let t = Utc.with_ymd_and_hms(2026, 1, 3, 0, 0, 0).unwrap();
        assert_eq!(format_order_number(t, 7), "ORD-20260103-0007");
    }

    #[test]
    fn validate_payment_status_accepts_known_and_rejects_bogus() {
        assert!(validate_payment_status("pending").is_ok());
        assert!(validate_payment_status("paid").is_ok());
        assert!(validate_payment_status("failed").is_ok());
        assert!(validate_payment_status("refunded").is_ok());
        assert!(validate_payment_status("nope").is_err());
    }

    #[test]
    fn validate_fulfillment_status_accepts_known_and_rejects_bogus() {
        assert!(validate_fulfillment_status("unfulfilled").is_ok());
        assert!(validate_fulfillment_status("partial").is_ok());
        assert!(validate_fulfillment_status("fulfilled").is_ok());
        assert!(validate_fulfillment_status("cancelled").is_ok());
        assert!(validate_fulfillment_status("shipped").is_err());
    }

    // ─── abandoned carts ───────────────────────────────────────────────────

    #[test]
    fn abandoned_cart_list_filter_scopes_to_storefront_and_recovered_flag() {
        let user = ObjectId::new();
        let sf = ObjectId::new();
        let f = abandoned_cart_list_filter(&TenantScope::User(user), Some(sf), Some(false));
        assert_eq!(f.get_object_id("storefrontId").unwrap(), sf);
        assert_eq!(f.get_bool("recovered").unwrap(), false);
    }

    #[test]
    fn abandoned_cart_upsert_key_normalizes_email_lowercase() {
        // The handler lowercases customerEmail before the lookup filter so
        // `User@Example.com` and `user@example.com` collapse to the same row.
        let raw = "User@Example.com";
        let normalized = raw.trim().to_lowercase();
        assert_eq!(normalized, "user@example.com");
    }

    // ─── storefront filter ─────────────────────────────────────────────────

    #[test]
    fn list_filters_scope_by_project_on_sabcrm_mounts() {
        let oid = ObjectId::new();
        let scope = TenantScope::Project(oid);
        for f in [
            storefront_list_filter(&scope, None),
            product_list_filter(&scope, None, None, None),
            pricing_rule_list_filter(&scope, None, None, None),
            shipping_zone_list_filter(&scope, None, None, None),
            order_list_filter(&scope, None, None, None, None),
            abandoned_cart_list_filter(&scope, None, None),
        ] {
            assert_eq!(f.get_object_id("projectId").unwrap(), oid);
            assert!(!f.contains_key("userId"));
        }
    }

    #[test]
    fn ownership_filter_pins_id_and_scope_key() {
        let tenant = ObjectId::new();
        let id = ObjectId::new();
        let f = ownership_filter(&TenantScope::Project(tenant), id);
        assert_eq!(f.get_object_id("_id").unwrap(), id);
        assert_eq!(f.get_object_id("projectId").unwrap(), tenant);
    }

    #[test]
    fn storefront_list_filter_excludes_archived_by_default() {
        let user = ObjectId::new();
        let f = storefront_list_filter(&TenantScope::User(user), None);
        assert!(f.contains_key("status"));
        let f_all = storefront_list_filter(&TenantScope::User(user), Some("all"));
        assert!(!f_all.contains_key("status"));
    }
}
