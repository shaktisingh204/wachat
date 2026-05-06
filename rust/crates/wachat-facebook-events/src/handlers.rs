//! HTTP handlers for the Facebook Events domain.
//!
//! Each handler maps 1:1 to an `export async function` in
//! `src/app/actions/facebook.actions.ts` (Events slice). The TS originals
//! return `{ success?, error?, … }` envelopes and never throw — we follow
//! the same convention so callers can branch on `body.error` without
//! having to special-case 4xx vs JSON envelope errors.
//!
//! ## Project access check
//!
//! [`load_project_for`] resolves a project by id and verifies the caller is
//! the owner (`project.userId === user._id`). Inlined here to keep the
//! crate self-contained; mirrors the `getProjectById` helper used by the
//! TS module.
//!
//! ## Token plumbing
//!
//! The TS code passes the page access token as `?access_token=…` on every
//! Graph API call. We let `MetaClient` set `Authorization: Bearer` for GET
//! and POST — Meta accepts both forms equivalently. For DELETE, we still
//! call `MetaClient::delete` which uses Bearer as well.
//!
//! ## Datetime handling
//!
//! The legacy TS code parses `${date}T${time}` with `new Date(...)`, which
//! is locale-dependent. We parse the same shape as a `NaiveDateTime` and
//! treat it as UTC, matching server-default behavior on a UTC host. The
//! TS shim is responsible for formatting in UTC if the client is in a
//! different timezone.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{NaiveDateTime, TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Map, Value, json};
use wachat_meta_client::{MetaClient, MetaError};

use crate::dto::{
    AckResult, AttendeesQuery, AttendeesResp, CreateEventBody, CreateEventResp, EventDetailsResp,
    EventsResp, RsvpStatus, UpdateEventBody,
};
use crate::state::WachatFacebookEventsState;

const PROJECTS_COLLECTION: &str = "projects";

// =========================================================================
//  Project / user helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn parse_project_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))
}

/// Lightweight projection of the `projects` doc fields the Events handlers
/// care about.
pub struct ProjectCtx {
    pub id: ObjectId,
    pub facebook_page_id: Option<String>,
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it.
///
/// Returns `NotFound` for both "project missing" *and* "project belongs to
/// another user", so we don't leak project existence across tenants.
///
/// Mirrors the `getProjectById(projectId)` helper invoked at the top of the
/// TS event actions.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ProjectCtx> {
    let project_oid = parse_project_oid(project_id)?;
    let user_oid = parse_user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    let owner = doc.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err(ApiError::NotFound("project".to_owned()));
    }

    Ok(ProjectCtx {
        id: project_oid,
        facebook_page_id: doc.get_str("facebookPageId").ok().map(|s| s.to_owned()),
        access_token: doc.get_str("accessToken").ok().map(|s| s.to_owned()),
    })
}

const ERR_PROJECT_MISSING_TOKEN: &str =
    "Project not found or is missing Facebook Page ID or access token.";

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)
}

fn require_page(p: &ProjectCtx) -> std::result::Result<(&str, &str), &'static str> {
    let token = require_token(p)?;
    let page = p
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)?;
    Ok((page, token))
}

/// Squash a `MetaError` into the `String` shape the TS callers expect.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

async fn graph_get(
    meta: &MetaClient,
    path: &str,
    token: &str,
) -> std::result::Result<Value, MetaError> {
    meta.get_json::<Value>(path, token).await
}

