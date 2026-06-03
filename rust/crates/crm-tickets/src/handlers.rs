//! HTTP handlers for the §12.8 Ticket / Help Desk entity.
//!
//! Five handlers — same shape as [`crm_leads`]:
//!
//! | Method  | Path             | Function           |
//! |---------|------------------|--------------------|
//! | `GET`   | `/`              | [`list_tickets`]   |
//! | `GET`   | `/:ticketId`     | [`get_ticket`]     |
//! | `POST`  | `/`              | [`create_ticket`]  |
//! | `PATCH` | `/:ticketId`     | [`update_ticket`]  |
//! | `DELETE`| `/:ticketId`     | [`delete_ticket`]  |
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! — the CRM tenant root from `crm-core::Identity`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Assignment, Audit, Identity, Priority};
use crm_extras_types::{Ticket, TicketChannel, TicketSeverity, TicketStatus};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CreateTicketInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateTicketInput};

/// Mongo collection name. Must match the §12.8 spec literal so this
/// crate and any TS callers share the same backing collection during
/// the migration window.
const TICKETS_COLL: &str = "crm_tickets";

// =========================================================================
// Helpers
// =========================================================================

/// Resolve the calling tenant root from the verified [`AuthUser`].
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Clamp `requested` page-size into `[1, MAX_LIMIT]`, defaulting to
/// [`DEFAULT_LIMIT`] when absent.
fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

/// Materialize the base ownership filter:
/// `{ userId, archived: { $ne: true } }`. Soft-deleted rows
/// (`archived = true`) are excluded by default.
fn base_ownership_filter(user: ObjectId) -> Document {
    doc! {
        "userId": user,
        "archived": { "$ne": true },
    }
}

/// Optional-string update helper. When the input field is `Some`,
/// inserts the value at `key` in `$set`; when `None`, leaves the
/// document untouched (PATCH semantics — absent != `null`).
fn set_opt_str(set: &mut Document, key: &str, val: Option<&String>) {
    if let Some(v) = val {
        set.insert(key, v.as_str());
    }
}

/// Optional-OID update helper. Parses a 24-char hex string when
/// present and stores the OID; rejects malformed input with
/// `BadRequest`.
fn set_opt_oid(set: &mut Document, key: &str, val: Option<&String>) -> Result<()> {
    if let Some(v) = val {
        let oid = oid_from_str(v)?;
        set.insert(key, oid);
    }
    Ok(())
}

/// Parse a wire-format string into a typed enum via serde. Returns a
/// human-readable [`ApiError::Validation`] on bad input. The `field`
/// label is embedded in the error message so the UI can pinpoint the
/// offending field.
fn parse_enum<T: serde::de::DeserializeOwned>(field: &str, raw: &str) -> Result<T> {
    serde_json::from_value::<T>(serde_json::Value::String(raw.to_owned())).map_err(|_| {
        ApiError::Validation(format!("{field} value '{raw}' is not a recognised variant"))
    })
}

/// Re-serialize a typed enum back to its canonical lowercase / snake_case
/// JSON representation so we can write it into a Mongo `$set` document
/// without re-implementing the variant table.
fn enum_to_str<T: serde::Serialize>(value: &T) -> Result<String> {
    let v = serde_json::to_value(value)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("enum serialize")))?;
    v.as_str().map(|s| s.to_owned()).ok_or_else(|| {
        ApiError::Internal(anyhow::anyhow!("expected string-shaped enum on serialize"))
    })
}

// =========================================================================
// GET / — list_tickets
// =========================================================================

