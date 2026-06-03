//! HTTP handlers for the telegram-stickers router.
//!
//! Every endpoint enforces project ownership via `require_project_bot`
//! before touching Mongo or the Telegram Bot API.  Sticker payloads are
//! uploaded server-side (the dashboard hands us a SabFile URL; we pull
//! the bytes through our own reqwest client and forward them to
//! `uploadStickerFile`).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use std::sync::OnceLock;

use crate::bot_api::{
    BotApiError, MaskPosition, StickerSetInfo, fetch_url_bytes, sticker_format_for_mime,
};
use crate::dto::{
    AckResult, AddStickerBody, CreateBody, EmojiListBody, KeywordsBody, ListResp, MaskPositionBody,
    MaskPositionDto, PositionBody, ProjectBotQuery, ReplaceStickerBody, SetResp, SetRow,
    SetThumbnailBody, SetTitleBody, StickerInputBody, StickerRow,
};
use crate::state::TelegramStickersState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const SETS: &str = "telegram_sticker_sets";

const MAX_EMOJIS_PER_STICKER: usize = 20;
const MAX_KEYWORDS: usize = 20;

// =========================================================================
//  Helpers
// =========================================================================

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

fn dt(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

fn dt_opt(o: Option<bson::DateTime>) -> Option<chrono::DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

fn name_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[A-Za-z0-9_]+$").unwrap())
}

fn err_msg(e: BotApiError) -> String {
    match e {
        BotApiError::Api(s) => s,
        BotApiError::Transport(e) => format!("network: {e}"),
    }
}

/// Split an emoji-or-list string into the array Telegram expects.
fn split_emojis(s: &str) -> Vec<String> {
    // Allow callers to send either a single string of emojis ("🐱🐶")
    // or a comma/whitespace-separated list ("🐱, 🐶").
    let cleaned = s.trim();
    if cleaned.is_empty() {
        return vec![];
    }
    if cleaned.contains(',') || cleaned.contains(char::is_whitespace) {
        return cleaned
            .split(|c: char| c == ',' || c.is_whitespace())
            .filter(|p| !p.is_empty())
            .map(str::to_owned)
            .collect();
    }
    // Single contiguous string — treat each non-ASCII codepoint cluster
    // as one emoji.  Falls back to the whole string when we can't split.
    let mut out: Vec<String> = vec![];
    for c in cleaned.chars() {
        if c.is_ascii_alphanumeric() {
            // Skip stray ASCII glyphs.
            continue;
        }
        out.push(c.to_string());
    }
    if out.is_empty() {
        vec![cleaned.to_owned()]
    } else {
        out
    }
}

async fn require_project_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
    bot_id: &str,
) -> Result<(ObjectId, Document), String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let bot_oid = parse_oid(bot_id).ok_or_else(|| "invalid bot id".to_owned())?;
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

    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid, "projectId": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;

    Ok((project_oid, bot))
}

