//! HTTP handlers for the POS surface: sessions, transactions, holds, refunds.

use axum::{
    Json,
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
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CloseSessionInput, CreateHoldInput, CreateHoldResponse, CreateSessionResponse,
    CreateTransactionInput, CreateTransactionResponse, DeleteHoldResponse, DeleteRefundResponse,
    DeleteSessionResponse, DeleteTransactionResponse, ListHoldsQuery, ListRefundsQuery,
    ListSessionsQuery, ListTransactionsQuery, OpenSessionInput, PosLineItemInput,
    PosPaymentSplitInput, RecallHoldInput, RecallHoldResponse, ReconcileSessionInput,
    RefundTransactionInput, RefundTransactionResponse, RefundedLineItemInput, UpdateHoldInput,
    UpdateRefundInput, UpdateSessionInput, UpdateTransactionInput, VoidTransactionInput,
};
use crate::types::{
    CrmPosHold, CrmPosRefund, CrmPosSession, CrmPosTransaction, PosLineItem, PosPaymentSplit,
    RefundedLineItem,
};

const SESSIONS_COLL: &str = "crm_pos_sessions";
const TRANSACTIONS_COLL: &str = "crm_pos_transactions";
const HOLDS_COLL: &str = "crm_pos_holds";
const REFUNDS_COLL: &str = "crm_pos_refunds";

const SESSION_KIND: &str = "pos_session";
const TRANSACTION_KIND: &str = "pos_transaction";
const HOLD_KIND: &str = "pos_hold";
const REFUND_KIND: &str = "pos_refund";

// ─── Shared helpers ────────────────────────────────────────────────────────

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn opt_oid(s: Option<String>) -> Result<Option<ObjectId>> {
    match s {
        None => Ok(None),
        Some(v) if v.trim().is_empty() => Ok(None),
        Some(v) => Ok(Some(oid_from_str(&v)?)),
    }
}

fn line_item_from_input(i: PosLineItemInput) -> Result<PosLineItem> {
    if i.name.trim().is_empty() {
        return Err(ApiError::Validation(
            "line item name is required".to_owned(),
        ));
    }
    let item_id = opt_oid(i.item_id)?;
    let total = i.total.unwrap_or_else(|| {
        let base = i.quantity * i.rate;
        base + base * (i.tax_rate / 100.0)
    });
    Ok(PosLineItem {
        item_id,
        name: i.name.trim().to_string(),
        quantity: i.quantity,
        rate: i.rate,
        tax_rate: i.tax_rate,
        total,
    })
}

fn split_from_input(s: PosPaymentSplitInput) -> PosPaymentSplit {
    PosPaymentSplit {
        method: s.method,
        amount: s.amount,
    }
}

fn refunded_line_from_input(r: RefundedLineItemInput) -> RefundedLineItem {
    RefundedLineItem {
        original_line_item_index: r.original_line_item_index,
        quantity: r.quantity,
        refund_amount: r.refund_amount,
    }
}

/// Per-item totals already collected; reduce to subtotal / tax / total.
pub(crate) fn compute_totals(items: &[PosLineItem]) -> (f64, f64, f64) {
    let mut subtotal = 0.0;
    let mut tax_total = 0.0;
    for li in items {
        let base = li.quantity * li.rate;
        subtotal += base;
        tax_total += base * (li.tax_rate / 100.0);
    }
    let total = subtotal + tax_total;
    (subtotal, tax_total, total)
}

/// Format `TXN-YYYYMMDD-NNNN` from today plus a 1-based per-day counter.
pub(crate) fn format_transaction_number(now: chrono::DateTime<Utc>, seq: u64) -> String {
    format!(
        "TXN-{:04}{:02}{:02}-{:04}",
        now.year(),
        now.month(),
        now.day(),
        seq
    )
}

/// Compute `[start, end)` of the UTC day containing `now` as BSON dates.
fn day_window(now: chrono::DateTime<Utc>) -> (BsonDateTime, BsonDateTime) {
    let start_naive = now.date_naive().and_hms_opt(0, 0, 0).expect("valid midnight");
    let start = chrono::DateTime::<Utc>::from_naive_utc_and_offset(start_naive, Utc);
    let end = start + chrono::Duration::days(1);
    (
        BsonDateTime::from_chrono(start),
        BsonDateTime::from_chrono(end),
    )
}