fn pull_data_array(v: Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

/// Compose `${date}T${time}` and emit a UTC ISO 8601 string. Returns
/// `None` if the inputs don't parse — callers surface a user-facing
/// "Invalid start date/time." error in that case, matching the TS code.
fn iso_from(date: &str, time: &str) -> Option<String> {
    // Accept both `HH:MM` and `HH:MM:SS`; the TS form sends `HH:MM`.
    let combined = format!("{date}T{time}");
    let formats = ["%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"];
    let naive = formats
        .iter()
        .find_map(|fmt| NaiveDateTime::parse_from_str(&combined, fmt).ok())?;
    let dt = Utc.from_utc_datetime(&naive);
    Some(dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}

// =========================================================================
//  getFacebookEvents  (GET /:project_id)
// =========================================================================

pub async fn get_facebook_events(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path(project_id): Path<String>,
) -> Json<EventsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(EventsResp {
                error: Some(ERR_PROJECT_MISSING_TOKEN.to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(EventsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,description,start_time,end_time,place,cover,attending_count,interested_count,maybe_count,is_online,ticket_uri,category";
    let path = format!(
        "{page}/events?fields={}&limit=50",
        urlencoding::encode(fields)
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(EventsResp {
            events: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(EventsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getEventDetails  (GET /:project_id/:event_id)
// =========================================================================

pub async fn get_event_details(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path((project_id, event_id)): Path<(String, String)>,
) -> Json<EventDetailsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(EventDetailsResp {
                error: Some("Access denied or project not configured.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(EventDetailsResp {
                error: Some("Access denied or project not configured.".to_owned()),
                ..Default::default()
            });
        }
    };

    let fields = "id,name,description,start_time,end_time,place,cover,attending_count,interested_count,maybe_count,is_online,event_times,ticket_uri,category";
    let path = format!("{event_id}?fields={}", urlencoding::encode(fields));
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(EventDetailsResp {
            event: Some(v),
            ..Default::default()
        }),
        Err(e) => Json(EventDetailsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  handleCreateFacebookEvent  (POST /:project_id)
// =========================================================================

pub async fn handle_create_facebook_event(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateEventBody>,
) -> Json<CreateEventResp> {
    if project_id != body.project_id
        || body.name.is_empty()
        || body.start_date.is_empty()
        || body.start_time.is_empty()
    {
        return Json(CreateEventResp {
            error: Some("Event name, start date, and start time are required.".to_owned()),
            ..Default::default()
        });
    }

    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(CreateEventResp {
                error: Some("Project is not fully configured for Facebook.".to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(CreateEventResp {
                error: Some("Project is not fully configured for Facebook.".to_owned()),
                ..Default::default()
            });
        }
    };

    let Some(start_iso) = iso_from(&body.start_date, &body.start_time) else {
        return Json(CreateEventResp {
            error: Some("Invalid start date/time.".to_owned()),
            ..Default::default()
        });
    };

    let mut payload = Map::new();
    payload.insert("name".into(), Value::String(body.name.clone()));
    payload.insert("start_time".into(), Value::String(start_iso));

    if let Some(desc) = body.description.as_deref().filter(|s| !s.is_empty()) {
        payload.insert("description".into(), Value::String(desc.to_owned()));
    }
    if let (Some(ed), Some(et)) = (
        body.end_date.as_deref().filter(|s| !s.is_empty()),
        body.end_time.as_deref().filter(|s| !s.is_empty()),
    ) {
        if let Some(end_iso) = iso_from(ed, et) {
            payload.insert("end_time".into(), Value::String(end_iso));
        }
    }
    if let Some(place) = body.place_name.as_deref().filter(|s| !s.is_empty()) {
        // The TS code passes `place: JSON.stringify({ name })` — Meta accepts
        // a JSON string in this field even when the rest of the body is JSON.
        let inner = json!({ "name": place });
        payload.insert("place".into(), Value::String(inner.to_string()));
    }
    if body.is_online {
        payload.insert("is_online".into(), Value::Bool(true));
    }
    if let Some(uri) = body.ticket_uri.as_deref().filter(|s| !s.is_empty()) {
        payload.insert("ticket_uri".into(), Value::String(uri.to_owned()));
    }

    let path = format!("{page}/events");
    match s
        .meta
        .post_json::<_, Value>(&path, token, &Value::Object(payload))
        .await
    {
        Ok(_) => Json(CreateEventResp {
            message: Some(format!("Event \"{}\" created successfully!", body.name)),
            ..Default::default()
        }),
        Err(e) => Json(CreateEventResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  handleUpdateFacebookEvent  (POST /:project_id/:event_id)
// =========================================================================

pub async fn handle_update_facebook_event(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path((project_id, event_id)): Path<(String, String)>,
    Json(body): Json<UpdateEventBody>,
) -> Json<AckResult> {
    if project_id != body.project_id || event_id != body.event_id || event_id.is_empty() {
        return Json(AckResult {
            success: false,
            error: Some("Missing event or project ID.".to_owned()),
        });
    }

    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Access denied or project not configured.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Access denied or project not configured.".to_owned()),
            });
        }
    };

    let mut payload = Map::new();
    if let Some(v) = body.name.as_deref().filter(|s| !s.is_empty()) {
        payload.insert("name".into(), Value::String(v.to_owned()));
    }
    if let Some(v) = body.description.as_deref().filter(|s| !s.is_empty()) {
        payload.insert("description".into(), Value::String(v.to_owned()));
    }
    if let (Some(d), Some(t)) = (
        body.start_date.as_deref().filter(|s| !s.is_empty()),
        body.start_time.as_deref().filter(|s| !s.is_empty()),
    ) {
        if let Some(iso) = iso_from(d, t) {
            payload.insert("start_time".into(), Value::String(iso));
        }
    }
    if let (Some(d), Some(t)) = (
        body.end_date.as_deref().filter(|s| !s.is_empty()),
        body.end_time.as_deref().filter(|s| !s.is_empty()),
    ) {
        if let Some(iso) = iso_from(d, t) {
            payload.insert("end_time".into(), Value::String(iso));
        }
    }

    match s
        .meta
        .post_json::<_, Value>(&event_id, token, &Value::Object(payload))
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: false,
            error: Some(err_msg(e)),
        }),
    }
}

// =========================================================================
//  deleteFacebookEvent  (DELETE /:project_id/:event_id)
// =========================================================================

pub async fn delete_facebook_event(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path((project_id, event_id)): Path<(String, String)>,
) -> Json<AckResult> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AckResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            });
        }
    };

    match s.meta.delete(&event_id, token).await {
        Ok(()) => Json(AckResult {
            success: true,
            error: None,
        }),
        Err(e) => Json(AckResult {
            success: false,
            error: Some(err_msg(e)),
        }),
    }
}

// =========================================================================
//  getEventAttendees  (GET /:project_id/:event_id/attendees/:rsvp_status)
//  + (GET /:project_id/:event_id/attendees) with `?rsvp_status=` fallback
// =========================================================================

pub async fn get_event_attendees(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path((project_id, event_id, rsvp)): Path<(String, String, RsvpStatus)>,
) -> Json<AttendeesResp> {
    fetch_attendees(&user, &s, &project_id, &event_id, rsvp.as_str()).await
}

pub async fn get_event_attendees_default(
    user: AuthUser,
    State(s): State<WachatFacebookEventsState>,
    Path((project_id, event_id)): Path<(String, String)>,
    Query(q): Query<AttendeesQuery>,
) -> Json<AttendeesResp> {
    let rsvp = match q.rsvp_status.as_deref() {
        Some("attending") | None => "attending",
        Some("maybe") => "maybe",
        Some("declined") => "declined",
        Some(_) => {
            return Json(AttendeesResp {
                error: Some("Invalid rsvp_status (expected attending|maybe|declined).".to_owned()),
                ..Default::default()
            });
        }
    };
    fetch_attendees(&user, &s, &project_id, &event_id, rsvp).await
}

async fn fetch_attendees(
    user: &AuthUser,
    s: &WachatFacebookEventsState,
    project_id: &str,
    event_id: &str,
    rsvp: &str,
) -> Json<AttendeesResp> {
    let project = match load_project_for(user, &s.mongo, project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(AttendeesResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(AttendeesResp {
                error: Some("Access denied.".to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{event_id}/{rsvp}?fields={}&limit=100",
        urlencoding::encode("id,name,picture")
    );
    match graph_get(&s.meta, &path, token).await {
        Ok(v) => Json(AttendeesResp {
            attendees: Some(pull_data_array(v)),
            ..Default::default()
        }),
        Err(e) => Json(AttendeesResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}
