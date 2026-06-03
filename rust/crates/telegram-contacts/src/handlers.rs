//! HTTP handlers for the Telegram Contacts slice.
//!
//! Contacts mirror real Telegram users (`private` chats), are
//! enriched with tags, custom fields, an assigned agent, and may
//! also be created manually or via CSV import.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use std::collections::HashMap;

use crate::dto::*;
use crate::state::TelegramContactsState;

const PROJECTS: &str = "projects";
const CONTACTS: &str = "telegram_contacts";
const SEGMENTS: &str = "telegram_contact_segments";
const CHATS: &str = "telegram_chats";

// ===========================================================================
// Helpers
// ===========================================================================

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err_ack(msg: impl Into<String>) -> Json<AckResult> {
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
fn dt_opt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
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

fn normalize_tag(s: &str) -> Option<String> {
    let v = s.trim().to_lowercase();
    if v.is_empty() { None } else { Some(v) }
}

fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut out = Vec::with_capacity(tags.len());
    for t in tags {
        if let Some(v) = normalize_tag(t) {
            if !out.contains(&v) {
                out.push(v);
            }
        }
    }
    out
}

/// Best-effort E.164 normalisation. Strips spaces, dashes, parens and
/// adds a leading "+" if the result is all digits with at least 8
/// characters. Anything that doesn't look like a phone is returned
/// as-is so we don't reject otherwise-legible imports.
fn normalize_phone(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let cleaned: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();
    if cleaned.is_empty() {
        return trimmed.to_owned();
    }
    if cleaned.starts_with('+') {
        return cleaned;
    }
    let digits_only: String = cleaned.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits_only.len() >= 8 {
        format!("+{digits_only}")
    } else {
        cleaned
    }
}

fn custom_fields_from_doc(d: &Document) -> HashMap<String, String> {
    let mut out = HashMap::new();
    if let Ok(cf) = d.get_document("customFields") {
        for (k, v) in cf.iter() {
            match v {
                Bson::String(s) => {
                    out.insert(k.clone(), s.clone());
                }
                Bson::Int32(i) => {
                    out.insert(k.clone(), i.to_string());
                }
                Bson::Int64(i) => {
                    out.insert(k.clone(), i.to_string());
                }
                Bson::Double(d) => {
                    out.insert(k.clone(), d.to_string());
                }
                Bson::Boolean(b) => {
                    out.insert(k.clone(), b.to_string());
                }
                _ => {}
            }
        }
    }
    out
}

fn doc_to_row(d: &Document) -> Option<ContactRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let bot_id = d.get_object_id("botId").ok().map(|o| o.to_hex());
    let chat_id = d
        .get_i64("chatId")
        .or_else(|_| d.get_i32("chatId").map(i64::from))
        .unwrap_or(0);
    let tags: Vec<String> = match d.get_array("tags") {
        Ok(arr) => arr
            .iter()
            .filter_map(|b| b.as_str().map(str::to_owned))
            .collect(),
        Err(_) => Vec::new(),
    };
    Some(ContactRow {
        _id,
        project_id,
        bot_id,
        chat_id,
        first_name: d.get_str("firstName").unwrap_or("").to_owned(),
        last_name: d.get_str("lastName").ok().map(str::to_owned),
        username: d.get_str("username").ok().map(str::to_owned),
        language_code: d.get_str("languageCode").ok().map(str::to_owned),
        phone_number: d.get_str("phoneNumber").ok().map(str::to_owned),
        is_bot: d.get_bool("isBot").unwrap_or(false),
        is_premium: d.get_bool("isPremium").unwrap_or(false),
        is_verified: d.get_bool("isVerified").unwrap_or(false),
        tags,
        notes: d.get_str("notes").unwrap_or("").to_owned(),
        custom_fields: custom_fields_from_doc(d),
        assigned_agent_id: d.get_str("assignedAgentId").ok().map(str::to_owned),
        last_interaction_at: dt_opt(d.get_datetime("lastInteractionAt").ok().copied()),
        source: d.get_str("source").unwrap_or("manual").to_owned(),
        blocked: d.get_bool("blocked").unwrap_or(false),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn empty_list(err: Option<String>) -> ListResp {
    ListResp {
        contacts: vec![],
        total: 0,
        has_more: false,
        page: 1,
        page_size: 25,
        error: err,
    }
}

fn build_list_filter(project_oid: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "projectId": project_oid };

    if let Some(b) = q.bot_id.as_deref() {
        if !b.is_empty() {
            if let Some(oid) = parse_oid(b) {
                filter.insert("botId", oid);
            }
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
                    doc! { "firstName": regex.clone() },
                    doc! { "lastName": regex.clone() },
                    doc! { "username": regex.clone() },
                    doc! { "phoneNumber": regex.clone() },
                    doc! { "notes": regex },
                ],
            );
        }
    }
    if let Some(tag) = q.tag.as_deref() {
        if let Some(t) = normalize_tag(tag) {
            filter.insert("tags", t);
        }
    }
    if let Some(lc) = q.language_code.as_deref() {
        let lc = lc.trim();
        if !lc.is_empty() && lc != "all" {
            filter.insert("languageCode", lc);
        }
    }
    if let Some(hp) = q.has_phone {
        if hp {
            filter.insert(
                "phoneNumber",
                doc! { "$exists": true, "$nin": [Bson::Null, Bson::String(String::new())] },
            );
        } else {
            filter.insert(
                "$and",
                vec![doc! {
                    "$or": [
                        { "phoneNumber": { "$exists": false } },
                        { "phoneNumber": Bson::Null },
                        { "phoneNumber": "" },
                    ]
                }],
            );
        }
    }
    if let Some(b) = q.blocked {
        filter.insert("blocked", b);
    }
    if let Some(a) = q.assigned_agent_id.as_deref() {
        let a = a.trim();
        if !a.is_empty() {
            if a == "unassigned" {
                filter.insert(
                    "assignedAgentId",
                    doc! { "$in": vec![Bson::Null, Bson::String(String::new())] },
                );
            } else {
                filter.insert("assignedAgentId", a);
            }
        }
    }

    let mut range = doc! {};
    if let Some(from) = q.last_interaction_after.as_deref() {
        if let Some(d) = parse_iso(from) {
            range.insert("$gte", bson::DateTime::from_millis(d.timestamp_millis()));
        }
    }
    if let Some(to) = q.last_interaction_before.as_deref() {
        if let Some(d) = parse_iso(to) {
            range.insert("$lte", bson::DateTime::from_millis(d.timestamp_millis()));
        }
    }
    if !range.is_empty() {
        filter.insert("lastInteractionAt", range);
    }
    filter
}

