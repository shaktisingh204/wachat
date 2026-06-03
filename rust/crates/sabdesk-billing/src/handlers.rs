use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::mock_db::MockDb;
use crate::models::*;

// --- Subscription Tiers ---

pub async fn list_tiers(State(db): State<MockDb>) -> Json<Vec<SubscriptionTier>> {
    let tiers = db.tiers.read().await;
    Json(tiers.values().cloned().collect())
}

pub async fn create_tier(
    State(db): State<MockDb>,
    Json(payload): Json<SubscriptionTier>,
) -> (StatusCode, Json<SubscriptionTier>) {
    let mut tiers = db.tiers.write().await;
    let tier = SubscriptionTier {
        id: Uuid::new_v4(),
        created_at: Utc::now(),
        ..payload
    };
    tiers.insert(tier.id, tier.clone());
    (StatusCode::CREATED, Json(tier))
}

pub async fn get_tier(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Result<Json<SubscriptionTier>, StatusCode> {
    let tiers = db.tiers.read().await;
    tiers
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_tier_limits(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
    Json(req): Json<UpdateLimitReq>,
) -> Result<Json<SubscriptionTier>, StatusCode> {
    let mut tiers = db.tiers.write().await;
    if let Some(tier) = tiers.get_mut(&id) {
        if let Some(mu) = req.max_users {
            tier.max_users = mu;
        }
        if let Some(sl) = req.storage_limit_gb {
            tier.storage_limit_gb = sl;
        }
        Ok(Json(tier.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_tier(Path(id): Path<Uuid>, State(db): State<MockDb>) -> StatusCode {
    let mut tiers = db.tiers.write().await;
    if tiers.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// --- Invoices ---

pub async fn list_invoices(State(db): State<MockDb>) -> Json<Vec<Invoice>> {
    let invoices = db.invoices.read().await;
    Json(invoices.values().cloned().collect())
}

pub async fn create_invoice(
    State(db): State<MockDb>,
    Json(req): Json<CreateInvoiceReq>,
) -> (StatusCode, Json<Invoice>) {
    let mut invoices = db.invoices.write().await;
    let invoice = Invoice {
        id: Uuid::new_v4(),
        customer_id: req.customer_id,
        amount_due_cents: req.amount_due_cents,
        amount_paid_cents: 0,
        status: InvoiceStatus::Draft,
        due_date: req.due_date,
        created_at: Utc::now(),
    };
    invoices.insert(invoice.id, invoice.clone());
    (StatusCode::CREATED, Json(invoice))
}

pub async fn get_invoice(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Result<Json<Invoice>, StatusCode> {
    let invoices = db.invoices.read().await;
    invoices
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn pay_invoice(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Result<Json<Invoice>, StatusCode> {
    let mut invoices = db.invoices.write().await;
    if let Some(invoice) = invoices.get_mut(&id) {
        if invoice.status != InvoiceStatus::Void {
            invoice.amount_paid_cents = invoice.amount_due_cents;
            invoice.status = InvoiceStatus::Paid;
            Ok(Json(invoice.clone()))
        } else {
            Err(StatusCode::BAD_REQUEST)
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn void_invoice(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Result<Json<Invoice>, StatusCode> {
    let mut invoices = db.invoices.write().await;
    if let Some(invoice) = invoices.get_mut(&id) {
        invoice.status = InvoiceStatus::Void;
        Ok(Json(invoice.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn apply_invoice_discount(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
    Json(req): Json<ApplyDiscountReq>,
) -> Result<Json<Invoice>, StatusCode> {
    let mut invoices = db.invoices.write().await;
    if let Some(invoice) = invoices.get_mut(&id) {
        if req.discount_percentage <= 100 {
            let discount =
                (invoice.amount_due_cents as f64 * (req.discount_percentage as f64 / 100.0)) as u64;
            invoice.amount_due_cents = invoice.amount_due_cents.saturating_sub(discount);
            Ok(Json(invoice.clone()))
        } else {
            Err(StatusCode::BAD_REQUEST)
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_invoice(Path(id): Path<Uuid>, State(db): State<MockDb>) -> StatusCode {
    let mut invoices = db.invoices.write().await;
    if invoices.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// --- Usage Records ---

pub async fn list_usages(State(db): State<MockDb>) -> Json<Vec<UsageRecord>> {
    let usages = db.usages.read().await;
    Json(usages.values().cloned().collect())
}

pub async fn record_usage(
    State(db): State<MockDb>,
    Json(payload): Json<UsageRecord>,
) -> (StatusCode, Json<UsageRecord>) {
    let mut usages = db.usages.write().await;
    let usage = UsageRecord {
        id: Uuid::new_v4(),
        recorded_at: Utc::now(),
        ..payload
    };
    usages.insert(usage.id, usage.clone());
    (StatusCode::CREATED, Json(usage))
}

pub async fn get_usage_summary(
    Path(customer_id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Json<u64> {
    let usages = db.usages.read().await;
    let total: u64 = usages
        .values()
        .filter(|u| u.customer_id == customer_id)
        .map(|u| u.quantity)
        .sum();
    Json(total)
}

// --- Payment Methods ---

pub async fn list_payment_methods(
    Path(customer_id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Json<Vec<PaymentMethod>> {
    let pm = db.payment_methods.read().await;
    let customer_methods: Vec<PaymentMethod> = pm
        .values()
        .filter(|p| p.customer_id == customer_id)
        .cloned()
        .collect();
    Json(customer_methods)
}

pub async fn add_payment_method(
    State(db): State<MockDb>,
    Json(payload): Json<PaymentMethod>,
) -> (StatusCode, Json<PaymentMethod>) {
    let mut pm = db.payment_methods.write().await;
    let method = PaymentMethod {
        id: Uuid::new_v4(),
        created_at: Utc::now(),
        ..payload
    };
    pm.insert(method.id, method.clone());
    (StatusCode::CREATED, Json(method))
}

pub async fn set_default_payment_method(
    Path((customer_id, method_id)): Path<(Uuid, Uuid)>,
    State(db): State<MockDb>,
) -> Result<Json<PaymentMethod>, StatusCode> {
    let mut pm = db.payment_methods.write().await;

    // First clear all defaults for this customer
    for method in pm.values_mut().filter(|p| p.customer_id == customer_id) {
        method.is_default = false;
    }

    // Then set the chosen one to default
    if let Some(method) = pm.get_mut(&method_id) {
        if method.customer_id == customer_id {
            method.is_default = true;
            return Ok(Json(method.clone()));
        }
    }
    Err(StatusCode::NOT_FOUND)
}

// --- Dunning Policy ---

pub async fn get_dunning_policy(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
) -> Result<Json<DunningPolicy>, StatusCode> {
    let policies = db.policies.read().await;
    policies
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_dunning_policy(
    Path(id): Path<Uuid>,
    State(db): State<MockDb>,
    Json(payload): Json<DunningPolicy>,
) -> Result<Json<DunningPolicy>, StatusCode> {
    let mut policies = db.policies.write().await;
    if let Some(policy) = policies.get_mut(&id) {
        policy.grace_period_days = payload.grace_period_days;
        policy.retry_schedule_days = payload.retry_schedule_days;
        policy.action_on_failure = payload.action_on_failure;
        Ok(Json(policy.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