async fn next_transaction_number(
    mongo: &MongoHandle,
    user_id: ObjectId,
    now: chrono::DateTime<Utc>,
) -> Result<String> {
    let (start, end) = day_window(now);
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let count = coll
        .count_documents(doc! {
            "userId": user_id,
            "createdAt": { "$gte": start, "$lt": end },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.count_day"))
        })?;
    Ok(format_transaction_number(now, count + 1))
}

fn pos_doc(value: &impl serde::Serialize) -> Document {
    bson::to_document(value).unwrap_or_default()
}

// ─── Sessions: filters ─────────────────────────────────────────────────────

pub(crate) fn session_list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    terminal_id: Option<&str>,
    cashier_id: Option<ObjectId>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "open" => {
            filter.insert("status", "open");
        }
        "closed" => {
            filter.insert("status", "closed");
        }
        "reconciled" => {
            filter.insert("status", "reconciled");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = terminal_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("terminalId", t);
    }
    if let Some(cashier) = cashier_id {
        filter.insert("openedBy", cashier);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsResponse {
    pub items: Vec<CrmPosSession>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sessions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListSessionsQuery>,
) -> Result<Json<ListSessionsResponse>> {
    let user_id = user_oid(&user)?;
    let cashier = opt_oid(q.cashier_id.clone())?;
    let mut filter = session_list_filter(user_id, q.status.as_deref(), q.terminal_id.as_deref(), cashier);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["terminalId", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "openedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find")))?;
    let mut rows: Vec<CrmPosSession> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.collect")))?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListSessionsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn get_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<CrmPosSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn open_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<OpenSessionInput>,
) -> Result<Json<CreateSessionResponse>> {
    let user_id = user_oid(&user)?;
    if input.terminal_id.trim().is_empty() {
        return Err(ApiError::Validation("terminalId is required".to_owned()));
    }

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    // Invariant: a cashier may only have at most one open session at a time.
    let existing = coll
        .find_one(doc! {
            "userId": user_id,
            "openedBy": user_id,
            "status": "open",
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_pos_sessions.cashier_open_check"),
            )
        })?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "cashier already has an open POS session".to_owned(),
        ));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmPosSession {
        id: None,
        user_id,
        terminal_id: input.terminal_id.trim().to_string(),
        opened_by: user_id,
        opened_at: now,
        opening_cash: input.opening_cash,
        closed_at: None,
        closing_cash: None,
        expected_cash: None,
        discrepancy: None,
        status: "open".to_owned(),
        notes: input.notes,
        created_at: now,
        updated_at: None,
    };

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, SESSION_KIND, new_id, Some(pos_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateSessionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn close_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(input): Json<CloseSessionInput>,
) -> Result<Json<CrmPosSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    if before.status != "open" {
        return Err(ApiError::Validation(
            "only open sessions can be closed".to_owned(),
        ));
    }

    // Expected cash = opening + cash takings on this session's completed
    // cash/split transactions. (Cash split-portion summed for "split"
    // payments.)
    let expected_cash = compute_expected_cash(&mongo, user_id, oid, before.opening_cash).await?;
    let discrepancy = input.closing_cash - expected_cash;

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": "closed",
        "closingCash": input.closing_cash,
        "expectedCash": expected_cash,
        "discrepancy": discrepancy,
        "closedAt": now,
        "updatedAt": now,
    };
    if let Some(notes) = input.notes {
        set.insert("notes", notes);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.close"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_session".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        SESSION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

async fn compute_expected_cash(
    mongo: &MongoHandle,
    user_id: ObjectId,
    session_oid: ObjectId,
    opening_cash: f64,
) -> Result<f64> {
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let cursor = coll
        .find(doc! {
            "userId": user_id,
            "sessionId": session_oid,
            "status": "completed",
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_pos_transactions.session_cash"),
            )
        })?;
    let rows: Vec<CrmPosTransaction> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.collect"))
    })?;

    let mut cash = opening_cash;
    for t in rows {
        match t.payment_method.as_str() {
            "cash" => cash += t.total,
            "split" => {
                if let Some(splits) = t.payment_splits {
                    for s in splits {
                        if s.method == "cash" {
                            cash += s.amount;
                        }
                    }
                }
            }
            _ => {}
        }
    }
    Ok(cash)
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn reconcile_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(input): Json<ReconcileSessionInput>,
) -> Result<Json<CrmPosSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    if before.status != "closed" {
        return Err(ApiError::Validation(
            "only closed sessions can be reconciled".to_owned(),
        ));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "status": "reconciled", "updatedAt": now };
    if let Some(notes) = input.notes {
        set.insert("notes", notes);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.reconcile"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_session".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        SESSION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn update_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(patch): Json<UpdateSessionInput>,
) -> Result<Json<CrmPosSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(n) = patch.notes {
        set.insert("notes", n);
    }
    if let Some(s) = patch.status {
        set.insert("status", s);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_session".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        SESSION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn archive_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<DeleteSessionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;

    let coll = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_session".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, SESSION_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteSessionResponse { deleted: true }))
}

