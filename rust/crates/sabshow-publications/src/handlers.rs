//! HTTP handlers for `/v1/sabshow/publications/*`.
//!
//! `GET /public/{slug}` is intentionally **unauthenticated** — that's the
//! endpoint the public `/present/[slug]` page hits. Every other handler
//! is owner-scoped via the `AuthUser` extractor.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    ListPublicationsQuery, PublicPublicationResponse, PublicationEnvelope, PublicationListResponse,
    PublishDeckInput, UpdatePublicationInput,
};
use crate::types::{PublicationStatus, SabshowPublication};

const PUBLICATIONS_COLL: &str = "sabshow_publications";
const DECKS_COLL: &str = "sabshow_decks";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

fn slug_ok(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 80
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[instrument(skip(mongo, auth))]
pub async fn list_publications(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListPublicationsQuery>,
) -> Result<Json<PublicationListResponse>> {
    let me = user_oid(&auth)?;
    let mut filter = doc! { "ownerUserId": me };
    if let Some(d) = q.deck_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("deckId", oid(d, "deckId")?);
    }
    let coll = mongo.db().collection::<SabshowPublication>(PUBLICATIONS_COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowPublication> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(PublicationListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn publish_deck(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<PublishDeckInput>,
) -> Result<Json<PublicationEnvelope>> {
    let me = user_oid(&auth)?;
    if !slug_ok(&input.slug) {
        return Err(ApiError::BadRequest(
            "slug must be 1-80 chars of [a-zA-Z0-9_-]".into(),
        ));
    }
    let deck_id = oid(&input.deck_id, "deckId")?;
    // Owner-only — sharedWithUserIds cannot publish.
    let deck = mongo
        .db()
        .collection::<Document>(DECKS_COLL)
        .find_one(doc! { "_id": deck_id, "ownerUserId": me })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("deck not found".into()))?;

    let pinned = input.version.unwrap_or_else(|| {
        deck.get_i32("version")
            .map(|n| n as u32)
            .or_else(|_| deck.get_i64("version").map(|n| n as u32))
            .unwrap_or(1)
    });

    let coll = mongo.db().collection::<SabshowPublication>(PUBLICATIONS_COLL);
    // Slug uniqueness — soft check (a unique index in the bootstrap is
    // the real enforcement).
    let conflict = coll
        .find_one(doc! { "slug": &input.slug, "deckId": { "$ne": deck_id } })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if conflict.is_some() {
        return Err(ApiError::Conflict("slug already taken".into()));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    let publication = SabshowPublication {
        id: None,
        deck_id,
        owner_user_id: me,
        slug: input.slug,
        published_version: pinned,
        theme_json: input.theme_json,
        status: PublicationStatus::Live,
        custom_css: input.custom_css,
        cover_file_id: input.cover_file_id,
        published_at: now,
        updated_at: None,
    };
    // Upsert by (deckId, slug) so re-publishing is idempotent.
    let set_doc =
        bson::to_document(&publication).map_err(|e| ApiError::Internal(e.into()))?;
    coll.update_one(
        doc! { "deckId": deck_id, "ownerUserId": me },
        doc! { "$set": set_doc },
    )
    .with_options(UpdateOptions::builder().upsert(true).build())
    .await
    .map_err(|e| ApiError::Internal(e.into()))?;

    let publication = coll
        .find_one(doc! { "deckId": deck_id, "ownerUserId": me })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("publication not found".into()))?;
    Ok(Json(PublicationEnvelope { publication }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_publication(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(publication_id): Path<String>,
    Json(patch): Json<UpdatePublicationInput>,
) -> Result<Json<PublicationEnvelope>> {
    let me = user_oid(&auth)?;
    let pid = oid(&publication_id, "publicationId")?;
    let coll = mongo.db().collection::<SabshowPublication>(PUBLICATIONS_COLL);
    let filter = doc! { "_id": pid, "ownerUserId": me };
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(s) = patch.status {
        let s = match s {
            PublicationStatus::Live => "live",
            PublicationStatus::Paused => "paused",
        };
        set.insert("status", s);
    }
    if let Some(v) = patch.published_version {
        set.insert("publishedVersion", v as i32);
    }
    if let Some(v) = patch.theme_json {
        set.insert(
            "themeJson",
            bson::to_bson(&v).map_err(|e| ApiError::Internal(e.into()))?,
        );
    }
    if let Some(v) = patch.custom_css {
        set.insert("customCss", v);
    }
    if let Some(v) = patch.cover_file_id {
        set.insert("coverFileId", v);
    }
    coll.update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let publication = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("publication not found".into()))?;
    Ok(Json(PublicationEnvelope { publication }))
}

#[instrument(skip(mongo, auth))]
pub async fn unpublish(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(publication_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let pid = oid(&publication_id, "publicationId")?;
    let coll = mongo.db().collection::<SabshowPublication>(PUBLICATIONS_COLL);
    let res = coll
        .delete_one(doc! { "_id": pid, "ownerUserId": me })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "deleted": res.deleted_count > 0 })))
}

/// UNAUTHENTICATED — the `/present/[slug]` public page reads this.
#[instrument(skip(mongo))]
pub async fn get_public_by_slug(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPublicationResponse>> {
    if !slug_ok(&slug) {
        return Err(ApiError::BadRequest("invalid slug".into()));
    }
    let coll = mongo.db().collection::<SabshowPublication>(PUBLICATIONS_COLL);
    let publication = coll
        .find_one(doc! { "slug": &slug, "status": "live" })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("publication not found".into()))?;
    Ok(Json(PublicPublicationResponse {
        slug: publication.slug,
        deck_id: publication.deck_id.to_hex(),
        published_version: publication.published_version,
        theme_json: publication.theme_json,
        custom_css: publication.custom_css,
        cover_file_id: publication.cover_file_id,
    }))
}
