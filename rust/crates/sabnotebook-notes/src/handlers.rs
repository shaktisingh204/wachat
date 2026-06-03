//! HTTP handlers for SabNotebook notes.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    ArchiveNoteInput, CreateNoteInput, CreateNoteResponse, DeleteNoteResponse, ListQuery,
    PinNoteInput, SearchQuery, UpdateNoteInput,
};
use crate::types::SabnotebookNote;

const COLL: &str = "sabnotebook_notes";
const ENTITY_KIND: &str = "sabnotebook_note";

const VALID_KINDS: &[&str] = &["text", "checklist", "audio", "sketch", "file"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = q
        .section_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("sectionId", oid);
        }
    }
    if let Some(p) = q
        .notebook_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("notebookId", oid);
        }
    }
    if let Some(k) = q.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(t) = q.tag.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("tags", t);
    }
    if let Some(p) = q.pinned {
        filter.insert("pinned", p);
    }
    match q.status.as_deref().unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("archived", true);
            filter.insert("trashed", doc! { "$ne": true });
        }
        "trashed" => {
            filter.insert("trashed", true);
        }
        _ => {
            filter.insert("archived", doc! { "$ne": true });
            filter.insert("trashed", doc! { "$ne": true });
        }
    }
    filter
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn note_from_create(input: CreateNoteInput, user_id: ObjectId) -> Result<SabnotebookNote> {
    let section_oid = ObjectId::parse_str(&input.section_id)
        .map_err(|_| ApiError::Validation("sectionId must be a valid ObjectId".to_owned()))?;
    let kind = input
        .kind
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("text")
        .to_owned();
    if !VALID_KINDS.iter().any(|k| *k == kind.as_str()) {
        return Err(ApiError::Validation(format!(
            "kind must be one of {:?}",
            VALID_KINDS
        )));
    }
    let notebook_oid = input
        .notebook_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabnotebookNote {
        id: None,
        user_id,
        section_id: section_oid,
        notebook_id: notebook_oid,
        title: input
            .title
            .map(|t| t.trim().to_owned())
            .filter(|s| !s.is_empty()),
        kind,
        blocks_json: input.blocks_json,
        preview: input.preview,
        color: input.color,
        tags: input.tags.unwrap_or_default(),
        pinned: input.pinned.unwrap_or(false),
        archived: false,
        trashed: false,
        remind_at: input.remind_at.as_deref().and_then(parse_date),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateNoteInput) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch
        .section_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("sectionId", v);
    }
    if let Some(v) = patch
        .notebook_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("notebookId", v);
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.kind {
        if !VALID_KINDS.iter().any(|k| *k == v.as_str()) {
            return Err(ApiError::Validation(format!(
                "kind must be one of {:?}",
                VALID_KINDS
            )));
        }
        set.insert("kind", v);
    }
    if let Some(v) = patch.blocks_json {
        set.insert("blocksJson", v);
    }
    if let Some(v) = patch.preview {
        set.insert("preview", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = patch.pinned {
        set.insert("pinned", v);
    }
    if let Some(v) = patch.archived {
        set.insert("archived", v);
    }
    if let Some(v) = patch.trashed {
        set.insert("trashed", v);
    }
    if let Some(v) = patch.remind_at.as_deref().and_then(parse_date) {
        set.insert("remindAt", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SabnotebookNote) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabnotebookNote>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_notes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "preview", "tags"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "pinned": -1, "updatedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.find"))
        })?;
    let mut rows: Vec<SabnotebookNote> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %note_id))]
pub async fn get_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(note_id): Path<String>,
) -> Result<Json<SabnotebookNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&note_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("note".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateNoteInput>,
) -> Result<Json<CreateNoteResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = note_from_create(input, user_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateNoteResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %note_id))]
pub async fn update_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(note_id): Path<String>,
    Json(patch): Json<UpdateNoteInput>,
) -> Result<Json<SabnotebookNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&note_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("note".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("note".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("note".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %note_id))]
pub async fn delete_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(note_id): Path<String>,
) -> Result<Json<DeleteNoteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&note_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "trashed": true,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.trash"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("note".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteNoteResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %note_id))]
pub async fn pin_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(note_id): Path<String>,
    Json(input): Json<PinNoteInput>,
) -> Result<Json<SabnotebookNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&note_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "pinned": input.pinned,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.pin")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("note".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("note".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %note_id))]
pub async fn archive_note(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(note_id): Path<String>,
    Json(input): Json<ArchiveNoteInput>,
) -> Result<Json<SabnotebookNote>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&note_id)?;
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "archived": input.archived,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("note".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("note".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn search_notes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let needle = q.q.trim();
    if needle.is_empty() {
        return Ok(Json(ListResponse {
            items: vec![],
            page: 0,
            limit: 0,
            has_more: false,
        }));
    }
    let mut filter = doc! {
        "userId": user_id,
        "trashed": doc! { "$ne": true },
    };
    if let Some(p) = q
        .notebook_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("notebookId", oid);
        }
    }
    if let Some(t) = q.tag.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("tags", t);
    }
    let or = build_q_filter(needle, &["title", "preview", "blocksJson", "tags"]);
    if let Ok(arr) = or.get_array("$or") {
        filter.insert("$or", arr.clone());
    }
    let limit = clamp_limit(q.limit);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabnotebookNote>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.search"))
    })?;
    let mut rows: Vec<SabnotebookNote> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notes.search_collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: 0,
        limit: limit as u32,
        has_more,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_from_create_defaults_kind_text() {
        let user_id = ObjectId::new();
        let input = CreateNoteInput {
            section_id: ObjectId::new().to_hex(),
            ..Default::default()
        };
        let n = note_from_create(input, user_id).unwrap();
        assert_eq!(n.kind, "text");
        assert!(!n.pinned);
        assert!(!n.archived);
        assert!(!n.trashed);
    }

    #[test]
    fn note_from_create_rejects_unknown_kind() {
        let user_id = ObjectId::new();
        let input = CreateNoteInput {
            section_id: ObjectId::new().to_hex(),
            kind: Some("bogus".into()),
            ..Default::default()
        };
        assert!(note_from_create(input, user_id).is_err());
    }

    #[test]
    fn note_from_create_rejects_bad_section_oid() {
        let user_id = ObjectId::new();
        let input = CreateNoteInput {
            section_id: "nope".into(),
            ..Default::default()
        };
        assert!(note_from_create(input, user_id).is_err());
    }

    #[test]
    fn list_filter_active_excludes_archived_and_trashed() {
        let oid = ObjectId::new();
        let q = ListQuery::default();
        let f = list_filter(oid, &q);
        assert!(f.contains_key("archived"));
        assert!(f.contains_key("trashed"));
    }

    #[test]
    fn update_doc_rejects_bad_kind() {
        let patch = UpdateNoteInput {
            kind: Some("weird".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }
}