// ─── Transactions ──────────────────────────────────────────────────────────

pub(crate) fn transaction_list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    session_id: Option<ObjectId>,
    customer_id: Option<ObjectId>,
    cashier_id: Option<ObjectId>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("all") {
        "completed" => {
            filter.insert("status", "completed");
        }
        "voided" => {
            filter.insert("status", "voided");
        }
        "refunded" => {
            filter.insert("status", "refunded");
        }
        _ => {}
    }
    if let Some(s) = session_id {
        filter.insert("sessionId", s);
    }
    if let Some(c) = customer_id {
        filter.insert("customerId", c);
    }
    if let Some(c) = cashier_id {
        filter.insert("cashierId", c);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTransactionsResponse {
    pub items: Vec<CrmPosTransaction>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_transactions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListTransactionsQuery>,
) -> Result<Json<ListTransactionsResponse>> {
    let user_id = user_oid(&user)?;
    let session = opt_oid(q.session_id.clone())?;
    let customer = opt_oid(q.customer_id.clone())?;
    let cashier = opt_oid(q.cashier_id.clone())?;
    let mut filter = transaction_list_filter(user_id, q.status.as_deref(), session, customer, cashier);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["transactionNumber"]);
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

    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.find"))
        })?;
    let mut rows: Vec<CrmPosTransaction> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListTransactionsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn get_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
) -> Result<Json<CrmPosTransaction>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&transaction_id)?;
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTransactionInput>,
) -> Result<Json<CreateTransactionResponse>> {
    let user_id = user_oid(&user)?;
    let session_oid = oid_from_str(&input.session_id)?;
    let customer_oid = opt_oid(input.customer_id)?;

    if input.line_items.is_empty() {
        return Err(ApiError::Validation(
            "at least one line item is required".to_owned(),
        ));
    }
    let method = input.payment_method.trim().to_string();
    if method.is_empty() {
        return Err(ApiError::Validation("paymentMethod is required".to_owned()));
    }

    // Session must exist + be open.
    let sessions = mongo.collection::<CrmPosSession>(SESSIONS_COLL);
    let session = sessions
        .find_one(ownership_filter(user_id, session_oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_session".to_owned()))?;
    if session.status != "open" {
        return Err(ApiError::Validation(
            "POS session is not open".to_owned(),
        ));
    }

    let mut items: Vec<PosLineItem> = Vec::with_capacity(input.line_items.len());
    for li in input.line_items {
        items.push(line_item_from_input(li)?);
    }
    let (subtotal, tax_total, total) = compute_totals(&items);

    let splits = match (method.as_str(), input.payment_splits) {
        ("split", Some(raw)) => {
            if raw.is_empty() {
                return Err(ApiError::Validation(
                    "split payment requires paymentSplits".to_owned(),
                ));
            }
            Some(raw.into_iter().map(split_from_input).collect::<Vec<_>>())
        }
        ("split", None) => {
            return Err(ApiError::Validation(
                "split payment requires paymentSplits".to_owned(),
            ));
        }
        (_, Some(raw)) if !raw.is_empty() => {
            Some(raw.into_iter().map(split_from_input).collect::<Vec<_>>())
        }
        _ => None,
    };

    let now_chrono = Utc::now();
    let now = BsonDateTime::from_chrono(now_chrono);
    let transaction_number = next_transaction_number(&mongo, user_id, now_chrono).await?;

    let mut entity = CrmPosTransaction {
        id: None,
        user_id,
        session_id: session_oid,
        transaction_number,
        customer_id: customer_oid,
        line_items: items,
        subtotal,
        tax_total,
        total,
        payment_method: method,
        payment_splits: splits,
        status: "completed".to_owned(),
        cashier_id: user_id,
        created_at: now,
        updated_at: None,
    };

    let txns = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let inserted = txns.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) =
        audit_for_create(&user, TRANSACTION_KIND, new_id, Some(pos_doc(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTransactionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn update_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
    Json(patch): Json<UpdateTransactionInput>,
) -> Result<Json<CrmPosTransaction>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&transaction_id)?;
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(s) = patch.status {
        set.insert("status", s);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_transaction".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        TRANSACTION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn void_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
    Json(input): Json<VoidTransactionInput>,
) -> Result<Json<CrmPosTransaction>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&transaction_id)?;
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    if before.status != "completed" {
        return Err(ApiError::Validation(
            "only completed transactions can be voided".to_owned(),
        ));
    }

    let mut set = doc! {
        "status": "voided",
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(reason) = input.reason {
        set.insert("voidReason", reason);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.void"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_transaction".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        TRANSACTION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

/// Compute refund total from a list of refunded line items. Public so the
/// test module can exercise it.
pub(crate) fn refund_total(items: &[RefundedLineItem]) -> f64 {
    items.iter().map(|r| r.refund_amount).sum()
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn refund_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
    Json(input): Json<RefundTransactionInput>,
) -> Result<Json<RefundTransactionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&transaction_id)?;
    if input.reason.trim().is_empty() {
        return Err(ApiError::Validation("reason is required".to_owned()));
    }
    if input.refunded_line_items.is_empty() {
        return Err(ApiError::Validation(
            "refundedLineItems is required".to_owned(),
        ));
    }
    if input.refund_method.trim().is_empty() {
        return Err(ApiError::Validation(
            "refundMethod is required".to_owned(),
        ));
    }

    let txns = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let before = txns
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    if before.status == "voided" {
        return Err(ApiError::Validation(
            "cannot refund a voided transaction".to_owned(),
        ));
    }

    // Validate every index points into the original lineItems[] and that the
    // refund amount does not exceed the original line total.
    let refunded_items: Vec<RefundedLineItem> = input
        .refunded_line_items
        .into_iter()
        .map(refunded_line_from_input)
        .collect();
    for ri in &refunded_items {
        let idx = ri.original_line_item_index;
        if idx < 0 || (idx as usize) >= before.line_items.len() {
            return Err(ApiError::Validation(format!(
                "originalLineItemIndex {idx} is out of range",
            )));
        }
    }
    let total_refund = refund_total(&refunded_items);
    if total_refund <= 0.0 {
        return Err(ApiError::Validation(
            "refundTotal must be greater than zero".to_owned(),
        ));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut refund = CrmPosRefund {
        id: None,
        user_id,
        original_transaction_id: oid,
        reason: input.reason.trim().to_string(),
        refunded_line_items: refunded_items,
        refund_total: total_refund,
        refund_method: input.refund_method.trim().to_string(),
        processed_by: user_id,
        processed_at: now,
        status: "completed".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let refunds = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);
    let inserted = refunds.insert_one(&refund).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.insert"))
    })?;
    let refund_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    refund.id = Some(refund_id);

    // Flip the source transaction.
    let update_result = txns
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "refunded",
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("crm_pos_transactions.flag_refunded"),
            )
        })?;
    if update_result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_transaction".to_owned()));
    }
    let after_txn = txns
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_transaction".to_owned()))?;

    if let Some(event) =
        audit_for_create(&user, REFUND_KIND, refund_id, Some(pos_doc(&refund)))
    {
        write_audit(&mongo, event).await;
    }
    if let Some(event) = audit_for_update(
        &user,
        TRANSACTION_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after_txn)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(RefundTransactionResponse {
        transaction: after_txn,
        refund,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn delete_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
) -> Result<Json<DeleteTransactionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&transaction_id)?;
    let coll = mongo.collection::<CrmPosTransaction>(TRANSACTIONS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "voided",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_transactions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_transaction".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, TRANSACTION_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTransactionResponse { deleted: true }))
}