/// `GET /v1/crm/tickets` — paginated list scoped to the authenticated
/// user's tickets. The `q` query param does a case-insensitive substring
/// search across `subject` and `category`. The structured filters
/// (`status` / `severity` / `assigneeId` / `requesterId`) are
/// validated and applied as exact-match. Sorted by `createdAt` desc.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tickets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Ticket>>> {
    let user_id = user_oid(&user)?;

    let mut filter = base_ownership_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "subject": regex.clone() }),
                Bson::Document(doc! { "category": regex }),
            ]),
        );
    }

    if let Some(raw) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let parsed: TicketStatus = parse_enum("status", raw)?;
        filter.insert("status", enum_to_str(&parsed)?);
    }

    if let Some(raw) = q
        .severity
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let parsed: TicketSeverity = parse_enum("severity", raw)?;
        filter.insert("severity", enum_to_str(&parsed)?);
    }

    if let Some(raw) = q
        .assignee_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = oid_from_str(raw)?;
        filter.insert("assigneeId", oid);
    }

    if let Some(raw) = q
        .requester_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let oid = oid_from_str(raw)?;
        filter.insert("requesterId", oid);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Ticket>(TICKETS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.find")))?;
    let tickets: Vec<Ticket> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.collect")))?;

    Ok(Json(tickets))
}

// =========================================================================
// GET /:ticketId — get_ticket
// =========================================================================

/// `GET /v1/crm/tickets/:ticketId` — fetch a single ticket. Returns
/// 404 if the ticket doesn't exist OR isn't owned by the caller (we
/// deliberately collapse the two so existence isn't leaked).
#[instrument(skip_all, fields(user_id = %user.user_id, ticket_id = %ticket_id))]
pub async fn get_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ticket_id): Path<String>,
) -> Result<Json<Ticket>> {
    let user_id = user_oid(&user)?;
    let ticket_oid = oid_from_str(&ticket_id)?;

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", ticket_oid);

    let coll = mongo.collection::<Ticket>(TICKETS_COLL);
    let ticket = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("ticket".to_owned()))?;

    Ok(Json(ticket))
}

// =========================================================================
// POST / — create_ticket
// =========================================================================

/// `POST /v1/crm/tickets` — insert a new ticket.
///
/// Builds a [`Ticket`] from the curated [`CreateTicketInput`], stamps
/// `Identity` + `Audit`, persists it, and returns the full document.
///
/// **SLA `dueBy`:** the §12.8 spec computes `dueBy` from the linked
/// SLA. That evaluator is deferred — for now the caller can supply
/// `dueBy` directly, and the field is forwarded onto the document
/// verbatim.
///
/// **Lineage:** tickets are NOT in the §13.5 chain. No `fromKind` /
/// `fromId` handling here.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTicketInput>,
) -> Result<Json<Ticket>> {
    if input.subject.trim().is_empty() {
        return Err(ApiError::Validation("subject is required.".to_owned()));
    }
    if input.requester_id.trim().is_empty() {
        return Err(ApiError::Validation("requesterId is required.".to_owned()));
    }
    if input.channel.trim().is_empty() {
        return Err(ApiError::Validation("channel is required.".to_owned()));
    }
    if input.severity.trim().is_empty() {
        return Err(ApiError::Validation("severity is required.".to_owned()));
    }

    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        // Matches the §5.1 / §12.8 fallback used in `crm_leads::create_lead`
        // — single-tenant callers omit projectId and pick up a freshly
        // minted id at insert time.
        None => ObjectId::new(),
    };

    let requester_oid = oid_from_str(&input.requester_id)?;
    let channel: TicketChannel = parse_enum("channel", input.channel.trim())?;
    let severity: TicketSeverity = parse_enum("severity", input.severity.trim())?;

    let priority = match input
        .priority
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => Some(parse_enum::<Priority>("priority", raw)?),
        None => None,
    };

    let status = match input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => parse_enum::<TicketStatus>("status", raw)?,
        None => TicketStatus::default(),
    };

    let product_id = match input.product_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let assignee_id = match input.assignee_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let linked_deal_id = match input.linked_deal_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let linked_invoice_id = match input.linked_invoice_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let parent_ticket_id = match input.parent_ticket_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let internal_notes = match input.internal_notes {
        Some(v) => serde_json::from_value(v)
            .map_err(|e| ApiError::Validation(format!("internalNotes shape is invalid: {e}")))?,
        None => Vec::new(),
    };
    let attachments = match input.attachments {
        Some(v) => serde_json::from_value(v)
            .map_err(|e| ApiError::Validation(format!("attachments shape is invalid: {e}")))?,
        None => Vec::new(),
    };

    let ticket = Ticket {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment {
            assigned_to: assignee_id,
            ..Default::default()
        },
        subject: input.subject.trim().to_owned(),
        requester_id: requester_oid,
        channel,
        product_id,
        category: input.category.clone(),
        priority,
        severity,
        due_by: input.due_by,
        sla_id: None,
        assignee_id,
        status,
        satisfaction_rating: None,
        internal_notes,
        attachments,
        linked_deal_id,
        linked_invoice_id,
        parent_ticket_id,
        child_ticket_ids: Vec::new(),
        merge_log: Vec::new(),
    };

    let coll = mongo.collection::<Ticket>(TICKETS_COLL);
    coll.insert_one(&ticket)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.insert_one")))?;

    Ok(Json(ticket))
}

