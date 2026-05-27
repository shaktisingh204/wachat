//! HTTP handlers for SabNotebook note attachments.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, write_audit},
    pagination::clamp_limit,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateAttachmentInput, CreateAttachmentResponse, DeleteAttachmentResponse, ListQuery,
};
use crate::types::SabnotebookAttachment;

const COLL: &str = "sabnotebook_attachments";
const ENTITY_KIND: &str = "sabnotebook_attachment";

const VALID_KINDS: &[&str] = &["image", "audio", "video", "file"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, note_id: Option<&str>, kind: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = note_id.map(str::trim).filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("noteId", oid);
        }
    }
    if let Some(k) = kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    filter
}

fn attachment_from_create(
    input: CreateAttachmentInput,
    user_id: ObjectId,
) -> Result<SabnotebookAttachment> {
    let note_oid = ObjectId::parse_str(&input.note_id)
        .map_err(|_| ApiError::Validation("noteId must be a valid ObjectId".to_owned()))?;
    let file_oid = ObjectId::parse_str(&input.file_id)
        .map_err(|_| ApiError::Validation("fileId must be a valid ObjectId".to_owned()))?;
    if !VALID_KINDS.iter().any(|k| *k == input.kind.as_str()) {
        return Err(ApiError::Validation(format!(
            "kind must be one of {:?}",
            VALID_KINDS
        )));
    }
    Ok(SabnotebookAttachment {
        id: None,
        user_id,
        note_id: note_oid,
        file_id: file_oid,
        kind: input.kind,
        name: input.name,
        mime: input.mime,
        size: input.size,
        order: input.order.unwrap_or(0),
        created_at: BsonDateTime::from_chrono(Utc::now()),
    })
}

fn doc_for_audit(entity: &SabnotebookAttachment) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabnotebookAttachment>,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_attachments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, q.note_id.as_deref(), q.kind.as_deref());
    let limit = clamp_limit(q.limit);
    let opts = FindOptions::builder()
        .sort(doc! { "order": 1, "createdAt": 1 })
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabnotebookAttachment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_attachments.find"))
    })?;
    let mut rows: Vec<SabnotebookAttachment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_attachments.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %attachment_id))]
pub async fn get_attachment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(attachment_id): Path<String>,
) -> Result<Json<SabnotebookAttachment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&attachment_id)?;
    let coll = mongo.collection::<SabnotebookAttachment>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabnotebook_attachments.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("attachment".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_attachment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAttachmentInput>,
) -> Result<Json<CreateAttachmentResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = attachment_from_create(input, user_id)?;
    let coll = mongo.collection::<SabnotebookAttachment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_attachments.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateAttachmentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %attachment_id))]
pub async fn delete_attachment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(attachment_id): Path<String>,
) -> Result<Json<DeleteAttachmentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&attachment_id)?;
    let coll = mongo.collection::<SabnotebookAttachment>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_attachments.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("attachment".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAttachmentResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attachment_from_create_rejects_bad_oids() {
        let user_id = ObjectId::new();
        let bad_note = CreateAttachmentInput {
            note_id: "x".into(),
            file_id: ObjectId::new().to_hex(),
            kind: "image".into(),
            ..Default::default()
        };
        assert!(attachment_from_create(bad_note, user_id).is_err());
    }

    #[test]
    fn attachment_from_create_rejects_unknown_kind() {
        let user_id = ObjectId::new();
        let input = CreateAttachmentInput {
            note_id: ObjectId::new().to_hex(),
            file_id: ObjectId::new().to_hex(),
            kind: "doc".into(),
            ..Default::default()
        };
        assert!(attachment_from_create(input, user_id).is_err());
    }

    #[test]
    fn attachment_from_create_round_trip_ok() {
        let user_id = ObjectId::new();
        let input = CreateAttachmentInput {
            note_id: ObjectId::new().to_hex(),
            file_id: ObjectId::new().to_hex(),
            kind: "image".into(),
            name: Some("cat.png".into()),
            ..Default::default()
        };
        let a = attachment_from_create(input, user_id).unwrap();
        assert_eq!(a.kind, "image");
        assert_eq!(a.order, 0);
    }
}