// ===========================================================================
// List
// ===========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
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
    let page_size = q.page_size.unwrap_or(25).clamp(1, 200);
    let skip = (page - 1) * page_size;
    let filter = build_list_filter(project_oid, &q);

    let coll = s.mongo.collection::<Document>(CONTACTS);
    let total = match coll.count_documents(filter.clone()).await {
        Ok(n) => n as i64,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };

    let cursor = match coll
        .find(filter)
        .sort(doc! { "updatedAt": -1 })
        .skip(skip as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return Json(empty_list(Some(format!("mongo: {e}")))),
    };
    let contacts: Vec<ContactRow> = docs.iter().filter_map(doc_to_row).collect();
    let has_more = skip + (contacts.len() as i64) < total;
    Json(ListResp {
        contacts,
        total,
        has_more,
        page,
        page_size,
        error: None,
    })
}

// ===========================================================================
// Upsert
// ===========================================================================

pub async fn upsert(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };

    let bot_oid = body
        .bot_id
        .as_deref()
        .filter(|b| !b.is_empty())
        .and_then(parse_oid);

    let phone_norm = body
        .phone_number
        .as_deref()
        .map(normalize_phone)
        .filter(|s| !s.is_empty());

    // On create, require at least one identifier.
    if body.contact_id.is_none() {
        let has_chat = body.chat_id.unwrap_or(0) != 0;
        let has_phone = phone_norm.is_some();
        let has_username = body
            .username
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if !has_chat && !has_phone && !has_username {
            return err_ack("Provide chatId, phoneNumber, or username.");
        }
    }

    let now = bson::DateTime::now();
    let coll = s.mongo.collection::<Document>(CONTACTS);

    // Build $set patch
    let mut set = doc! {
        "projectId": project_oid,
        "updatedAt": now,
    };
    if let Some(b) = bot_oid {
        set.insert("botId", b);
    } else if body.bot_id.as_deref() == Some("") {
        set.insert("botId", Bson::Null);
    }
    if let Some(c) = body.chat_id {
        set.insert("chatId", c);
    }
    if let Some(v) = body.first_name.as_deref() {
        set.insert("firstName", v.trim());
    }
    if let Some(v) = body.last_name {
        set.insert("lastName", v.trim());
    }
    if let Some(v) = body.username {
        set.insert("username", v.trim().trim_start_matches('@'));
    }
    if let Some(v) = body.language_code {
        set.insert("languageCode", v.trim());
    }
    if let Some(v) = phone_norm.clone() {
        set.insert("phoneNumber", v);
    }
    if let Some(v) = body.is_bot {
        set.insert("isBot", v);
    }
    if let Some(v) = body.is_premium {
        set.insert("isPremium", v);
    }
    if let Some(v) = body.is_verified {
        set.insert("isVerified", v);
    }
    if let Some(v) = body.tags {
        set.insert("tags", normalize_tags(&v));
    }
    if let Some(v) = body.notes {
        set.insert("notes", v);
    }
    if let Some(v) = body.custom_fields {
        let mut cfd = Document::new();
        for (k, val) in v.into_iter() {
            cfd.insert(k, val);
        }
        set.insert("customFields", cfd);
    }
    if let Some(v) = body.assigned_agent_id {
        if v.is_empty() {
            set.insert("assignedAgentId", Bson::Null);
        } else {
            set.insert("assignedAgentId", v);
        }
    }
    if let Some(v) = body.blocked {
        set.insert("blocked", v);
    }
    if let Some(v) = body.source {
        set.insert("source", v);
    }

    if let Some(cid) = body.contact_id.as_deref() {
        let oid = match parse_oid(cid) {
            Some(o) => o,
            None => return err_ack("Invalid contact id."),
        };
        match coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": set },
            )
            .await
        {
            Ok(r) if r.matched_count == 0 => err_ack("Contact not found."),
            Ok(_) => Json(AckResult {
                success: true,
                contact_id: Some(cid.to_owned()),
                message: Some("Saved.".to_owned()),
                ..Default::default()
            }),
            Err(e) => err_ack(format!("mongo: {e}")),
        }
    } else {
        // Create — but try to dedupe on (projectId, botId, chatId) when
        // chatId is non-zero, otherwise on (projectId, phoneNumber).
        let chat_id = body.chat_id.unwrap_or(0);
        let mut match_doc: Option<Document> = None;
        if chat_id != 0 {
            let mut m = doc! {
                "projectId": project_oid,
                "chatId": chat_id,
            };
            if let Some(b) = bot_oid {
                m.insert("botId", b);
            } else {
                m.insert("botId", Bson::Null);
            }
            match_doc = Some(m);
        } else if let Some(ph) = phone_norm.as_deref() {
            match_doc = Some(doc! {
                "projectId": project_oid,
                "phoneNumber": ph,
            });
        }

        if let Some(m) = match_doc.as_ref() {
            if let Ok(Some(existing)) = coll.find_one(m.clone()).await {
                let id = existing.get_object_id("_id").ok().map(|o| o.to_hex());
                let upd = coll.update_one(m.clone(), doc! { "$set": set }).await;
                if let Err(e) = upd {
                    return err_ack(format!("mongo: {e}"));
                }
                return Json(AckResult {
                    success: true,
                    contact_id: id,
                    message: Some("Updated existing contact.".to_owned()),
                    ..Default::default()
                });
            }
        }

        // Insert path — fill defaults so doc-to-row doesn't trip
        set.insert("createdAt", now);
        if !set.contains_key("source") {
            set.insert("source", "manual");
        }
        if !set.contains_key("tags") {
            set.insert("tags", Vec::<String>::new());
        }
        if !set.contains_key("notes") {
            set.insert("notes", "");
        }
        if !set.contains_key("blocked") {
            set.insert("blocked", false);
        }
        if !set.contains_key("isBot") {
            set.insert("isBot", false);
        }
        if !set.contains_key("isPremium") {
            set.insert("isPremium", false);
        }
        if !set.contains_key("isVerified") {
            set.insert("isVerified", false);
        }
        if !set.contains_key("chatId") {
            set.insert("chatId", 0_i64);
        }
        if !set.contains_key("firstName") {
            set.insert("firstName", "");
        }
        if !set.contains_key("customFields") {
            set.insert("customFields", Document::new());
        }

        match coll.insert_one(set).await {
            Ok(r) => {
                let id = r
                    .inserted_id
                    .as_object_id()
                    .map(|o| o.to_hex())
                    .unwrap_or_default();
                Json(AckResult {
                    success: true,
                    contact_id: Some(id),
                    message: Some("Saved.".to_owned()),
                    ..Default::default()
                })
            }
            Err(e) => err_ack(format!("mongo: {e}")),
        }
    }
}