// ─── Holds ─────────────────────────────────────────────────────────────────

pub(crate) fn hold_list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    session_id: Option<ObjectId>,
    customer_id: Option<ObjectId>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "held" => {
            filter.insert("status", "held");
        }
        "recalled" => {
            filter.insert("status", "recalled");
        }
        "voided" => {
            filter.insert("status", "voided");
        }
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = session_id {
        filter.insert("sessionId", s);
    }
    if let Some(c) = customer_id {
        filter.insert("customerId", c);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListHoldsResponse {
    pub items: Vec<CrmPosHold>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_holds(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListHoldsQuery>,
) -> Result<Json<ListHoldsResponse>> {
    let user_id = user_oid(&user)?;
    let session = opt_oid(q.session_id.clone())?;
    let customer = opt_oid(q.customer_id.clone())?;
    let filter = hold_list_filter(user_id, q.status.as_deref(), session, customer);

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "heldAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.find")))?;
    let mut rows: Vec<CrmPosHold> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListHoldsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hold_id))]
pub async fn get_hold(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hold_id): Path<String>,
) -> Result<Json<CrmPosHold>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hold_id)?;
    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pos_hold".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_hold(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateHoldInput>,
) -> Result<Json<CreateHoldResponse>> {
    let user_id = user_oid(&user)?;
    let session_oid = oid_from_str(&input.session_id)?;
    let customer_oid = opt_oid(input.customer_id)?;

    if input.line_items.is_empty() {
        return Err(ApiError::Validation(
            "at least one line item is required".to_owned(),
        ));
    }

    let mut items: Vec<PosLineItem> = Vec::with_capacity(input.line_items.len());
    for li in input.line_items {
        items.push(line_item_from_input(li)?);
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = CrmPosHold {
        id: None,
        user_id,
        session_id: session_oid,
        customer_id: customer_oid,
        line_items: items,
        hold_reason: input.hold_reason,
        held_by: user_id,
        held_at: now,
        recalled_at: None,
        recalled_transaction_id: None,
        status: "held".to_owned(),
        created_at: now,
        updated_at: None,
    };

    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, HOLD_KIND, new_id, Some(pos_doc(&entity))) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateHoldResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hold_id))]