// =========================================================================
// PATCH /:ticketId — update_ticket
// =========================================================================

/// `PATCH /v1/crm/tickets/:ticketId` — partial update.
///
/// Only fields explicitly sent on the body are modified. `updatedAt`
/// and `updatedBy` are always refreshed. Fails with 404 if the ticket
/// doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, ticket_id = %ticket_id))]
pub async fn update_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ticket_id): Path<String>,
    Json(input): Json<UpdateTicketInput>,
) -> Result<Json<Ticket>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }

    let user_id = user_oid(&user)?;
    let ticket_oid = oid_from_str(&ticket_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };

    set_opt_str(&mut set, "subject", input.subject.as_ref());
    set_opt_str(&mut set, "category", input.category.as_ref());

    // Enum fields: validate (parse) then re-serialize to the canonical
    // wire string before writing.
    if let Some(raw) = input.channel.as_deref() {
        let parsed: TicketChannel = parse_enum("channel", raw)?;
        set.insert("channel", enum_to_str(&parsed)?);
    }
    if let Some(raw) = input.severity.as_deref() {
        let parsed: TicketSeverity = parse_enum("severity", raw)?;
        set.insert("severity", enum_to_str(&parsed)?);
    }
    if let Some(raw) = input.priority.as_deref() {
        let parsed: Priority = parse_enum("priority", raw)?;
        set.insert("priority", enum_to_str(&parsed)?);
    }
    if let Some(raw) = input.status.as_deref() {
        let parsed: TicketStatus = parse_enum("status", raw)?;
        set.insert("status", enum_to_str(&parsed)?);
    }

    set_opt_oid(&mut set, "requesterId", input.requester_id.as_ref())?;
    set_opt_oid(&mut set, "productId", input.product_id.as_ref())?;
    // `assigneeId` is the entity-specific column; we also mirror it into
    // the flattened `Assignment.assigned_to` column so the §0 audit
    // surface stays consistent.
    if let Some(raw) = input.assignee_id.as_deref() {
        let oid = oid_from_str(raw)?;
        set.insert("assigneeId", oid);
        set.insert("assignedTo", oid);
    }
    set_opt_oid(&mut set, "linkedDealId", input.linked_deal_id.as_ref())?;
    set_opt_oid(
        &mut set,
        "linkedInvoiceId",
        input.linked_invoice_id.as_ref(),
    )?;
    set_opt_oid(&mut set, "parentTicketId", input.parent_ticket_id.as_ref())?;

    if let Some(when) = input.due_by {
        set.insert("dueBy", bson::DateTime::from_chrono(when));
    }

    if let Some(notes) = input.internal_notes.clone() {
        let bson_val = bson::to_bson(&notes)
            .map_err(|e| ApiError::Validation(format!("internalNotes shape is invalid: {e}")))?;
        set.insert("internalNotes", bson_val);
    }
    if let Some(atts) = input.attachments.clone() {
        let bson_val = bson::to_bson(&atts)
            .map_err(|e| ApiError::Validation(format!("attachments shape is invalid: {e}")))?;
        set.insert("attachments", bson_val);
    }

    let mut filter = base_ownership_filter(user_id);
    filter.insert("_id", ticket_oid);

    let coll = mongo.collection::<Document>(TICKETS_COLL);
    let res = coll
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("ticket".to_owned()));
    }

    // Re-read via the typed collection so the response is the canonical
    // [`Ticket`] shape (and any defaults / skipped fields render
    // correctly).
    let typed = mongo.collection::<Ticket>(TICKETS_COLL);
    let ticket = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.find_one(after-update)"))
        })?
        .ok_or_else(|| ApiError::NotFound("ticket".to_owned()))?;

    Ok(Json(ticket))
}