// ===========================================================================
// Detail / update / delete
// ===========================================================================

pub async fn detail(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Path(contact_id): Path<String>,
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
    let oid = match parse_oid(&contact_id) {
        Some(o) => o,
        None => {
            return Json(DetailResp {
                error: Some("Invalid contact id.".to_owned()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(CONTACTS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => Json(DetailResp {
            contact: doc_to_row(&d),
            error: None,
        }),
        Ok(None) => Json(DetailResp {
            error: Some("Contact not found.".to_owned()),
            ..Default::default()
        }),
        Err(e) => Json(DetailResp {
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

/// PUT /{contactId} — convenience wrapper for partial updates. We
/// re-use `UpsertBody` but force the path id over any body id.
pub async fn update(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Path(contact_id): Path<String>,
    Json(mut body): Json<UpsertBody>,
) -> Json<AckResult> {
    body.contact_id = Some(contact_id);
    upsert(user, State(s), Json(body)).await
}

pub async fn delete_contact(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Path(contact_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err_ack("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err_ack(e),
    };
    let oid = match parse_oid(&contact_id) {
        Some(o) => o,
        None => return err_ack("Invalid contact id."),
    };
    match s
        .mongo
        .collection::<Document>(CONTACTS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            contact_id: Some(contact_id),
            message: Some("Deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err_ack(format!("mongo: {e}")),
    }
}

// ===========================================================================
// Bulk
// ===========================================================================

fn ids_to_oids(ids: &[String]) -> Vec<ObjectId> {
    ids.iter().filter_map(|s| parse_oid(s)).collect()
}

pub async fn bulk_delete(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<BulkIdsBody>,
) -> Json<BulkResultResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BulkResultResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oids = ids_to_oids(&body.ids);
    if oids.is_empty() {
        return Json(BulkResultResp {
            success: false,
            error: Some("No valid ids supplied.".to_owned()),
            ..Default::default()
        });
    }
    let in_arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
    match s
        .mongo
        .collection::<Document>(CONTACTS)
        .delete_many(doc! { "_id": { "$in": in_arr }, "projectId": project_oid })
        .await
    {
        Ok(r) => Json(BulkResultResp {
            success: true,
            affected: r.deleted_count as i64,
            message: Some(format!("Deleted {}.", r.deleted_count)),
            error: None,
        }),
        Err(e) => Json(BulkResultResp {
            success: false,
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

pub async fn bulk_tag(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<BulkTagBody>,
) -> Json<BulkResultResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BulkResultResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oids = ids_to_oids(&body.ids);
    if oids.is_empty() {
        return Json(BulkResultResp {
            success: false,
            error: Some("No valid ids supplied.".to_owned()),
            ..Default::default()
        });
    }
    let add_norm = body.add.as_deref().map(normalize_tags).unwrap_or_default();
    let remove_norm = body
        .remove
        .as_deref()
        .map(normalize_tags)
        .unwrap_or_default();
    if add_norm.is_empty() && remove_norm.is_empty() {
        return Json(BulkResultResp {
            success: false,
            error: Some("Nothing to add or remove.".to_owned()),
            ..Default::default()
        });
    }
    let in_arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
    let now = bson::DateTime::now();

    // We do add first (addToSet), then remove (pull).
    let coll = s.mongo.collection::<Document>(CONTACTS);
    let mut affected: i64 = 0;
    if !add_norm.is_empty() {
        let to_set: Vec<Bson> = add_norm.into_iter().map(Bson::String).collect();
        let upd = doc! {
            "$addToSet": { "tags": { "$each": to_set } },
            "$set": { "updatedAt": now },
        };
        match coll
            .update_many(
                doc! { "_id": { "$in": in_arr.clone() }, "projectId": project_oid },
                upd,
            )
            .await
        {
            Ok(r) => affected = affected.max(r.modified_count as i64),
            Err(e) => {
                return Json(BulkResultResp {
                    success: false,
                    error: Some(format!("mongo: {e}")),
                    ..Default::default()
                });
            }
        }
    }
    if !remove_norm.is_empty() {
        let to_pull: Vec<Bson> = remove_norm.into_iter().map(Bson::String).collect();
        let upd = doc! {
            "$pull": { "tags": { "$in": to_pull } },
            "$set": { "updatedAt": now },
        };
        match coll
            .update_many(
                doc! { "_id": { "$in": in_arr }, "projectId": project_oid },
                upd,
            )
            .await
        {
            Ok(r) => affected = affected.max(r.modified_count as i64),
            Err(e) => {
                return Json(BulkResultResp {
                    success: false,
                    error: Some(format!("mongo: {e}")),
                    ..Default::default()
                });
            }
        }
    }
    Json(BulkResultResp {
        success: true,
        affected,
        message: Some(format!("Updated tags on {affected}.")),
        error: None,
    })
}

pub async fn bulk_assign(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<BulkAssignBody>,
) -> Json<BulkResultResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(BulkResultResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oids = ids_to_oids(&body.ids);
    if oids.is_empty() {
        return Json(BulkResultResp {
            success: false,
            error: Some("No valid ids supplied.".to_owned()),
            ..Default::default()
        });
    }
    let in_arr: Vec<Bson> = oids.into_iter().map(Bson::ObjectId).collect();
    let now = bson::DateTime::now();
    let set_val = match body.assigned_agent_id.as_deref() {
        Some(a) if !a.is_empty() => Bson::String(a.to_owned()),
        _ => Bson::Null,
    };
    let upd = doc! {
        "$set": {
            "assignedAgentId": set_val,
            "updatedAt": now,
        }
    };
    match s
        .mongo
        .collection::<Document>(CONTACTS)
        .update_many(
            doc! { "_id": { "$in": in_arr }, "projectId": project_oid },
            upd,
        )
        .await
    {
        Ok(r) => Json(BulkResultResp {
            success: true,
            affected: r.modified_count as i64,
            message: Some(format!("Assigned {}.", r.modified_count)),
            error: None,
        }),
        Err(e) => Json(BulkResultResp {
            success: false,
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

// ===========================================================================
// Sync from chats
// ===========================================================================

pub async fn sync_from_chats(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<SyncFromChatsBody>,
) -> Json<SyncFromChatsResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SyncFromChatsResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let mut chat_filter = doc! {
        "projectId": project_oid,
        "type": "private",
    };
    if let Some(b) = body.bot_id.as_deref().filter(|x| !x.is_empty()) {
        if let Some(oid) = parse_oid(b) {
            chat_filter.insert("botId", oid);
        }
    }

    let chats_coll = s.mongo.collection::<Document>(CHATS);
    let cursor = match chats_coll
        .find(chat_filter)
        .sort(doc! { "updatedAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(SyncFromChatsResp {
                success: false,
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let chat_docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(SyncFromChatsResp {
                success: false,
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let contacts_coll = s.mongo.collection::<Document>(CONTACTS);
    let now = bson::DateTime::now();

    let mut inserted: i64 = 0;
    let mut updated: i64 = 0;
    let scanned = chat_docs.len() as i64;

    for chat in chat_docs {
        // chatId in telegram_chats may be stored as i64 or as a string.
        let chat_id: i64 = chat
            .get_i64("chatId")
            .or_else(|_| chat.get_i32("chatId").map(i64::from))
            .ok()
            .or_else(|| {
                chat.get_str("chatId")
                    .ok()
                    .and_then(|s| s.parse::<i64>().ok())
            })
            .unwrap_or(0);
        if chat_id == 0 {
            continue;
        }
        let bot_oid = chat.get_object_id("botId").ok();
        let first_name = chat.get_str("firstName").unwrap_or("").to_owned();
        let last_name = chat.get_str("lastName").ok().map(str::to_owned);
        let username = chat.get_str("username").ok().map(str::to_owned);
        let language_code = chat.get_str("languageCode").ok().map(str::to_owned);
        let is_premium = chat.get_bool("isPremium").unwrap_or(false);
        let last_message_at = chat.get_datetime("lastMessageAt").ok().copied();

        let mut match_doc = doc! {
            "projectId": project_oid,
            "chatId": chat_id,
        };
        if let Some(b) = bot_oid {
            match_doc.insert("botId", b);
        } else {
            match_doc.insert("botId", Bson::Null);
        }

        let mut set_on_insert = doc! {
            "projectId": project_oid,
            "chatId": chat_id,
            "tags": Vec::<String>::new(),
            "notes": "",
            "blocked": false,
            "isBot": false,
            "isVerified": false,
            "customFields": Document::new(),
            "source": "sync",
            "createdAt": now,
        };
        if let Some(b) = bot_oid {
            set_on_insert.insert("botId", b);
        } else {
            set_on_insert.insert("botId", Bson::Null);
        }

        let mut set = doc! {
            "firstName": first_name,
            "isPremium": is_premium,
            "updatedAt": now,
        };
        if let Some(v) = last_name {
            set.insert("lastName", v);
        }
        if let Some(v) = username {
            set.insert("username", v);
        }
        if let Some(v) = language_code {
            set.insert("languageCode", v);
        }
        if let Some(v) = last_message_at {
            set.insert("lastInteractionAt", v);
        }

        match contacts_coll
            .update_one(
                match_doc,
                doc! {
                    "$set": set,
                    "$setOnInsert": set_on_insert,
                },
            )
            .upsert(true)
            .await
        {
            Ok(res) => {
                if res.upserted_id.is_some() {
                    inserted += 1;
                } else if res.modified_count > 0 {
                    updated += 1;
                }
            }
            Err(e) => {
                tracing::warn!("sync_from_chats upsert failed: {e}");
            }
        }
    }

    Json(SyncFromChatsResp {
        success: true,
        inserted,
        updated,
        scanned,
        error: None,
        message: Some(format!(
            "Scanned {scanned} chats — {inserted} new, {updated} updated."
        )),
    })
}

// ===========================================================================
// CSV import / export
// ===========================================================================

pub async fn import_csv(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
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
    let bot_oid = body
        .bot_id
        .as_deref()
        .filter(|b| !b.is_empty())
        .and_then(parse_oid);

    let coll = s.mongo.collection::<Document>(CONTACTS);
    let now = bson::DateTime::now();

    // "replace" mode wipes existing contacts for this scope first.
    if mode == "replace" {
        let mut wipe = doc! { "projectId": project_oid };
        if let Some(b) = bot_oid {
            wipe.insert("botId", b);
        }
        let _ = coll.delete_many(wipe).await;
    }

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
    let i_chat = idx("chatid").or_else(|| idx("chat_id"));
    let i_first = idx("firstname").or_else(|| idx("first_name"));
    let i_last = idx("lastname").or_else(|| idx("last_name"));
    let i_user = idx("username");
    let i_phone = idx("phonenumber")
        .or_else(|| idx("phone_number"))
        .or_else(|| idx("phone"));
    let i_lang = idx("languagecode")
        .or_else(|| idx("language_code"))
        .or_else(|| idx("language"));
    let i_tags = idx("tags");
    let i_notes = idx("notes");

    let mut inserted: i64 = 0;
    let mut updated: i64 = 0;
    let mut skipped: i64 = 0;

    for record in reader.records() {
        let Ok(rec) = record else {
            skipped += 1;
            continue;
        };
        let chat_id_str = i_chat
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();
        let chat_id: i64 = chat_id_str.parse::<i64>().unwrap_or(0);
        let first_name = i_first
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();
        let last_name = i_last
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        let username = i_user
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().trim_start_matches('@').to_owned())
            .filter(|s| !s.is_empty());
        let phone_raw = i_phone
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        let phone = phone_raw
            .as_deref()
            .map(normalize_phone)
            .filter(|s| !s.is_empty());
        let language = i_lang
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());
        let tags_field = i_tags
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();
        let tags: Vec<String> = if tags_field.is_empty() {
            vec![]
        } else {
            normalize_tags(
                &tags_field
                    .split(';')
                    .map(|s| s.to_owned())
                    .collect::<Vec<_>>(),
            )
        };
        let notes = i_notes
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_owned())
            .unwrap_or_default();

        // Need at least one identifier
        if chat_id == 0 && phone.is_none() && username.is_none() {
            skipped += 1;
            continue;
        }

        let mut match_doc: Document;
        if chat_id != 0 {
            match_doc = doc! { "projectId": project_oid, "chatId": chat_id };
            if let Some(b) = bot_oid {
                match_doc.insert("botId", b);
            } else {
                match_doc.insert("botId", Bson::Null);
            }
        } else if let Some(p) = phone.as_deref() {
            match_doc = doc! { "projectId": project_oid, "phoneNumber": p };
        } else if let Some(u) = username.as_deref() {
            match_doc = doc! { "projectId": project_oid, "username": u };
        } else {
            skipped += 1;
            continue;
        }

        let existing = coll.find_one(match_doc.clone()).await.ok().flatten();

        let mut set = doc! {
            "projectId": project_oid,
            "firstName": first_name,
            "updatedAt": now,
        };
        if let Some(v) = last_name {
            set.insert("lastName", v);
        }
        if let Some(v) = username {
            set.insert("username", v);
        }
        if let Some(v) = phone {
            set.insert("phoneNumber", v);
        }
        if let Some(v) = language {
            set.insert("languageCode", v);
        }
        if !notes.is_empty() {
            set.insert("notes", notes);
        }
        if chat_id != 0 {
            set.insert("chatId", chat_id);
        }
        if let Some(b) = bot_oid {
            set.insert("botId", b);
        }

        if existing.is_some() {
            // Merge tags rather than replace.
            let update_doc = if tags.is_empty() {
                doc! { "$set": set }
            } else {
                let each: Vec<Bson> = tags.iter().map(|t| Bson::String(t.clone())).collect();
                doc! {
                    "$set": set,
                    "$addToSet": { "tags": { "$each": each } },
                }
            };
            match coll.update_one(match_doc, update_doc).await {
                Ok(_) => updated += 1,
                Err(_) => skipped += 1,
            }
        } else {
            set.insert("createdAt", now);
            set.insert("source", "csv");
            set.insert("blocked", false);
            set.insert("isBot", false);
            set.insert("isPremium", false);
            set.insert("isVerified", false);
            set.insert("customFields", Document::new());
            set.insert("tags", tags);
            if !set.contains_key("notes") {
                set.insert("notes", "");
            }
            if !set.contains_key("chatId") {
                set.insert("chatId", 0_i64);
            }
            if !set.contains_key("botId") {
                if let Some(b) = bot_oid {
                    set.insert("botId", b);
                } else {
                    set.insert("botId", Bson::Null);
                }
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
    State(s): State<TelegramContactsState>,
    Query(q): Query<ListQuery>,
) -> Response {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "projectId is required").into_response(),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    let filter = build_list_filter(project_oid, &q);

    let cursor = match s
        .mongo
        .collection::<Document>(CONTACTS)
        .find(filter)
        .sort(doc! { "updatedAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("mongo: {e}")).into_response();
        }
    };
    let rows: Vec<ContactRow> = docs.iter().filter_map(doc_to_row).collect();

    let mut body = String::from(
        "chatId,firstName,lastName,username,phoneNumber,languageCode,tags,notes,blocked,createdAt,updatedAt\n",
    );
    for r in rows {
        body.push_str(&r.chat_id.to_string());
        body.push(',');
        body.push_str(&csv_escape(&r.first_name));
        body.push(',');
        body.push_str(&csv_escape(r.last_name.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.username.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.phone_number.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(r.language_code.as_deref().unwrap_or("")));
        body.push(',');
        body.push_str(&csv_escape(&r.tags.join(";")));
        body.push(',');
        body.push_str(&csv_escape(&r.notes));
        body.push(',');
        body.push_str(&r.blocked.to_string());
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
        HeaderValue::from_static("attachment; filename=\"telegram-contacts.csv\""),
    );
    (StatusCode::OK, headers, body).into_response()
}

// ===========================================================================
// Segments
// ===========================================================================

/// Convert a Bson value into a plain `serde_json::Value`. We use this
/// for our segment filter shape — which only ever contains strings,
/// bools and ints — so we deliberately collapse types not present in
/// JSON (ObjectId / DateTime / etc.) into their plain representations
/// rather than emit MongoDB extended JSON envelopes that would break
/// re-deserializing into `ListQuery`.
fn bson_to_plain_json(b: &Bson) -> serde_json::Value {
    use serde_json::Value;
    match b {
        Bson::Double(f) => serde_json::Number::from_f64(*f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(s) => Value::String(s.clone()),
        Bson::Array(arr) => Value::Array(arr.iter().map(bson_to_plain_json).collect()),
        Bson::Document(d) => {
            let mut map = serde_json::Map::new();
            for (k, v) in d.iter() {
                map.insert(k.clone(), bson_to_plain_json(v));
            }
            Value::Object(map)
        }
        Bson::Boolean(b) => Value::Bool(*b),
        Bson::Null => Value::Null,
        Bson::Int32(i) => Value::Number((*i).into()),
        Bson::Int64(i) => Value::Number((*i).into()),
        Bson::ObjectId(o) => Value::String(o.to_hex()),
        Bson::DateTime(dt) => Value::String(dt.try_to_rfc3339_string().unwrap_or_default()),
        _ => Value::Null,
    }
}

fn doc_filter_to_json(d: Option<&Document>) -> serde_json::Value {
    match d {
        Some(d) => bson_to_plain_json(&Bson::Document(d.clone())),
        None => serde_json::Value::Object(Default::default()),
    }
}

fn doc_to_segment(d: &Document, member_count: i64) -> Option<SegmentRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let filter = doc_filter_to_json(d.get_document("filter").ok());
    Some(SegmentRow {
        _id,
        project_id,
        name: d.get_str("name").unwrap_or("").to_owned(),
        description: d.get_str("description").ok().map(str::to_owned),
        filter,
        member_count,
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn json_filter_to_list_query(v: &serde_json::Value) -> ListQuery {
    serde_json::from_value::<ListQuery>(v.clone()).unwrap_or_default()
}

pub async fn list_segments(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListSegmentsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListSegmentsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListSegmentsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(SEGMENTS)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "updatedAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListSegmentsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListSegmentsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    // member count per segment — evaluate the filter and count.
    let contacts = s.mongo.collection::<Document>(CONTACTS);
    let mut out: Vec<SegmentRow> = Vec::with_capacity(docs.len());
    for d in docs.iter() {
        let filter_json = doc_filter_to_json(d.get_document("filter").ok());
        let lq = json_filter_to_list_query(&filter_json);
        let f = build_list_filter(project_oid, &lq);
        let count = contacts.count_documents(f).await.unwrap_or(0) as i64;
        if let Some(row) = doc_to_segment(d, count) {
            out.push(row);
        }
    }
    Json(ListSegmentsResp {
        segments: out,
        error: None,
    })
}

pub async fn create_segment(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<CreateSegmentBody>,
) -> Json<SegmentAckResult> {
    if body.name.trim().is_empty() {
        return Json(SegmentAckResult {
            success: false,
            error: Some("Name is required.".to_owned()),
            ..Default::default()
        });
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SegmentAckResult {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let filter_bson = match bson::to_bson(&body.filter) {
        Ok(b) => b,
        Err(e) => {
            return Json(SegmentAckResult {
                success: false,
                error: Some(format!("filter: {e}")),
                ..Default::default()
            });
        }
    };
    let filter_doc = match filter_bson.as_document() {
        Some(d) => d.clone(),
        None => Document::new(),
    };
    let now = bson::DateTime::now();
    let mut d = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "filter": filter_doc,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(desc) = body.description {
        d.insert("description", desc);
    }
    match s.mongo.collection::<Document>(SEGMENTS).insert_one(d).await {
        Ok(r) => Json(SegmentAckResult {
            success: true,
            segment_id: r.inserted_id.as_object_id().map(|o| o.to_hex()),
            message: Some("Saved.".to_owned()),
            error: None,
        }),
        Err(e) => Json(SegmentAckResult {
            success: false,
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

pub async fn delete_segment(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Path(segment_id): Path<String>,
    Query(q): Query<ListQuery>,
) -> Json<SegmentAckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SegmentAckResult {
                success: false,
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SegmentAckResult {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&segment_id) {
        Some(o) => o,
        None => {
            return Json(SegmentAckResult {
                success: false,
                error: Some("Invalid segment id.".to_owned()),
                ..Default::default()
            });
        }
    };
    match s
        .mongo
        .collection::<Document>(SEGMENTS)
        .delete_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(SegmentAckResult {
            success: true,
            segment_id: Some(segment_id),
            message: Some("Deleted.".to_owned()),
            error: None,
        }),
        Err(e) => Json(SegmentAckResult {
            success: false,
            error: Some(format!("mongo: {e}")),
            ..Default::default()
        }),
    }
}

pub async fn segment_contacts(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Path(segment_id): Path<String>,
    Query(q): Query<SegmentContactsQuery>,
) -> Json<SegmentContactsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SegmentContactsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(SegmentContactsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let oid = match parse_oid(&segment_id) {
        Some(o) => o,
        None => {
            return Json(SegmentContactsResp {
                error: Some("Invalid segment id.".to_owned()),
                ..Default::default()
            });
        }
    };
    let seg_doc = match s
        .mongo
        .collection::<Document>(SEGMENTS)
        .find_one(doc! { "_id": oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(SegmentContactsResp {
                error: Some("Segment not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(SegmentContactsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let filter_json = doc_filter_to_json(seg_doc.get_document("filter").ok());
    let lq = json_filter_to_list_query(&filter_json);
    let mut f = build_list_filter(project_oid, &lq);

    let limit = q.limit.unwrap_or(50).clamp(1, 200);

    // Cursor = last "_id" hex from previous page
    if let Some(c) = q.cursor.as_deref() {
        if let Some(c_oid) = parse_oid(c) {
            f.insert("_id", doc! { "$lt": c_oid });
        }
    }

    let coll = s.mongo.collection::<Document>(CONTACTS);
    // Use a total based on the unfiltered (no-cursor) version
    let mut count_filter = build_list_filter(project_oid, &lq);
    // ensure cursor doesn't leak
    count_filter.remove("_id");
    let total = coll.count_documents(count_filter).await.unwrap_or(0) as i64;

    let cursor = match coll.find(f).sort(doc! { "_id": -1 }).limit(limit).await {
        Ok(c) => c,
        Err(e) => {
            return Json(SegmentContactsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(SegmentContactsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let next_cursor = docs
        .last()
        .and_then(|d| d.get_object_id("_id").ok())
        .map(|o| o.to_hex());
    let has_more = docs.len() as i64 == limit;
    let contacts: Vec<ContactRow> = docs.iter().filter_map(doc_to_row).collect();
    Json(SegmentContactsResp {
        contacts,
        next_cursor,
        has_more,
        total,
        error: None,
    })
}

// ===========================================================================
// Analytics
// ===========================================================================

pub async fn analytics(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
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

    let mut base_filter = doc! { "projectId": project_oid };
    if let Some(b) = q.bot_id.as_deref().filter(|x| !x.is_empty()) {
        if let Some(oid) = parse_oid(b) {
            base_filter.insert("botId", oid);
        }
    }

    let coll = s.mongo.collection::<Document>(CONTACTS);

    let total = coll.count_documents(base_filter.clone()).await.unwrap_or(0) as i64;

    let mut created_filter = base_filter.clone();
    created_filter.insert(
        "createdAt",
        doc! {
            "$gte": bson::DateTime::from_millis(from.timestamp_millis()),
            "$lte": bson::DateTime::from_millis(to.timestamp_millis()),
        },
    );
    let new_in_range = coll
        .count_documents(created_filter.clone())
        .await
        .unwrap_or(0) as i64;

    // Churned = no interaction in last 30 days
    let cutoff_30 = now - Duration::days(30);
    let mut churned_filter = base_filter.clone();
    churned_filter.insert(
        "$or",
        vec![
            doc! { "lastInteractionAt": { "$lt": bson::DateTime::from_millis(cutoff_30.timestamp_millis()) } },
            doc! { "lastInteractionAt": Bson::Null },
            doc! { "lastInteractionAt": { "$exists": false } },
        ],
    );
    let churned = coll.count_documents(churned_filter).await.unwrap_or(0) as i64;

    // Fetch contacts in range for tag + language breakdown + day series.
    let cursor = match coll.find(created_filter).await {
        Ok(c) => c,
        Err(e) => {
            return Json(AnalyticsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();

    let mut tag_counts: HashMap<String, i64> = HashMap::new();
    let mut lang_counts: HashMap<String, i64> = HashMap::new();
    use std::collections::BTreeMap;
    let mut day: BTreeMap<String, i64> = BTreeMap::new();

    let mut cur_day = from.date_naive();
    let end_day = to.date_naive();
    let mut guard = 0;
    while cur_day <= end_day && guard < 400 {
        day.insert(cur_day.format("%Y-%m-%d").to_string(), 0);
        match cur_day.succ_opt() {
            Some(n) => cur_day = n,
            None => break,
        }
        guard += 1;
    }

    for d in &docs {
        let created = dt(d.get_datetime("createdAt").ok().copied());
        let key = format!(
            "{:04}-{:02}-{:02}",
            created.year(),
            created.month(),
            created.day()
        );
        *day.entry(key).or_insert(0) += 1;
        if let Ok(arr) = d.get_array("tags") {
            for t in arr {
                if let Some(s) = t.as_str() {
                    *tag_counts.entry(s.to_owned()).or_insert(0) += 1;
                }
            }
        }
        if let Ok(lc) = d.get_str("languageCode") {
            *lang_counts.entry(lc.to_owned()).or_insert(0) += 1;
        }
    }

    // Top tags global (across all contacts, not just in range) for the chip suggestion.
    let cursor_all = coll.find(base_filter.clone()).await;
    if let Ok(c) = cursor_all {
        let docs_all: Vec<Document> = c.try_collect().await.unwrap_or_default();
        for d in &docs_all {
            if let Ok(arr) = d.get_array("tags") {
                for t in arr {
                    if let Some(s) = t.as_str() {
                        *tag_counts.entry(s.to_owned()).or_insert(0) += 1;
                    }
                }
            }
            if let Ok(lc) = d.get_str("languageCode") {
                *lang_counts.entry(lc.to_owned()).or_insert(0) += 1;
            }
        }
    }

    let mut top_tags: Vec<TagCount> = tag_counts
        .into_iter()
        .map(|(tag, count)| TagCount { tag, count })
        .collect();
    top_tags.sort_by(|a, b| b.count.cmp(&a.count));
    top_tags.truncate(10);

    let mut languages: Vec<LanguageCount> = lang_counts
        .into_iter()
        .map(|(code, count)| LanguageCount { code, count })
        .collect();
    languages.sort_by(|a, b| b.count.cmp(&a.count));
    languages.truncate(20);

    let by_day: Vec<DayPoint> = day
        .into_iter()
        .map(|(date, count)| DayPoint { date, count })
        .collect();

    Json(AnalyticsResp {
        total,
        new_in_range,
        churned,
        top_tags,
        languages,
        by_day,
        error: None,
    })
}

// ===========================================================================
// Resolve (called from webhook hook)
// ===========================================================================

/// Pure-Rust callable so future webhook integrations can resolve a
/// Telegram user into a contact without going through HTTP.
pub async fn resolve_contact(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
    chat_id: i64,
    first_name: Option<String>,
    last_name: Option<String>,
    username: Option<String>,
    language_code: Option<String>,
    is_bot: Option<bool>,
    is_premium: Option<bool>,
    is_verified: Option<bool>,
) -> Result<ContactRow, String> {
    let now = bson::DateTime::now();
    let coll = mongo.collection::<Document>(CONTACTS);

    let mut match_doc = doc! {
        "projectId": project_oid,
        "chatId": chat_id,
    };
    if let Some(b) = bot_oid {
        match_doc.insert("botId", b);
    } else {
        match_doc.insert("botId", Bson::Null);
    }

    let mut set = doc! {
        "updatedAt": now,
        "lastInteractionAt": now,
    };
    if let Some(v) = first_name {
        set.insert("firstName", v);
    }
    if let Some(v) = last_name {
        set.insert("lastName", v);
    }
    if let Some(v) = username {
        set.insert("username", v);
    }
    if let Some(v) = language_code {
        set.insert("languageCode", v);
    }
    if let Some(v) = is_bot {
        set.insert("isBot", v);
    }
    if let Some(v) = is_premium {
        set.insert("isPremium", v);
    }
    if let Some(v) = is_verified {
        set.insert("isVerified", v);
    }

    let mut set_on_insert = doc! {
        "projectId": project_oid,
        "chatId": chat_id,
        "createdAt": now,
        "source": "webhook",
        "tags": Vec::<String>::new(),
        "notes": "",
        "blocked": false,
        "customFields": Document::new(),
    };
    if let Some(b) = bot_oid {
        set_on_insert.insert("botId", b);
    } else {
        set_on_insert.insert("botId", Bson::Null);
    }
    // Ensure required default flags exist on insert even if caller didn't pass them.
    if !set.contains_key("isBot") {
        set_on_insert.insert("isBot", false);
    }
    if !set.contains_key("isPremium") {
        set_on_insert.insert("isPremium", false);
    }
    if !set.contains_key("isVerified") {
        set_on_insert.insert("isVerified", false);
    }
    if !set.contains_key("firstName") {
        set_on_insert.insert("firstName", "");
    }

    coll.update_one(
        match_doc.clone(),
        doc! {
            "$set": set,
            "$setOnInsert": set_on_insert,
        },
    )
    .upsert(true)
    .await
    .map_err(|e| format!("mongo: {e}"))?;

    let d = coll
        .find_one(match_doc)
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "resolve: contact disappeared after upsert".to_owned())?;
    doc_to_row(&d).ok_or_else(|| "resolve: malformed contact doc".to_owned())
}

pub async fn resolve(
    user: AuthUser,
    State(s): State<TelegramContactsState>,
    Json(body): Json<ResolveBody>,
) -> Json<ResolveResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ResolveResp {
                success: false,
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = parse_oid(&body.bot_id);
    match resolve_contact(
        &s.mongo,
        project_oid,
        bot_oid,
        body.chat_id,
        body.first_name,
        body.last_name,
        body.username,
        body.language_code,
        body.is_bot,
        body.is_premium,
        body.is_verified,
    )
    .await
    {
        Ok(contact) => Json(ResolveResp {
            success: true,
            contact: Some(contact),
            error: None,
        }),
        Err(e) => Json(ResolveResp {
            success: false,
            error: Some(e),
            ..Default::default()
        }),
    }
}
