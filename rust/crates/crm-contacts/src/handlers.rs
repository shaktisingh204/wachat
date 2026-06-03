//! HTTP handlers for the §6.3 Contact entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateContactInput, CreateContactResponse, DeleteContactResponse, ListQuery, UpdateContactInput,
};
use crate::types::CrmContact;

const CONTACTS_COLL: &str = "crm_contacts";
const ENTITY_KIND: &str = "contact";

// ─── Filter helpers ──────────────────────────────────────────────────────

/// Base tenant filter. Defaults to **active** (non-archived) contacts; the
/// `status` query param can override to `archived` or `all`.
fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

/// Bare tenant filter — used for get_one / update / delete which should
/// see archived rows too (so an archived doc can still be unarchived).
fn ownership_filter(user_id: ObjectId, contact_oid: ObjectId) -> Document {
    doc! { "_id": contact_oid, "userId": user_id }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn contact_from_create(input: CreateContactInput, user_id: ObjectId) -> Result<CrmContact> {
    let account_oid = match input.account_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };

    Ok(CrmContact {
        id: None,
        user_id,
        account_id: account_oid,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        job_title: input.job_title,
        avatar_url: input.avatar_url,
        status: Some(input.status.unwrap_or_else(|| "new_lead".to_owned())),
        lead_score: input.lead_score,
        lead_source: input.lead_source,
        assigned_to: input.assigned_to,
        last_activity: None,
        notes: Vec::new(),
        tags: input.tags,
        linkedin_url: input.linkedin_url,
        twitter_handle: input.twitter_handle,
        lifecycle_stage: input.lifecycle_stage,
        source: input.source,
        owner: input.owner,
        date_of_birth: input.date_of_birth.map(BsonDateTime::from_chrono),
        timezone: input.timezone,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateContactInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.email {
        set.insert("email", v);
    }
    if let Some(v) = patch.account_id {
        if v.is_empty() {
            set.insert("accountId", Bson::Null);
        } else {
            set.insert("accountId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.phone {
        set.insert("phone", v);
    }
    if let Some(v) = patch.company {
        set.insert("company", v);
    }
    if let Some(v) = patch.job_title {
        set.insert("jobTitle", v);
    }
    if let Some(v) = patch.avatar_url {
        set.insert("avatarUrl", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.lead_score {
        set.insert("leadScore", v);
    }
    if let Some(v) = patch.lead_source {
        set.insert("leadSource", v);
    }
    if let Some(v) = patch.assigned_to {
        set.insert("assignedTo", v);
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    if let Some(v) = patch.linkedin_url {
        set.insert("linkedinUrl", v);
    }
    if let Some(v) = patch.twitter_handle {
        set.insert("twitterHandle", v);
    }
    if let Some(v) = patch.lifecycle_stage {
        set.insert("lifecycleStage", v);
    }
    if let Some(v) = patch.source {
        set.insert("source", v);
    }
    if let Some(v) = patch.owner {
        set.insert("owner", v);
    }
    if let Some(v) = patch.date_of_birth {
        set.insert("dateOfBirth", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(contact: &CrmContact) -> Document {
    bson::to_document(contact).unwrap_or_default()
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_contacts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;

    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "email", "company", "phone"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1) // +1 to infer hasMore without a count
        .build();

    let coll = mongo.collection::<CrmContact>(CONTACTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find")))?;
    let mut rows: Vec<CrmContact> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.collect")))?;

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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmContact>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn get_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
) -> Result<Json<CrmContact>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;

    let coll = mongo.collection::<CrmContact>(CONTACTS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("contact".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateContactInput>,
) -> Result<Json<CreateContactResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.email.trim().is_empty() {
        return Err(ApiError::Validation("email is required".to_owned()));
    }

    let mut contact = contact_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmContact>(CONTACTS_COLL);
    let inserted = coll
        .insert_one(&contact)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    contact.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&contact)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateContactResponse {
        id: new_id.to_hex(),
        entity: contact,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn update_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
    Json(patch): Json<UpdateContactInput>,
) -> Result<Json<CrmContact>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;

    let coll = mongo.collection::<CrmContact>(CONTACTS_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("contact".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("contact".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("contact".to_owned()))?;

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

// ─── DELETE /:id ────────────────────────────────────────────────────────

/// Soft delete — flips `status: "archived"`. The legacy TS `deleteCrmContact`
/// does a hard delete; we prefer the soft path so lineage references stay
/// intact. The TS adapter maps both behaviors transparently.
#[instrument(skip_all, fields(user_id = %user.user_id, contact_id = %contact_id))]
pub async fn delete_contact(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contact_id): Path<String>,
) -> Result<Json<DeleteContactResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contact_id)?;

    let coll = mongo.collection::<CrmContact>(CONTACTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("contact".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteContactResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn list_filter_defaults_to_active() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        // active excludes status == 'archived'
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn list_filter_archived_matches_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("archived"));
        assert_eq!(f.get_str("status").unwrap(), "archived");
    }

    #[test]
    fn build_update_doc_omits_unset_fields() {
        let patch = UpdateContactInput {
            name: Some("Jane Doe".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_str("name").unwrap(), "Jane Doe");
        assert!(!set.contains_key("email"));
        assert!(!set.contains_key("phone"));
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn build_update_doc_clears_account_on_empty_string() {
        let patch = UpdateContactInput {
            account_id: Some(String::new()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert!(set.contains_key("accountId"));
        assert_eq!(set.get("accountId").unwrap(), &Bson::Null);
    }

    #[test]
    fn build_update_doc_parses_account_oid() {
        let oid = ObjectId::new();
        let patch = UpdateContactInput {
            account_id: Some(oid.to_hex()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert_eq!(set.get_object_id("accountId").unwrap(), oid);
    }

    #[test]
    fn contact_from_create_defaults_status_to_new_lead() {
        let user_id = ObjectId::new();
        let input = CreateContactInput {
            name: "Jane Doe".into(),
            email: "jane@example.com".into(),
            ..Default::default()
        };
        let c = contact_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("new_lead"));
        assert_eq!(c.user_id, user_id);
        assert!(c.id.is_none());
        assert_eq!(c.name, "Jane Doe");
        assert_eq!(c.email, "jane@example.com");
    }

    #[test]
    fn contact_from_create_honors_explicit_status() {
        let user_id = ObjectId::new();
        let input = CreateContactInput {
            name: "Jane".into(),
            email: "jane@example.com".into(),
            status: Some("customer".to_owned()),
            ..Default::default()
        };
        let c = contact_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("customer"));
    }

    #[test]
    fn contact_from_create_parses_account_id() {
        let user_id = ObjectId::new();
        let acc = ObjectId::new();
        let input = CreateContactInput {
            name: "Jane".into(),
            email: "jane@example.com".into(),
            account_id: Some(acc.to_hex()),
            ..Default::default()
        };
        let c = contact_from_create(input, user_id).unwrap();
        assert_eq!(c.account_id, Some(acc));
    }
}