// =========================================================================
// DELETE /:ticketId — delete_ticket (hard)
// =========================================================================

/// `DELETE /v1/crm/tickets/:ticketId` — **hard delete**. Per the CRM
/// ecosystem plan (`docs/ecosystem/CRM_PLAN.md` §10), CRM entities use
/// hard deletes — the row is removed from the collection. Fails with
/// 404 if the ticket doesn't exist OR isn't owned by the caller.
#[instrument(skip_all, fields(user_id = %user.user_id, ticket_id = %ticket_id))]
pub async fn delete_ticket(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(ticket_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let ticket_oid = oid_from_str(&ticket_id)?;

    let filter = doc! { "_id": ticket_oid, "userId": user_id };

    let coll = mongo.collection::<Document>(TICKETS_COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("ticket".to_owned()));
    }

    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_uses_default_when_absent() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }

    #[test]
    fn clamp_limit_caps_at_max() {
        assert_eq!(clamp_limit(Some(500)), MAX_LIMIT);
    }

    #[test]
    fn clamp_limit_floors_at_one() {
        assert_eq!(clamp_limit(Some(0)), 1);
    }

    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_ownership_filter(oid);
        assert_eq!(f.get_object_id("userId").unwrap(), oid);
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }

    #[test]
    fn set_opt_str_skips_none() {
        let mut d = doc! {};
        set_opt_str(&mut d, "subject", None);
        assert!(d.is_empty());
    }

    #[test]
    fn set_opt_str_inserts_some() {
        let mut d = doc! {};
        let v = "hello".to_owned();
        set_opt_str(&mut d, "subject", Some(&v));
        assert_eq!(d.get_str("subject").unwrap(), "hello");
    }

    #[test]
    fn set_opt_oid_rejects_garbage() {
        let mut d = doc! {};
        let bad = "not-an-oid".to_owned();
        let err = set_opt_oid(&mut d, "assigneeId", Some(&bad)).unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn parse_enum_accepts_valid_status() {
        let s: TicketStatus = parse_enum("status", "on_hold").unwrap();
        assert!(matches!(s, TicketStatus::OnHold));
    }

    #[test]
    fn parse_enum_accepts_valid_severity() {
        let s: TicketSeverity = parse_enum("severity", "sev1").unwrap();
        assert!(matches!(s, TicketSeverity::Sev1));
    }

    #[test]
    fn parse_enum_accepts_valid_channel() {
        let c: TicketChannel = parse_enum("channel", "whatsapp").unwrap();
        assert!(matches!(c, TicketChannel::Whatsapp));
    }

    #[test]
    fn parse_enum_accepts_valid_priority() {
        let p: Priority = parse_enum("priority", "high").unwrap();
        assert!(matches!(p, Priority::High));
    }

    #[test]
    fn parse_enum_rejects_garbage_with_validation() {
        let err = parse_enum::<TicketStatus>("status", "BANANAS").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn enum_to_str_round_trips_status() {
        assert_eq!(enum_to_str(&TicketStatus::OnHold).unwrap(), "on_hold");
        assert_eq!(enum_to_str(&TicketStatus::Open).unwrap(), "open");
    }

    #[test]
    fn enum_to_str_round_trips_severity() {
        assert_eq!(enum_to_str(&TicketSeverity::Sev1).unwrap(), "sev1");
        assert_eq!(enum_to_str(&TicketSeverity::Sev3).unwrap(), "sev3");
    }
}
