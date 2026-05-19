//! HTTP handlers for the email audience surface.
//!
//! Conventions (same as `wachat-broadcast`):
//! - Every handler returns `Result<Json<T>, ApiError>`.
//! - Every handler takes `AuthUser` — no anonymous access.
//! - Every Mongo query filters by `user_id = AuthUser.tenant_id` (tenancy).

use axum::{
    Json,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use email_types::{
    EmailList, EmailSegment, EmailSubscriber, EmailSubscriberStatus,
    collections::{LISTS, SEGMENTS, SUBSCRIBERS},
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::{Value, json};
use tracing::{instrument, warn};

use crate::dto::{
    CreateListBody, CreateSegmentBody, CreateSubscriberBody, CustomFieldDef, FieldSchema,
    ImportSummary, ListResponse, ListsQuery, PreviewSegmentBody, SegmentPreviewResponse,
    SubscribersQuery, TagWithCount, TagsResponse, UpdateListBody, UpdateSegmentBody,
    UpdateSubscriberBody,
};
use crate::segments::filter_to_mongo;
use crate::state::EmailAudienceState;

// ---------------------------------------------------------------------------
// Tenancy helpers
// ---------------------------------------------------------------------------

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

fn doc_to_json(d: Document) -> Result<Value> {
    serde_json::to_value(d)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("doc → json")))
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

#[instrument(skip_all)]
pub async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

#[instrument(skip(state, user))]
pub async fn list_lists(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Query(q): Query<ListsQuery>,
) -> Result<Json<ListResponse<Value>>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(LISTS);

    let mut filter = doc! { "userId": tenant };
    if !q.include_archived {
        filter.insert("archivedAt", doc! { "$exists": false });
    }

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.count")))?;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(q.page.saturating_sub(1) * q.limit)
        .limit(q.limit as i64)
        .build();

    let docs: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.find")))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.collect")))?;

    let items: Vec<Value> = docs.into_iter().filter_map(|d| doc_to_json(d).ok()).collect();
    let has_more = q.page * q.limit < total;
    Ok(Json(ListResponse { items, total, page: q.page, limit: q.limit, has_more }))
}

#[instrument(skip(state, user, body))]
pub async fn create_list(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Json(body): Json<CreateListBody>,
) -> Result<(StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now: bson::DateTime = Utc::now().into();
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "userId": tenant,
        "name": body.name.trim(),
        "subscriberCount": 0i64,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(d) = body.description { doc.insert("description", d); }
    if let Some(d) = body.default_from_name { doc.insert("defaultFromName", d); }
    if let Some(d) = body.default_from_email { doc.insert("defaultFromEmail", d); }

    state.mongo.collection::<Document>(LISTS)
        .insert_one(&doc).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.insert")))?;

    Ok((StatusCode::CREATED, Json(doc_to_json(doc)?)))
}