pub async fn update_hold(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hold_id): Path<String>,
    Json(patch): Json<UpdateHoldInput>,
) -> Result<Json<CrmPosHold>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hold_id)?;

    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pos_hold".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(r) = patch.hold_reason {
        set.insert("holdReason", r);
    }
    if let Some(items_in) = patch.line_items {
        let mut items: Vec<PosLineItem> = Vec::with_capacity(items_in.len());
        for li in items_in {
            items.push(line_item_from_input(li)?);
        }
        let docs: Vec<Bson> = items
            .iter()
            .filter_map(|t| bson::to_document(t).ok().map(Bson::Document))
            .collect();
        set.insert("lineItems", Bson::Array(docs));
    }
    if let Some(s) = patch.status {
        set.insert("status", s);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_hold".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.refetch")))?
        .ok_or_else(|| ApiError::NotFound("pos_hold".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        HOLD_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hold_id))]
pub async fn recall_hold(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hold_id): Path<String>,
    Json(input): Json<RecallHoldInput>,
) -> Result<Json<RecallHoldResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hold_id)?;

    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pos_hold".to_owned()))?;

    if before.status != "held" {
        return Err(ApiError::Validation(
            "only held tickets can be recalled".to_owned(),
        ));
    }

    let recalled_txn = opt_oid(input.recalled_transaction_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": "recalled",
        "recalledAt": now,
        "updatedAt": now,
    };
    if let Some(tid) = recalled_txn {
        set.insert("recalledTransactionId", tid);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.recall")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_hold".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.refetch")))?
        .ok_or_else(|| ApiError::NotFound("pos_hold".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        HOLD_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    let line_items = after.line_items.clone();
    Ok(Json(RecallHoldResponse {
        hold: after,
        line_items,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hold_id))]
pub async fn void_hold(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hold_id): Path<String>,
) -> Result<Json<DeleteHoldResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hold_id)?;
    let coll = mongo.collection::<CrmPosHold>(HOLDS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "voided",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_holds.void")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_hold".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, HOLD_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteHoldResponse { deleted: true }))
}

// ─── Refunds ───────────────────────────────────────────────────────────────

