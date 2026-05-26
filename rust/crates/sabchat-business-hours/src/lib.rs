//! # sabchat-business-hours
//!
//! Axum router that mounts the SabChat **business-hours + holiday
//! calendar** HTTP surface under `/v1/sabchat/business-hours/*`,
//! plus a public evaluator (`is_open`) other crates can call to ask
//! "are we open right now for this inbox?".
//!
//! ## Scope
//!
//! Two surfaces:
//!
//! 1. **CRUD for named calendars** in `sabchat_business_hours_calendars`.
//!    Each calendar is a tenant-scoped object holding an IANA timezone,
//!    a list of weekly windows, and a list of full-day closures
//!    (`holiday_dates`). Calendars are referenced by id from an
//!    inbox's `channel_config.settings.business_hours_calendar_id`.
//! 2. **Evaluator endpoints** that say whether the inbox or calendar
//!    is currently open, falling back through inbox-level
//!    `business_hours` if no named calendar is attached, and folding
//!    in the tenant's HRM `crm_holidays` rows for the day-of check.
//!
//! ## Routes
//!
//! ```text
//! POST   /calendars             — create_calendar
//! GET    /calendars             — list_calendars
//! GET    /calendars/{id}        — get_calendar
//! PATCH  /calendars/{id}        — update_calendar
//! DELETE /calendars/{id}        — delete_calendar
//! GET    /is-open?inboxId=      — is_open_inbox
//! GET    /is-open-now?calendarId= — is_open_calendar
//! ```
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatBusinessHoursState`] bundle (just a Mongo handle), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so the
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod eval;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use dto::{
    BusinessHoursCalendar, CalendarWindow, CreateCalendarBody, IsOpenCalendarQuery,
    IsOpenInboxQuery, OpenReason, OpenStatus, SuccessResponse, UpdateCalendarBody,
};
pub use state::SabChatBusinessHoursState;

/// Build the SabChat business-hours router.
///
/// Routes are mounted relative — the orchestrator nests this under
/// `/v1/sabchat/business-hours`:
///
/// ```ignore
/// .nest(
///     "/v1/sabchat/business-hours",
///     sabchat_business_hours::router::<AppState>(),
/// )
/// ```
///
/// **Route ordering note:** the literal `/is-open` and `/is-open-now`
/// segments are registered before `/calendars/{id}` so axum's
/// matcher prefers the literal paths over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatBusinessHoursState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- evaluator endpoints (literal segments first) -------------
        .route("/is-open", get(handlers::is_open_inbox))
        .route("/is-open-now", get(handlers::is_open_calendar))
        // ---- calendar CRUD --------------------------------------------
        .route(
            "/calendars",
            post(handlers::create_calendar).get(handlers::list_calendars),
        )
        .route(
            "/calendars/{id}",
            get(handlers::get_calendar)
                .patch(handlers::update_calendar)
                .delete(handlers::delete_calendar),
        )
}

// =========================================================================
// Public re-entrant evaluator
// =========================================================================

/// Public helper exposed to other crates (routing, escalation, agent
/// assignment) that want to ask "is this inbox open right now?"
/// without going through HTTP. Reads `sabchat_inboxes` then, if the
/// inbox points at a named calendar via
/// `channel_config.settings.business_hours_calendar_id`, follows that
/// reference; otherwise uses the inline `inbox.business_hours`. In
/// both cases the tenant's `crm_holidays` rows for the local date
/// are union'd onto the calendar's own `holiday_dates`.
///
/// Returns:
///
/// - `Ok(Some(OpenStatus))` when the inbox exists and we have data
///   to evaluate against.
/// - `Ok(None)` when the inbox exists but has no business-hours
///   configuration (treat as always-open by convention upstream).
/// - `Err(_)` only for I/O failures.
pub async fn is_open(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
    now: DateTime<Utc>,
) -> anyhow::Result<Option<OpenStatus>> {
    handlers::evaluate_inbox(mongo, tenant_id, inbox_id, now).await
}