#[instrument(skip(state, user))]
pub async fn get_list(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let doc = state.mongo.collection::<Document>(LISTS)
        .find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("list {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user, body))]
pub async fn update_list(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateListBody>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from(Utc::now()) };
    if let Some(v) = body.name { set.insert("name", v); }
    if let Some(v) = body.description { set.insert("description", v); }
    if let Some(v) = body.default_from_name { set.insert("defaultFromName", v); }
    if let Some(v) = body.default_from_email { set.insert("defaultFromEmail", v); }

    let coll = state.mongo.collection::<Document>(LISTS);
    coll.update_one(doc! { "_id": oid, "userId": tenant }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.update")))?;

    let doc = coll.find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("list {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user))]
pub async fn archive_list(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state.mongo.collection::<Document>(LISTS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": { "archivedAt": bson::DateTime::from(Utc::now()) } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("lists.archive")))?;
    Ok(StatusCode::NO_CONTENT)
}

#[instrument(skip(state, user))]
pub async fn list_subscribers_in_list(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
    Query(mut q): Query<SubscribersQuery>,
) -> Result<Json<ListResponse<Value>>> {
    q.list_id = Some(id);
    inner_list_subscribers(state, user, q).await
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

#[instrument(skip(state, user))]
pub async fn list_subscribers(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Query(q): Query<SubscribersQuery>,
) -> Result<Json<ListResponse<Value>>> {
    inner_list_subscribers(state, user, q).await
}

async fn inner_list_subscribers(
    state: EmailAudienceState,
    user: AuthUser,
    q: SubscribersQuery,
) -> Result<Json<ListResponse<Value>>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);

    let mut filter = doc! { "userId": tenant };
    if let Some(list_id) = q.list_id.as_deref() {
        filter.insert("listId", oid_from_str(list_id)?);
    }
    if let Some(status) = q.status {
        if let Ok(b) = bson::to_bson(&status) { filter.insert("status", b); }
    }
    if let Some(tag) = q.tag {
        filter.insert("tags", tag);
    }
    if let Some(search) = q.search.filter(|s| !s.is_empty()) {
        let regex = regex_escape(&search);
        filter.insert("$or", bson::Bson::Array(vec![
            Bson::Document(doc! { "email":     { "$regex": &regex, "$options": "i" } }),
            Bson::Document(doc! { "firstName": { "$regex": &regex, "$options": "i" } }),
            Bson::Document(doc! { "lastName":  { "$regex": &regex, "$options": "i" } }),
        ]));
    }

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.count")))?;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(q.page.saturating_sub(1) * q.limit)
        .limit(q.limit as i64)
        .build();

    let docs: Vec<Document> = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.find")))?
        .try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.collect")))?;

    let items: Vec<Value> = docs.into_iter().filter_map(|d| doc_to_json(d).ok()).collect();
    let has_more = q.page * q.limit < total;
    Ok(Json(ListResponse { items, total, page: q.page, limit: q.limit, has_more }))
}

#[instrument(skip(state, user, body))]
pub async fn create_subscriber(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Json(body): Json<CreateSubscriberBody>,
) -> Result<(StatusCode, Json<Value>)> {
    if body.email.trim().is_empty() {
        return Err(ApiError::BadRequest("email is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let list_oid = oid_from_str(&body.list_id)?;

    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    if let Some(existing) = coll.find_one(doc! {
        "userId": tenant,
        "listId": list_oid,
        "email": &body.email,
    }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.find_one")))?
    {
        return Ok((StatusCode::OK, Json(doc_to_json(existing)?)));
    }

    let now: bson::DateTime = Utc::now().into();
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "userId": tenant,
        "listId": list_oid,
        "email": body.email.trim(),
        "tags": body.tags,
        "customFields": bson::to_bson(&body.custom_fields).unwrap_or(Bson::Document(Document::new())),
        "status": bson::to_bson(&body.status.unwrap_or(EmailSubscriberStatus::Subscribed)).unwrap_or(Bson::String("subscribed".into())),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(v) = body.first_name { doc.insert("firstName", v); }
    if let Some(v) = body.last_name  { doc.insert("lastName",  v); }

    coll.insert_one(&doc).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.insert")))?;

    // bump list count (best-effort; failure shouldn't fail subscriber creation)
    if let Err(e) = state.mongo.collection::<Document>(LISTS)
        .update_one(doc! { "_id": list_oid, "userId": tenant }, doc! { "$inc": { "subscriberCount": 1i64 } })
        .await {
        warn!(error = ?e, "failed to bump list subscriberCount");
    }

    Ok((StatusCode::CREATED, Json(doc_to_json(doc)?)))
}

#[instrument(skip(state, user))]
pub async fn get_subscriber(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let doc = state.mongo.collection::<Document>(SUBSCRIBERS)
        .find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("subscriber {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user, body))]
pub async fn update_subscriber(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateSubscriberBody>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from(Utc::now()) };
    if let Some(v) = body.first_name { set.insert("firstName", v); }
    if let Some(v) = body.last_name  { set.insert("lastName",  v); }
    if let Some(v) = body.tags       { set.insert("tags", v); }
    if let Some(v) = body.custom_fields {
        set.insert("customFields", bson::to_bson(&v).unwrap_or(Bson::Document(Document::new())));
    }
    if let Some(v) = body.status {
        set.insert("status", bson::to_bson(&v).unwrap_or(Bson::String("subscribed".into())));
    }

    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    coll.update_one(doc! { "_id": oid, "userId": tenant }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.update")))?;
    let doc = coll.find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("subscriber {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user))]
pub async fn archive_subscriber(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state.mongo.collection::<Document>(SUBSCRIBERS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": { "status": "archived", "updatedAt": bson::DateTime::from(Utc::now()) } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.archive")))?;
    Ok(StatusCode::NO_CONTENT)
}

#[instrument(skip(state, user, multipart))]
pub async fn import_subscribers(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<ImportSummary>> {
    let tenant = tenant_oid(&user)?;
    let mut list_id: Option<String> = None;
    let mut csv_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await
        .map_err(|e| ApiError::BadRequest(format!("multipart: {e}")))?
    {
        match field.name().unwrap_or("") {
            "listId" => list_id = Some(field.text().await
                .map_err(|e| ApiError::BadRequest(format!("listId: {e}")))?),
            "file"   => csv_bytes = Some(field.bytes().await
                .map_err(|e| ApiError::BadRequest(format!("file: {e}")))?.to_vec()),
            _ => {}
        }
    }

    let list_id = list_id.ok_or_else(|| ApiError::BadRequest("listId required".into()))?;
    let csv = csv_bytes.ok_or_else(|| ApiError::BadRequest("file required".into()))?;
    let list_oid = oid_from_str(&list_id)?;

    let mut summary = ImportSummary { created: 0, updated: 0, skipped: 0, errors: vec![] };
    let csv_text = String::from_utf8_lossy(&csv);
    let mut lines = csv_text.lines();
    let header = lines.next().unwrap_or("").split(',').map(|s| s.trim().to_lowercase()).collect::<Vec<_>>();
    let email_idx = header.iter().position(|h| h == "email");
    let first_idx = header.iter().position(|h| h == "firstname" || h == "first_name" || h == "first name");
    let last_idx  = header.iter().position(|h| h == "lastname"  || h == "last_name"  || h == "last name");

    let Some(email_idx) = email_idx else {
        return Err(ApiError::BadRequest("CSV must include an 'email' column".into()));
    };

    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    for (lineno, line) in lines.enumerate() {
        let parts: Vec<&str> = line.split(',').collect();
        let Some(email) = parts.get(email_idx).map(|s| s.trim()).filter(|s| !s.is_empty()) else {
            summary.skipped += 1;
            continue;
        };
        let now: bson::DateTime = Utc::now().into();
        let mut doc = doc! {
            "userId": tenant,
            "listId": list_oid,
            "email": email,
            "status": "subscribed",
            "updatedAt": now,
        };
        if let Some(i) = first_idx { if let Some(v) = parts.get(i).map(|s| s.trim()).filter(|s| !s.is_empty()) { doc.insert("firstName", v); } }
        if let Some(i) = last_idx  { if let Some(v) = parts.get(i).map(|s| s.trim()).filter(|s| !s.is_empty()) { doc.insert("lastName",  v); } }

        match coll.update_one(
            doc! { "userId": tenant, "listId": list_oid, "email": email },
            doc! { "$set": doc.clone(), "$setOnInsert": { "_id": ObjectId::new(), "createdAt": now, "tags": Bson::Array(vec![]) } },
        )
        .upsert(true)
        .await {
            Ok(r) => {
                if r.upserted_id.is_some() { summary.created += 1; } else { summary.updated += 1; }
            }
            Err(e) => {
                summary.errors.push(format!("line {}: {e}", lineno + 2));
            }
        }
    }

    // recount list
    let count = coll.count_documents(doc! { "userId": tenant, "listId": list_oid }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.count")))?;
    let _ = state.mongo.collection::<Document>(LISTS)
        .update_one(doc! { "_id": list_oid, "userId": tenant }, doc! { "$set": { "subscriberCount": count as i64 } })
        .await;

    Ok(Json(summary))
}

#[instrument(skip(state, user))]
pub async fn export_subscribers(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Query(q): Query<SubscribersQuery>,
) -> Result<impl IntoResponse> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "userId": tenant };
    if let Some(list_id) = q.list_id.as_deref() { filter.insert("listId", oid_from_str(list_id)?); }
    if let Some(status) = q.status {
        if let Ok(b) = bson::to_bson(&status) { filter.insert("status", b); }
    }

    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    let docs: Vec<Document> = coll.find(filter).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.find")))?
        .try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.collect")))?;

    let mut csv = String::from("email,firstName,lastName,status,tags,createdAt\n");
    for d in docs {
        let email     = d.get_str("email").unwrap_or("");
        let first     = d.get_str("firstName").unwrap_or("");
        let last      = d.get_str("lastName").unwrap_or("");
        let status    = d.get_str("status").unwrap_or("");
        let tags = d
            .get_array("tags").ok()
            .map(|arr| arr.iter().filter_map(|b| b.as_str()).collect::<Vec<_>>().join(";"))
            .unwrap_or_default();
        let created = d.get_datetime("createdAt").map(|dt| dt.to_string()).unwrap_or_default();
        csv.push_str(&format!("{email},{first},{last},{status},{tags},{created}\n"));
    }

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("text/csv"));
    headers.insert("Content-Disposition", HeaderValue::from_static("attachment; filename=\"subscribers.csv\""));
    Ok((headers, csv))
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

#[instrument(skip(state, user))]
pub async fn list_segments(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
) -> Result<Json<Vec<Value>>> {
    let tenant = tenant_oid(&user)?;
    let docs: Vec<Document> = state.mongo.collection::<Document>(SEGMENTS)
        .find(doc! { "userId": tenant })
        .with_options(FindOptions::builder().sort(doc! { "createdAt": -1 }).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.find")))?
        .try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.collect")))?;
    Ok(Json(docs.into_iter().filter_map(|d| doc_to_json(d).ok()).collect()))
}

#[instrument(skip(state, user, body))]
pub async fn create_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Json(body): Json<CreateSegmentBody>,
) -> Result<(StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now: bson::DateTime = Utc::now().into();

    let filter_bson = bson::to_bson(&body.filter)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("filter serialize")))?;

    let mut doc = doc! {
        "_id": ObjectId::new(),
        "userId": tenant,
        "name": body.name.trim(),
        "filter": filter_bson,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(d) = body.description { doc.insert("description", d); }
    if let Some(l) = body.list_id { doc.insert("listId", oid_from_str(&l)?); }

    state.mongo.collection::<Document>(SEGMENTS).insert_one(&doc).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.insert")))?;
    Ok((StatusCode::CREATED, Json(doc_to_json(doc)?)))
}

#[instrument(skip(state, user))]
pub async fn get_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let doc = state.mongo.collection::<Document>(SEGMENTS)
        .find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("segment {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user, body))]
pub async fn update_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateSegmentBody>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from(Utc::now()) };
    if let Some(v) = body.name        { set.insert("name", v); }
    if let Some(v) = body.description { set.insert("description", v); }
    if let Some(v) = body.filter {
        let b = bson::to_bson(&v)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("filter serialize")))?;
        set.insert("filter", b);
    }
    let coll = state.mongo.collection::<Document>(SEGMENTS);
    coll.update_one(doc! { "_id": oid, "userId": tenant }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.update")))?;
    let doc = coll.find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("segment {id}")))?;
    Ok(Json(doc_to_json(doc)?))
}

#[instrument(skip(state, user))]
pub async fn delete_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state.mongo.collection::<Document>(SEGMENTS)
        .delete_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.delete")))?;
    Ok(StatusCode::NO_CONTENT)
}

#[instrument(skip(state, user, body))]
pub async fn preview_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Json(body): Json<PreviewSegmentBody>,
) -> Result<Json<SegmentPreviewResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = filter_to_mongo(&body.filter);
    filter.insert("userId", tenant);
    if let Some(l) = body.list_id {
        filter.insert("listId", oid_from_str(&l)?);
    }

    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    let matches = coll.count_documents(filter.clone()).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segment.count")))?;

    let docs: Vec<Document> = coll
        .find(filter)
        .with_options(FindOptions::builder().limit(body.sample_size.min(100) as i64).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segment.find")))?
        .try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segment.collect")))?;

    let sample: Vec<EmailSubscriber> = docs
        .into_iter()
        .filter_map(|d| bson::from_document(d).ok())
        .collect();

    Ok(Json(SegmentPreviewResponse { matches, sample }))
}

#[instrument(skip(state, user))]
pub async fn recount_segment(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let segment_doc = state.mongo.collection::<Document>(SEGMENTS)
        .find_one(doc! { "_id": oid, "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("segment {id}")))?;

    let seg: EmailSegment = bson::from_document(segment_doc.clone())
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segment decode")))?;

    let mut filter = filter_to_mongo(&seg.filter);
    filter.insert("userId", tenant);
    if let Some(list_id) = seg.list_id { filter.insert("listId", list_id); }

    let matches = state.mongo.collection::<Document>(SUBSCRIBERS)
        .count_documents(filter).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subs.count")))?;

    let now: bson::DateTime = Utc::now().into();
    state.mongo.collection::<Document>(SEGMENTS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": { "cachedCount": matches as i64, "cachedAt": now } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("segments.set_count")))?;

    Ok(Json(json!({ "id": id, "matches": matches })))
}

// ---------------------------------------------------------------------------
// Tags + custom field schema
// ---------------------------------------------------------------------------

#[instrument(skip(state, user))]
pub async fn list_tags(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
) -> Result<Json<TagsResponse>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(SUBSCRIBERS);

    let pipeline = vec![
        doc! { "$match": { "userId": tenant } },
        doc! { "$unwind": "$tags" },
        doc! { "$group": { "_id": "$tags", "count": { "$sum": 1i64 } } },
        doc! { "$sort": { "count": -1i32 } },
        doc! { "$limit": 200i64 },
    ];

    let mut cursor = coll.aggregate(pipeline).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tags.agg")))?;

    let mut tags = Vec::new();
    while let Some(doc) = cursor.try_next().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("tags.next")))?
    {
        let name = doc.get_str("_id").unwrap_or("").to_string();
        let count = doc.get_i64("count").unwrap_or(0).max(0) as u64;
        if !name.is_empty() {
            tags.push(TagWithCount { name, count });
        }
    }
    Ok(Json(TagsResponse { tags }))
}

#[instrument(skip(state, user))]
pub async fn get_fields(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
) -> Result<Json<FieldSchema>> {
    let tenant = tenant_oid(&user)?;
    let doc = state.mongo.collection::<Document>("email_field_schemas")
        .find_one(doc! { "userId": tenant }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("fields.find_one")))?;

    let fields: Vec<CustomFieldDef> = match doc {
        Some(d) => d.get_array("fields").ok()
            .map(|arr| arr.iter().filter_map(|b| bson::from_bson(b.clone()).ok()).collect())
            .unwrap_or_default(),
        None => Vec::new(),
    };
    Ok(Json(FieldSchema { fields }))
}

#[instrument(skip(state, user, body))]
pub async fn put_fields(
    State(state): State<EmailAudienceState>,
    user: AuthUser,
    Json(body): Json<FieldSchema>,
) -> Result<Json<FieldSchema>> {
    let tenant = tenant_oid(&user)?;
    let now: bson::DateTime = Utc::now().into();
    let fields_bson = bson::to_bson(&body.fields)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("fields serialize")))?;

    state.mongo.collection::<Document>("email_field_schemas")
        .update_one(
            doc! { "userId": tenant },
            doc! { "$set": { "fields": fields_bson, "updatedAt": now }, "$setOnInsert": { "userId": tenant, "createdAt": now } },
        )
        .upsert(true)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("fields.upsert")))?;

    Ok(Json(body))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if matches!(c, '.' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '^' | '$' | '\\') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

// silence unused import lint for `EmailList`, kept for future strongly-typed reads
#[allow(dead_code)]
fn _list_type_witness() -> Option<EmailList> { None }