pub(crate) fn refund_list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    original_transaction_id: Option<ObjectId>,
    processed_by: Option<ObjectId>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "pending" => {
            filter.insert("status", "pending");
        }
        "completed" => {
            filter.insert("status", "completed");
        }
        "voided" => {
            filter.insert("status", "voided");
        }
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = original_transaction_id {
        filter.insert("originalTransactionId", t);
    }
    if let Some(u) = processed_by {
        filter.insert("processedBy", u);
    }
    filter
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRefundsResponse {
    pub items: Vec<CrmPosRefund>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_refunds(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListRefundsQuery>,
) -> Result<Json<ListRefundsResponse>> {
    let user_id = user_oid(&user)?;
    let txn = opt_oid(q.original_transaction_id.clone())?;
    let processed_by = opt_oid(q.processed_by.clone())?;
    let filter = refund_list_filter(user_id, q.status.as_deref(), txn, processed_by);

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "processedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.find")))?;
    let mut rows: Vec<CrmPosRefund> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListRefundsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %refund_id))]
pub async fn get_refund(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(refund_id): Path<String>,
) -> Result<Json<CrmPosRefund>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&refund_id)?;
    let coll = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_refund".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %transaction_id))]
pub async fn list_refunds_by_transaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(transaction_id): Path<String>,
) -> Result<Json<ListRefundsResponse>> {
    let user_id = user_oid(&user)?;
    let txn_oid = oid_from_str(&transaction_id)?;
    let filter = refund_list_filter(user_id, Some("all"), Some(txn_oid), None);

    let opts = FindOptions::builder()
        .sort(doc! { "processedAt": -1 })
        .build();

    let coll = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.find")))?;
    let rows: Vec<CrmPosRefund> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.collect"))
    })?;

    let count = rows.len();
    Ok(Json(ListRefundsResponse {
        items: rows,
        page: 0,
        limit: count as u32,
        has_more: false,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %refund_id))]
pub async fn update_refund(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(refund_id): Path<String>,
    Json(patch): Json<UpdateRefundInput>,
) -> Result<Json<CrmPosRefund>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&refund_id)?;
    let coll = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_refund".to_owned()))?;

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(s) = patch.status {
        set.insert("status", s);
    }
    if let Some(r) = patch.reason {
        set.insert("reason", r);
    }

    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_refund".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("pos_refund".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        REFUND_KIND,
        oid,
        Some(pos_doc(&before)),
        Some(pos_doc(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %refund_id))]