fn doc_to_row(d: &Document) -> Option<SetRow> {
    let _id = d.get_object_id("_id").ok()?.to_hex();
    let project_id = d.get_object_id("projectId").ok()?.to_hex();
    let bot_id = d.get_object_id("botId").ok()?.to_hex();
    let name = d.get_str("name").unwrap_or("").to_owned();
    let title = d.get_str("title").unwrap_or("").to_owned();
    let sticker_type = d.get_str("stickerType").unwrap_or("regular").to_owned();
    let thumbnail_file_id = d.get_str("thumbnailFileId").ok().map(str::to_owned);
    let thumbnail_url = d.get_str("thumbnailUrl").ok().map(str::to_owned);
    let archived = d.get_bool("archived").unwrap_or(false);
    let sticker_count = d
        .get_i64("stickerCount")
        .or_else(|_| d.get_i32("stickerCount").map(i64::from))
        .unwrap_or(0);

    let stickers = d
        .get_array("stickers")
        .ok()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(idx, b)| {
                    let s = b.as_document()?;
                    Some(StickerRow {
                        file_id: s.get_str("fileId").unwrap_or("").to_owned(),
                        emoji: s.get_str("emoji").unwrap_or("").to_owned(),
                        keywords: s
                            .get_array("keywords")
                            .ok()
                            .map(|a| {
                                a.iter()
                                    .filter_map(|v| v.as_str().map(str::to_owned))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        mask_position: s.get_document("maskPosition").ok().and_then(|m| {
                            Some(MaskPositionDto {
                                point: m.get_str("point").ok()?.to_owned(),
                                x_shift: m.get_f64("xShift").ok()?,
                                y_shift: m.get_f64("yShift").ok()?,
                                scale: m.get_f64("scale").ok()?,
                            })
                        }),
                        position_in_set: s
                            .get_i64("positionInSet")
                            .or_else(|_| s.get_i32("positionInSet").map(i64::from))
                            .unwrap_or(idx as i64),
                        r#type: s.get_str("type").ok().map(str::to_owned),
                        sab_file_id: s.get_str("sabFileId").ok().map(str::to_owned),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(SetRow {
        _id,
        project_id,
        bot_id,
        name,
        title,
        sticker_type,
        thumbnail_file_id,
        thumbnail_url,
        stickers,
        sticker_count,
        archived,
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
        last_synced_at: dt_opt(d.get_datetime("lastSyncedAt").ok().copied()),
    })
}

fn validate_set_name(name: &str, bot_username: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("Pack name is required.".to_owned());
    }
    if name.len() > 64 {
        return Err("Pack name must be 64 characters or fewer.".to_owned());
    }
    let suffix = format!("_by_{bot_username}");
    let candidate = if name.ends_with(&suffix) {
        name.to_owned()
    } else {
        format!("{name}{suffix}")
    };
    // Sanity-check that the full name only uses ASCII alnum + `_`.
    if !name_regex().is_match(&candidate) {
        return Err(format!(
            "Pack name must match [A-Za-z0-9_]+_by_{bot_username}"
        ));
    }
    Ok(candidate)
}

fn validate_emoji_list(list: &[String]) -> Result<(), String> {
    if list.is_empty() {
        return Err("At least one emoji is required per sticker.".to_owned());
    }
    if list.len() > MAX_EMOJIS_PER_STICKER {
        return Err(format!(
            "Up to {MAX_EMOJIS_PER_STICKER} emoji are allowed per sticker."
        ));
    }
    Ok(())
}

fn validate_keywords(kw: &[String]) -> Result<(), String> {
    if kw.len() > MAX_KEYWORDS {
        return Err(format!("Up to {MAX_KEYWORDS} keywords are allowed."));
    }
    Ok(())
}

/// Convert a [`StickerSetInfo`] from the Bot API into a `$set` patch
/// for the mirror document.
fn set_info_to_patch(info: &StickerSetInfo) -> Document {
    let stickers: Vec<Bson> = info
        .stickers
        .iter()
        .enumerate()
        .map(|(idx, s)| {
            let mut doc = doc! {
                "fileId": &s.file_id,
                "emoji": s.emoji.clone().unwrap_or_default(),
                "type": &info.sticker_type,
                "positionInSet": idx as i64,
            };
            if let Some(mp) = &s.mask_position {
                doc.insert(
                    "maskPosition",
                    doc! {
                        "point": &mp.point,
                        "xShift": mp.x_shift,
                        "yShift": mp.y_shift,
                        "scale": mp.scale,
                    },
                );
            }
            Bson::Document(doc)
        })
        .collect();

    let thumbnail_file_id = info
        .thumbnail
        .as_ref()
        .and_then(|t| t.get("file_id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let mut patch = doc! {
        "title": &info.title,
        "stickerType": &info.sticker_type,
        "stickers": stickers,
        "stickerCount": info.stickers.len() as i64,
        "updatedAt": bson::DateTime::now(),
        "lastSyncedAt": bson::DateTime::now(),
    };
    if let Some(fid) = thumbnail_file_id {
        patch.insert("thumbnailFileId", fid);
    }
    patch
}

/// Pull bytes for the supplied sticker input and forward them to
/// `uploadStickerFile`.  Returns the resulting Telegram `file_id`.
async fn upload_sticker(
    s: &TelegramStickersState,
    token: &str,
    user_id: i64,
    sticker: &StickerInputBody,
    _sticker_type: &str,
) -> Result<(String, String), String> {
    let (bytes, mime, derived_name) = fetch_url_bytes(&s.http, &sticker.sab_file_url)
        .await
        .map_err(|e| format!("download from SabFiles failed: {e}"))?;
    let format = sticker_format_for_mime(&mime);
    let file_name = sticker.sab_file_name.clone().unwrap_or(derived_name);
    let uploaded = s
        .bot_api
        .upload_sticker_file(token, user_id, format, &file_name, &mime, bytes)
        .await
        .map_err(err_msg)?;
    Ok((uploaded.file_id, format.to_owned()))
}

/// Refresh a single set from Telegram and persist the result.  Returns
/// the latest `SetRow` (or the local mirror if Telegram refuses).
async fn refresh_one(
    s: &TelegramStickersState,
    token: &str,
    set_name: &str,
    bot_oid: ObjectId,
    project_oid: ObjectId,
) -> Option<SetRow> {
    let info = match s.bot_api.get_sticker_set(token, set_name).await {
        Ok(info) => info,
        Err(_) => return None,
    };
    let patch = set_info_to_patch(&info);
    let coll = s.mongo.collection::<Document>(SETS);
    let _ = coll
        .update_one(
            doc! { "name": set_name, "botId": bot_oid, "projectId": project_oid },
            doc! { "$set": patch },
        )
        .await;
    let updated = coll
        .find_one(doc! { "name": set_name, "botId": bot_oid })
        .await
        .ok()
        .flatten()?;
    doc_to_row(&updated)
}

// =========================================================================
//  GET /  — list sets for the (project, bot)
// =========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                sets: vec![],
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                sets: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let (project_oid, bot) = match require_project_bot(&user, &s.mongo, project_id, bot_id).await {
        Ok(r) => r,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                sets: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let token = bot.get_str("token").unwrap_or("").to_owned();

    let cursor = match s
        .mongo
        .collection::<Document>(SETS)
        .find(doc! { "botId": bot_oid, "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                sets: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let mut sets: Vec<SetRow> = docs.iter().filter_map(doc_to_row).collect();

    // Optionally refresh from Telegram so live counts/order stay fresh.
    if q.refresh.unwrap_or(false) && !token.is_empty() {
        for row in &mut sets {
            if row.archived {
                continue;
            }
            if let Some(updated) = refresh_one(&s, &token, &row.name, bot_oid, project_oid).await {
                *row = updated;
            }
        }
    }

    Json(ListResp { sets, error: None })
}

// =========================================================================
//  GET /{set_name}  — refresh + return a single set
// =========================================================================

pub async fn get_set(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_name): Path<String>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<SetResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SetResp {
                set: None,
                error: Some("projectId is required".to_owned()),
            });
        }
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(SetResp {
                set: None,
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let (project_oid, bot) = match require_project_bot(&user, &s.mongo, project_id, bot_id).await {
        Ok(r) => r,
        Err(e) => {
            return Json(SetResp {
                set: None,
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(SetResp {
                set: None,
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let token = bot.get_str("token").unwrap_or("").to_owned();

    if let Some(row) = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await {
        return Json(SetResp {
            set: Some(row),
            error: None,
        });
    }
    // Fall back to whatever we have in Mongo.
    let local = s
        .mongo
        .collection::<Document>(SETS)
        .find_one(doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid })
        .await
        .ok()
        .flatten()
        .and_then(|d| doc_to_row(&d));
    Json(SetResp {
        set: local,
        error: None,
    })
}

// =========================================================================
//  POST /  — createNewStickerSet + mirror
// =========================================================================

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    if body.title.trim().is_empty() {
        return err("title is required");
    }
    if body.stickers.is_empty() {
        return err("At least one sticker is required to create a pack.");
    }
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    let username = bot.get_str("username").unwrap_or("").to_owned();
    if username.is_empty() {
        return err("Bot is missing its username — reconnect the bot.");
    }
    let full_name = match validate_set_name(&body.name, &username) {
        Ok(n) => n,
        Err(e) => return err(e),
    };
    let sticker_type = body
        .sticker_type
        .clone()
        .unwrap_or_else(|| "regular".to_owned());
    if !["regular", "mask", "custom_emoji"].contains(&sticker_type.as_str()) {
        return err("stickerType must be one of regular | mask | custom_emoji");
    }

    // Validate every sticker payload up-front before we burn a single
    // Telegram round-trip.
    for (i, st) in body.stickers.iter().enumerate() {
        let emojis = split_emojis(&st.emoji);
        if let Err(e) = validate_emoji_list(&emojis) {
            return err(format!("sticker[{i}]: {e}"));
        }
        if let Some(kw) = &st.keywords {
            if let Err(e) = validate_keywords(kw) {
                return err(format!("sticker[{i}]: {e}"));
            }
        }
        if st.sab_file_url.is_empty() {
            return err(format!("sticker[{i}]: sabFileUrl is required"));
        }
        if sticker_type == "mask" && st.mask_position.is_none() {
            return err(format!(
                "sticker[{i}]: maskPosition is required for mask packs"
            ));
        }
    }

    // Upload every file, then call createNewStickerSet with the full
    // list at once (Telegram lets you seed a pack with up to 50).
    let mut input_stickers: Vec<serde_json::Value> = Vec::with_capacity(body.stickers.len());
    let mut local_stickers: Vec<Bson> = Vec::with_capacity(body.stickers.len());
    for (idx, st) in body.stickers.iter().enumerate() {
        let (file_id, format) =
            match upload_sticker(&s, &token, body.user_id, st, &sticker_type).await {
                Ok(v) => v,
                Err(e) => return err(format!("sticker[{idx}]: {e}")),
            };
        let emojis = split_emojis(&st.emoji);
        let kw = st.keywords.clone().unwrap_or_default();
        let mut wire = serde_json::json!({
            "sticker": file_id,
            "format": format,
            "emoji_list": emojis,
        });
        if !kw.is_empty() {
            wire["keywords"] = serde_json::Value::Array(
                kw.iter()
                    .map(|k| serde_json::Value::String(k.clone()))
                    .collect(),
            );
        }
        if let Some(mp) = &st.mask_position {
            wire["mask_position"] = serde_json::json!({
                "point": mp.point,
                "x_shift": mp.x_shift,
                "y_shift": mp.y_shift,
                "scale": mp.scale,
            });
        }
        input_stickers.push(wire);

        let mut s_doc = doc! {
            "fileId": &file_id,
            "emoji": emojis.join(""),
            "keywords": kw.clone(),
            "positionInSet": idx as i64,
            "type": &sticker_type,
        };
        if let Some(sab_id) = &st.sab_file_id {
            s_doc.insert("sabFileId", sab_id.clone());
        }
        if let Some(mp) = &st.mask_position {
            s_doc.insert(
                "maskPosition",
                doc! {
                    "point": &mp.point,
                    "xShift": mp.x_shift,
                    "yShift": mp.y_shift,
                    "scale": mp.scale,
                },
            );
        }
        local_stickers.push(Bson::Document(s_doc));
    }

    let create_body = serde_json::json!({
        "user_id": body.user_id,
        "name": full_name,
        "title": body.title.trim(),
        "stickers": input_stickers,
        "sticker_type": sticker_type,
    });

    if let Err(e) = s.bot_api.create_new_sticker_set(&token, &create_body).await {
        return err(err_msg(e));
    }

    let now = bson::DateTime::now();
    let mirror = doc! {
        "projectId": project_oid,
        "botId": bot_oid,
        "name": &full_name,
        "title": body.title.trim(),
        "stickerType": &sticker_type,
        "stickers": local_stickers,
        "stickerCount": body.stickers.len() as i64,
        "archived": false,
        "createdAt": now,
        "updatedAt": now,
        "lastSyncedAt": now,
    };
    let inserted = s
        .mongo
        .collection::<Document>(SETS)
        .insert_one(mirror)
        .await;
    let set_id = match inserted {
        Ok(r) => r
            .inserted_id
            .as_object_id()
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        Err(e) => return err(format!("mongo: {e}")),
    };

    Json(AckResult {
        success: true,
        set_id: Some(set_id),
        message: Some(format!("Sticker pack “{full_name}” created.")),
        ..Default::default()
    })
}

// =========================================================================
//  DELETE /{set_name}  — soft-archive (Telegram has no deleteStickerSet)
// =========================================================================

pub async fn archive_set(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_name): Path<String>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("botId is required"),
    };
    let (project_oid, bot) = match require_project_bot(&user, &s.mongo, project_id, bot_id).await {
        Ok(r) => r,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };

    let r = s
        .mongo
        .collection::<Document>(SETS)
        .update_one(
            doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid },
            doc! { "$set": {
                "archived": true,
                "updatedAt": bson::DateTime::now(),
            } },
        )
        .await;
    match r {
        Ok(r) if r.matched_count == 0 => err("Sticker pack not found."),
        Ok(_) => Json(AckResult {
            success: true,
            message: Some(
                "Telegram does not support deleting sticker sets — pack archived locally."
                    .to_owned(),
            ),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// =========================================================================
//  POST /{set_name}/add  — uploadStickerFile + addStickerToSet
// =========================================================================

pub async fn add_sticker(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_name): Path<String>,
    Json(body): Json<AddStickerBody>,
) -> Json<AckResult> {
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    // Confirm the set exists locally and pick up its sticker type.
    let local = match s
        .mongo
        .collection::<Document>(SETS)
        .find_one(doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Sticker pack not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let sticker_type = local.get_str("stickerType").unwrap_or("regular").to_owned();

    let emojis = split_emojis(&body.sticker.emoji);
    if let Err(e) = validate_emoji_list(&emojis) {
        return err(e);
    }
    if let Some(kw) = &body.sticker.keywords {
        if let Err(e) = validate_keywords(kw) {
            return err(e);
        }
    }
    if sticker_type == "mask" && body.sticker.mask_position.is_none() {
        return err("maskPosition is required for mask packs.");
    }
    if body.sticker.sab_file_url.is_empty() {
        return err("sabFileUrl is required.");
    }

    let (file_id, format) =
        match upload_sticker(&s, &token, body.user_id, &body.sticker, &sticker_type).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };

    let mut wire = serde_json::json!({
        "user_id": body.user_id,
        "name": set_name,
        "sticker": {
            "sticker": file_id,
            "format": format,
            "emoji_list": emojis,
        },
    });
    if let Some(kw) = &body.sticker.keywords {
        if !kw.is_empty() {
            wire["sticker"]["keywords"] = serde_json::Value::Array(
                kw.iter()
                    .map(|k| serde_json::Value::String(k.clone()))
                    .collect(),
            );
        }
    }
    if let Some(mp) = &body.sticker.mask_position {
        wire["sticker"]["mask_position"] = serde_json::json!({
            "point": mp.point,
            "x_shift": mp.x_shift,
            "y_shift": mp.y_shift,
            "scale": mp.scale,
        });
    }

    if let Err(e) = s.bot_api.add_sticker_to_set(&token, &wire).await {
        return err(err_msg(e));
    }

    // Mirror locally — refresh from Telegram for a clean order.
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;

    Json(AckResult {
        success: true,
        file_id: Some(file_id),
        message: Some("Sticker added.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  DELETE /{set_name}/sticker/{file_id}
// =========================================================================

pub async fn delete_sticker(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Query(q): Query<ProjectBotQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("botId is required"),
    };
    let (project_oid, bot) = match require_project_bot(&user, &s.mongo, project_id, bot_id).await {
        Ok(r) => r,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    if let Err(e) = s
        .bot_api
        .delete_sticker_from_set(&token, &sticker_file_id)
        .await
    {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(sticker_file_id),
        message: Some("Sticker removed.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/title
// =========================================================================

pub async fn set_title(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_name): Path<String>,
    Json(body): Json<SetTitleBody>,
) -> Json<AckResult> {
    if body.title.trim().is_empty() {
        return err("title is required");
    }
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    if let Err(e) = s
        .bot_api
        .set_sticker_set_title(&token, &set_name, body.title.trim())
        .await
    {
        return err(err_msg(e));
    }
    let _ = s
        .mongo
        .collection::<Document>(SETS)
        .update_one(
            doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid },
            doc! { "$set": { "title": body.title.trim(), "updatedAt": bson::DateTime::now() } },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Title updated.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/thumbnail
// =========================================================================

pub async fn set_thumbnail(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path(set_name): Path<String>,
    Json(body): Json<SetThumbnailBody>,
) -> Json<AckResult> {
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };

    // Resolve the format up-front — Telegram wants `static|animated|video`.
    let mut format = body.format.clone().unwrap_or_default();

    let mut wire = serde_json::json!({
        "name": set_name,
        "user_id": body.user_id,
    });

    if let Some(url) = body.sab_file_url.as_deref() {
        // Upload the file first; the docs accept a file_id as `thumbnail`.
        let (bytes, mime, derived_name) = match fetch_url_bytes(&s.http, url).await {
            Ok(v) => v,
            Err(e) => return err(format!("download from SabFiles failed: {e}")),
        };
        if format.is_empty() {
            format = sticker_format_for_mime(&mime).to_owned();
        }
        let up = match s
            .bot_api
            .upload_sticker_file(&token, body.user_id, &format, &derived_name, &mime, bytes)
            .await
        {
            Ok(v) => v,
            Err(e) => return err(err_msg(e)),
        };
        wire["thumbnail"] = serde_json::Value::String(up.file_id.clone());
        wire["format"] = serde_json::Value::String(if format.is_empty() {
            "static".to_owned()
        } else {
            format.clone()
        });

        if let Err(e) = s.bot_api.set_sticker_set_thumbnail(&token, &wire).await {
            return err(err_msg(e));
        }

        let _ = s
            .mongo
            .collection::<Document>(SETS)
            .update_one(
                doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid },
                doc! { "$set": {
                    "thumbnailFileId": &up.file_id,
                    "thumbnailUrl": url,
                    "updatedAt": bson::DateTime::now(),
                } },
            )
            .await;
        return Json(AckResult {
            success: true,
            message: Some("Thumbnail updated.".to_owned()),
            ..Default::default()
        });
    }

    // No file → clear the thumbnail.
    wire["format"] = serde_json::Value::String(if format.is_empty() {
        "static".to_owned()
    } else {
        format
    });
    if let Err(e) = s.bot_api.set_sticker_set_thumbnail(&token, &wire).await {
        return err(err_msg(e));
    }
    let _ = s
        .mongo
        .collection::<Document>(SETS)
        .update_one(
            doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid },
            doc! { "$unset": { "thumbnailFileId": "", "thumbnailUrl": "" },
            "$set": { "updatedAt": bson::DateTime::now() } },
        )
        .await;
    Json(AckResult {
        success: true,
        message: Some("Thumbnail cleared.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/sticker/{file_id}/emoji
// =========================================================================

pub async fn set_emoji_list(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Json(body): Json<EmojiListBody>,
) -> Json<AckResult> {
    if let Err(e) = validate_emoji_list(&body.emoji_list) {
        return err(e);
    }
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    if let Err(e) = s
        .bot_api
        .set_sticker_emoji_list(&token, &sticker_file_id, &body.emoji_list)
        .await
    {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(sticker_file_id),
        message: Some("Emojis updated.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/sticker/{file_id}/keywords
// =========================================================================

pub async fn set_keywords(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Json(body): Json<KeywordsBody>,
) -> Json<AckResult> {
    if let Err(e) = validate_keywords(&body.keywords) {
        return err(e);
    }
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    if let Err(e) = s
        .bot_api
        .set_sticker_keywords(&token, &sticker_file_id, &body.keywords)
        .await
    {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(sticker_file_id),
        message: Some("Keywords updated.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/sticker/{file_id}/mask
// =========================================================================

pub async fn set_mask_position(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Json(body): Json<MaskPositionBody>,
) -> Json<AckResult> {
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    let mp: Option<MaskPosition> = body.mask_position.clone().map(Into::into);
    if let Err(e) = s
        .bot_api
        .set_sticker_mask_position(&token, &sticker_file_id, mp.as_ref())
        .await
    {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(sticker_file_id),
        message: Some("Mask position updated.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/sticker/{file_id}/position
// =========================================================================

pub async fn set_position(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Json(body): Json<PositionBody>,
) -> Json<AckResult> {
    if body.position < 0 {
        return err("position must be ≥ 0");
    }
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    if let Err(e) = s
        .bot_api
        .set_sticker_position_in_set(&token, &sticker_file_id, body.position)
        .await
    {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(sticker_file_id),
        message: Some("Sticker reordered.".to_owned()),
        ..Default::default()
    })
}

// =========================================================================
//  POST /{set_name}/sticker/{file_id}/replace
// =========================================================================

pub async fn replace_sticker(
    user: AuthUser,
    State(s): State<TelegramStickersState>,
    Path((set_name, sticker_file_id)): Path<(String, String)>,
    Json(body): Json<ReplaceStickerBody>,
) -> Json<AckResult> {
    let (project_oid, bot) =
        match require_project_bot(&user, &s.mongo, &body.project_id, &body.bot_id).await {
            Ok(r) => r,
            Err(e) => return err(e),
        };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let token = match bot.get_str("token") {
        Ok(t) => t.to_owned(),
        Err(_) => return err("Bot is missing its access token."),
    };
    let local = match s
        .mongo
        .collection::<Document>(SETS)
        .find_one(doc! { "name": &set_name, "botId": bot_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Sticker pack not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let sticker_type = local.get_str("stickerType").unwrap_or("regular").to_owned();

    let emojis = split_emojis(&body.emoji);
    if let Err(e) = validate_emoji_list(&emojis) {
        return err(e);
    }
    if let Some(kw) = &body.keywords {
        if let Err(e) = validate_keywords(kw) {
            return err(e);
        }
    }
    if body.sab_file_url.is_empty() {
        return err("sabFileUrl is required.");
    }
    let input = StickerInputBody {
        sab_file_id: body.sab_file_id.clone(),
        sab_file_url: body.sab_file_url.clone(),
        sab_file_name: body.sab_file_name.clone(),
        emoji: body.emoji.clone(),
        keywords: body.keywords.clone(),
        mask_position: body.mask_position.clone(),
    };
    let (file_id, format) =
        match upload_sticker(&s, &token, body.user_id, &input, &sticker_type).await {
            Ok(v) => v,
            Err(e) => return err(e),
        };
    let mut wire = serde_json::json!({
        "user_id": body.user_id,
        "name": set_name,
        "old_sticker": sticker_file_id,
        "sticker": {
            "sticker": file_id,
            "format": format,
            "emoji_list": emojis,
        },
    });
    if let Some(kw) = &body.keywords {
        if !kw.is_empty() {
            wire["sticker"]["keywords"] = serde_json::Value::Array(
                kw.iter()
                    .map(|k| serde_json::Value::String(k.clone()))
                    .collect(),
            );
        }
    }
    if let Some(mp) = &body.mask_position {
        wire["sticker"]["mask_position"] = serde_json::json!({
            "point": mp.point,
            "x_shift": mp.x_shift,
            "y_shift": mp.y_shift,
            "scale": mp.scale,
        });
    }
    if let Err(e) = s.bot_api.replace_sticker_in_set(&token, &wire).await {
        return err(err_msg(e));
    }
    let _ = refresh_one(&s, &token, &set_name, bot_oid, project_oid).await;
    Json(AckResult {
        success: true,
        file_id: Some(file_id),
        message: Some("Sticker replaced.".to_owned()),
        ..Default::default()
    })
}
