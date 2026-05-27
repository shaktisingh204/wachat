//! HTTP handlers for the SabWebinar Registration entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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
    CreateRegistrationInput, CreateRegistrationResponse, ListQuery, ListResponse,
};
use crate::types::Registration;

const COLL: &str = "sabwebinar_registrations";
const WEBINARS_COLL: &str = "sabwebinar_webinars";

fn gen_join_token() -> String {
    use rand::{Rng, distributions::Alphanumeric, thread_rng};
    let mut rng = thread_rng();
    (0..32)
        .map(|_| rng.sample(Alphanumeric) as char)
        .collect()
}

#[derive(serde::Deserialize)]
struct WebinarLite {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "userId")]
    user_id: ObjectId,
}

/// Public — unauthenticated landing-form POST keyed by slug.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn create_registration_by_slug(
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Json(input): Json<CreateRegistrationInput>,
) -> Result<Json<CreateRegistrationResponse>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.email.trim().is_empty() {
        return Err(ApiError::Validation("email is required".to_owned()));
    }

    let webinars = mongo.collection::<WebinarLite>(WEBINARS_COLL);
    let webinar = webinars
        .find_one(doc! { "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabwebinar_registrations.lookup_webinar"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;

    let token = gen_join_token();
    let mut entity = Registration {
        id: None,
        user_id: webinar.user_id,
        webinar_id: webinar.id,
        name: input.name.trim().to_owned(),
        email: input.email.trim().to_lowercase(),
        phone: input.phone,
        company: input.company,
        custom_fields: input.custom_fields,
        source: input.source,
        registered_at: BsonDateTime::from_chrono(Utc::now()),
        joined_at: None,
        left_at: None,
        join_token: token.clone(),
    };

    let coll = mongo.collection::<Registration>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(CreateRegistrationResponse {
        id: new_id.to_hex(),
        join_token: token,
        entity,
    }))
}

#[instrument(skip_all)]
pub async fn mark_joined_public(
    State(mongo): State<MongoHandle>,
    Path(join_token): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let coll = mongo.collection::<Registration>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            doc! { "joinToken": &join_token },
            doc! { "$set": { "joinedAt": now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.join"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("registration".to_owned()));
    }
    Ok(Json(serde_json::json!({ "joined": true })))
}

#[instrument(skip_all)]
pub async fn mark_left_public(
    State(mongo): State<MongoHandle>,
    Path(join_token): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let coll = mongo.collection::<Registration>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            doc! { "joinToken": &join_token },
            doc! { "$set": { "leftAt": now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.leave"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("registration".to_owned()));
    }
    Ok(Json(serde_json::json!({ "left": true })))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_registrations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(w) = q
        .webinar_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("webinarId", w);
    }
    if let Some(src) = q.source.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("source", src);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "email", "company"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "registeredAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Registration>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.find"))
    })?;
    let mut rows: Vec<Registration> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %registration_id))]
pub async fn get_registration(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(registration_id): Path<String>,
) -> Result<Json<Registration>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&registration_id)?;
    let coll = mongo.collection::<Registration>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_registrations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("registration".to_owned()))?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_token_is_32_chars() {
        let t = gen_join_token();
        assert_eq!(t.len(), 32);
    }
}