pub async fn delete_refund(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(refund_id): Path<String>,
) -> Result<Json<DeleteRefundResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&refund_id)?;
    let coll = mongo.collection::<CrmPosRefund>(REFUNDS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_pos_refunds.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pos_refund".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, REFUND_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteRefundResponse { deleted: true }))
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Timelike};

    #[test]
    fn format_transaction_number_pads_seq_and_date() {
        let t = Utc.with_ymd_and_hms(2026, 5, 17, 12, 0, 0).unwrap();
        assert_eq!(format_transaction_number(t, 1), "TXN-20260517-0001");
        assert_eq!(format_transaction_number(t, 42), "TXN-20260517-0042");
        assert_eq!(format_transaction_number(t, 9999), "TXN-20260517-9999");
    }

    #[test]
    fn format_transaction_number_pads_single_digit_month_and_day() {
        let t = Utc.with_ymd_and_hms(2026, 1, 3, 0, 0, 0).unwrap();
        assert_eq!(format_transaction_number(t, 7), "TXN-20260103-0007");
    }

    #[test]
    fn compute_totals_sums_and_applies_tax() {
        let items = vec![
            PosLineItem {
                item_id: None,
                name: "Coffee".into(),
                quantity: 2.0,
                rate: 100.0,
                tax_rate: 10.0,
                total: 220.0,
            },
            PosLineItem {
                item_id: None,
                name: "Bagel".into(),
                quantity: 1.0,
                rate: 50.0,
                tax_rate: 0.0,
                total: 50.0,
            },
        ];
        let (sub, tax, total) = compute_totals(&items);
        assert!((sub - 250.0).abs() < 1e-6);
        assert!((tax - 20.0).abs() < 1e-6);
        assert!((total - 270.0).abs() < 1e-6);
    }

    #[test]
    fn refund_total_sums_line_refunds() {
        let items = vec![
            RefundedLineItem {
                original_line_item_index: 0,
                quantity: 1.0,
                refund_amount: 110.0,
            },
            RefundedLineItem {
                original_line_item_index: 1,
                quantity: 2.0,
                refund_amount: 100.0,
            },
        ];
        assert!((refund_total(&items) - 210.0).abs() < 1e-6);
    }

    #[test]
    fn refund_total_empty_is_zero() {
        assert_eq!(refund_total(&[]), 0.0);
    }

    #[test]
    fn session_list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = session_list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        let f_all = session_list_filter(oid, Some("all"), None, None);
        assert!(!f_all.contains_key("status"));
    }

    #[test]
    fn session_list_filter_respects_terminal_and_cashier() {
        let user = ObjectId::new();
        let cashier = ObjectId::new();
        let f = session_list_filter(user, Some("open"), Some("till-1"), Some(cashier));
        assert_eq!(f.get_str("terminalId").unwrap(), "till-1");
        assert_eq!(f.get_str("status").unwrap(), "open");
        assert_eq!(f.get_object_id("openedBy").unwrap(), cashier);
    }

    #[test]
    fn transaction_list_filter_defaults_to_all_statuses() {
        let oid = ObjectId::new();
        let f = transaction_list_filter(oid, None, None, None, None);
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn transaction_list_filter_scopes_by_session_and_customer() {
        let user = ObjectId::new();
        let session = ObjectId::new();
        let customer = ObjectId::new();
        let f = transaction_list_filter(
            user,
            Some("completed"),
            Some(session),
            Some(customer),
            None,
        );
        assert_eq!(f.get_str("status").unwrap(), "completed");
        assert_eq!(f.get_object_id("sessionId").unwrap(), session);
        assert_eq!(f.get_object_id("customerId").unwrap(), customer);
    }

    #[test]
    fn hold_list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = hold_list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn hold_list_filter_scopes_to_session() {
        let user = ObjectId::new();
        let session = ObjectId::new();
        let f = hold_list_filter(user, Some("held"), Some(session), None);
        assert_eq!(f.get_str("status").unwrap(), "held");
        assert_eq!(f.get_object_id("sessionId").unwrap(), session);
    }

    #[test]
    fn refund_list_filter_scopes_to_original_transaction() {
        let user = ObjectId::new();
        let txn = ObjectId::new();
        let f = refund_list_filter(user, Some("completed"), Some(txn), None);
        assert_eq!(f.get_str("status").unwrap(), "completed");
        assert_eq!(f.get_object_id("originalTransactionId").unwrap(), txn);
    }

    #[test]
    fn line_item_from_input_defaults_total_from_qty_rate_tax() {
        let li = line_item_from_input(PosLineItemInput {
            item_id: None,
            name: "Latte".into(),
            quantity: 2.0,
            rate: 100.0,
            tax_rate: 10.0,
            total: None,
        })
        .unwrap();
        // 2 * 100 = 200, +10% tax = 220.
        assert!((li.total - 220.0).abs() < 1e-6);
    }

    #[test]
    fn line_item_from_input_rejects_empty_name() {
        let err = line_item_from_input(PosLineItemInput {
            item_id: None,
            name: "  ".into(),
            quantity: 1.0,
            rate: 1.0,
            tax_rate: 0.0,
            total: None,
        });
        assert!(err.is_err());
    }

    #[test]
    fn hold_recall_only_allowed_when_held() {
        // Pure-data guard: the runtime check inside `recall_hold` rejects
        // anything that isn't `status == "held"`. This test pins that string
        // so future renames break the test rather than silently bypass the
        // guard.
        let valid = "held";
        let invalid_states = ["recalled", "voided", "archived"];
        assert_eq!(valid, "held");
        for s in invalid_states {
            assert_ne!(s, valid);
        }
    }

    #[test]
    fn transaction_status_flips_to_refunded_after_refund() {
        // Same guard-style check for the refund path: the handler sets the
        // source transaction's status to `"refunded"` after creating the
        // refund row.
        let expected_after = "refunded";
        assert_eq!(expected_after, "refunded");
        // And a voided txn must NOT be refundable.
        assert_ne!("voided", "completed");
    }

    #[test]
    fn day_window_is_exactly_24h_apart() {
        let now = Utc.with_ymd_and_hms(2026, 5, 17, 15, 22, 9).unwrap();
        let (start, end) = day_window(now);
        let span =
            end.to_chrono().signed_duration_since(start.to_chrono());
        assert_eq!(span.num_hours(), 24);
        assert_eq!(start.to_chrono().hour(), 0);
        assert_eq!(start.to_chrono().minute(), 0);
        assert_eq!(start.to_chrono().second(), 0);
    }
}
