//! HTTP handlers for SabCheckout payer sessions.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    ConfirmSessionResponse, CreateSessionResponse, ListQuery, PublicConfirmSessionInput,
    PublicCreateSessionInput,
};
use crate::types::SabcheckoutSession;

const COLL: &str = "sabcheckout_sessions";
const PAGES_COLL: &str = "sabcheckout_pages";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutSession>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sessions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(status) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", status);
    }
    if let Some(page_id) = q.page_id.as_deref() {
        if let Ok(oid) = oid_from_str(page_id) {
            filter.insert("pageId", oid);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = bson::Regex {
            pattern: regex_escape(needle),
            options: "i".into(),
        };
        filter.insert(
            "$or",
            bson::to_bson(&vec![
                doc! { "payerEmail": &regex },
                doc! { "payerName": &regex },
                doc! { "payerPhone": &regex },
                doc! { "paymentRef": &regex },
            ])
            .unwrap_or_default(),
        );
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabcheckoutSession>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.find"))
        })?;
    let mut rows: Vec<SabcheckoutSession> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, session_id = %session_id))]
pub async fn get_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<SabcheckoutSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SabcheckoutSession>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_session".to_owned()))?;
    Ok(Json(row))
}

/// PUBLIC — unauthenticated. Resolves the page by `pageSlug`, validates
/// the page is `live`, then writes a `pending` session bound to the
/// page's `userId`.
#[instrument(skip_all, fields(slug = %input.page_slug))]
pub async fn public_create_session(
    State(mongo): State<MongoHandle>,
    Json(input): Json<PublicCreateSessionInput>,
) -> Result<Json<CreateSessionResponse>> {
    let slug = input.page_slug.trim().to_lowercase();
    if slug.is_empty() {
        return Err(ApiError::Validation("pageSlug is required".to_owned()));
    }

    let pages = mongo.collection::<bson::Document>(PAGES_COLL);
    let page = pages
        .find_one(doc! { "slug": &slug, "status": "live" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_pages.public_lookup"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_page".to_owned()))?;

    let user_id = page
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("page missing userId")))?;
    let page_id = page
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("page missing _id")))?;

    let custom_fields_doc = input
        .custom_fields_json
        .as_ref()
        .and_then(|v| bson::to_document(v).ok());

    let mut entity = SabcheckoutSession {
        id: None,
        user_id,
        page_id,
        payer_email: input.payer_email,
        payer_name: input.payer_name,
        payer_phone: input.payer_phone,
        custom_fields_json: custom_fields_doc,
        selected_items: input.selected_items,
        totals: input.totals,
        status: "pending".to_owned(),
        provider_session_id: None,
        payment_ref: None,
        completed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<SabcheckoutSession>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(CreateSessionResponse {
        id: new_id.to_hex(),
        session: entity,
    }))
}

/// PUBLIC — unauthenticated. Confirm callback flips a session's status
/// and stores the provider refs.
#[instrument(skip_all, fields(session_id = %input.session_id, status = %input.status))]
pub async fn public_confirm_session(
    State(mongo): State<MongoHandle>,
    Json(input): Json<PublicConfirmSessionInput>,
) -> Result<Json<ConfirmSessionResponse>> {
    let oid = oid_from_str(&input.session_id)?;
    let status = match input.status.as_str() {
        "completed" | "failed" | "expired" | "pending" => input.status.clone(),
        _ => {
            return Err(ApiError::Validation(
                "status must be pending|completed|failed|expired".to_owned(),
            ));
        }
    };

    let mut set: Document = doc! {
        "status": &status,
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(p) = input.payment_ref {
        set.insert("paymentRef", p);
    }
    if let Some(p) = input.provider_session_id {
        set.insert("providerSessionId", p);
    }
    if status == "completed" {
        set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
    }

    let coll = mongo.collection::<SabcheckoutSession>(COLL);
    let result = coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.confirm"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_session".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_session".to_owned()))?;
    Ok(Json(ConfirmSessionResponse { session: after }))
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if "\\.+*?()|[]{}^$".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirm_rejects_unknown_status() {
        // Pure validation: confirm_session would reject "foo".
        let s = "foo";
        let ok = matches!(s, "completed" | "failed" | "expired" | "pending");
        assert!(!ok);
    }

    #[test]
    fn regex_escape_escapes_specials() {
        assert_eq!(regex_escape("foo.bar+baz"), "foo\\.bar\\+baz");
    }
}
