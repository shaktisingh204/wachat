//! HTTP handlers for the Sales Proposal entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateProposalInput, CreateProposalResponse, DeleteProposalResponse, ListQuery,
    ProposalAttachmentInput, ProposalSectionInput, UpdateProposalInput,
};
use crate::types::{CrmProposal, ProposalAttachment, ProposalSection};

const COLL: &str = "crm_proposals";
const ENTITY_KIND: &str = "proposal";

const VALID_STATUSES: &[&str] = &[
    "draft", "sent", "accepted", "rejected", "expired", "archived",
];

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        s if VALID_STATUSES.contains(&s) => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn pick_status(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| VALID_STATUSES.contains(s))
        .map(|s| s.to_owned())
}

fn section_from_input(s: ProposalSectionInput) -> ProposalSection {
    ProposalSection {
        heading: s.heading.trim().to_owned(),
        body: s.body,
    }
}

fn attachment_from_input(a: ProposalAttachmentInput) -> ProposalAttachment {
    let url = a.url.trim().to_owned();
    let name = a
        .name
        .map(|n| n.trim().to_owned())
        .filter(|n| !n.is_empty())
        .unwrap_or_default();
    ProposalAttachment { url, name }
}

fn filter_sections(sections: Vec<ProposalSectionInput>) -> Vec<ProposalSection> {
    sections
        .into_iter()
        .map(section_from_input)
        .filter(|s| !s.heading.is_empty() || !s.body.is_empty())
        .collect()
}

fn filter_attachments(items: Vec<ProposalAttachmentInput>) -> Vec<ProposalAttachment> {
    items
        .into_iter()
        .map(attachment_from_input)
        .filter(|a| !a.url.is_empty())
        .collect()
}

/// Date-derived random-ish slug, matching the TS `generateProposalNumber()`
/// shape (`PROP-XXXXXXXX`).
fn generate_proposal_number() -> String {
    let ms = Utc::now().timestamp_millis().to_string();
    let tail: String = ms.chars().rev().take(8).collect::<String>().chars().rev().collect();
    // 3-char base36 suffix from the low bits of the timestamp + nanos so it
    // matches the TS shape (`Math.random().toString(36).slice(2,5)`).
    let nanos = (Utc::now().timestamp_subsec_nanos() % (36u32.pow(3))) as u32;
    let mut suffix = String::with_capacity(3);
    let alphabet = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut n = nanos;
    for _ in 0..3 {
        suffix.push(alphabet[(n % 36) as usize] as char);
        n /= 36;
    }
    format!("PROP-{}{}", tail, suffix.to_uppercase())
}

fn doc_from_create(input: CreateProposalInput, user_id: ObjectId) -> Result<CrmProposal> {
    let title = input.title.trim().to_owned();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }

    let currency = input
        .currency
        .map(|c| c.trim().to_owned())
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "INR".to_owned());

    let valid_until = match input.valid_until.as_deref() {
        Some(s) if !s.trim().is_empty() => match parse_date(s) {
            Some(d) => Some(d),
            None => return Err(ApiError::Validation("validUntil is invalid".to_owned())),
        },
        _ => None,
    };

    let status = pick_status(input.status.as_deref()).unwrap_or_else(|| "draft".to_owned());
    let now = BsonDateTime::from_chrono(Utc::now());
    let sent_at = if status == "sent" { Some(now) } else { None };

    Ok(CrmProposal {
        id: None,
        user_id,
        proposal_number: generate_proposal_number(),
        title,
        account_id: input.account_id.and_then(|s| {
            let t = s.trim().to_owned();
            if t.is_empty() { None } else { Some(t) }
        }),
        currency,
        total_amount: input.total_amount.unwrap_or(0.0),
        valid_until,
        status,
        sections: filter_sections(input.sections),
        attachments: filter_attachments(input.attachments),
        design_metadata: input.design_metadata.and_then(|v| bson::to_document(&v).ok()),
        signs_count: 0,
        sent_at,
        responded_at: None,
        created_at: now,
        updated_at: None,
    })
}

/// Builds the `$set` update doc. Also stamps `sentAt` / `respondedAt`
/// transitions when status moves into the corresponding terminal state.
fn build_update_doc(patch: UpdateProposalInput, before: &CrmProposal) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };

    if let Some(v) = patch.title {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation("title cannot be empty".to_owned()));
        }
        set.insert("title", t);
    }
    if let Some(v) = patch.account_id {
        let t = v.trim();
        if t.is_empty() {
            set.insert("accountId", Bson::Null);
        } else {
            set.insert("accountId", t.to_owned());
        }
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v.trim());
    }
    if let Some(v) = patch.total_amount {
        set.insert("totalAmount", v);
    }
    if let Some(v) = patch.valid_until {
        if v.trim().is_empty() {
            set.insert("validUntil", Bson::Null);
        } else {
            let d = parse_date(&v)
                .ok_or_else(|| ApiError::Validation("validUntil is invalid".to_owned()))?;
            set.insert("validUntil", d);
        }
    }
    if let Some(v) = patch.status {
        let s = pick_status(Some(&v))
            .ok_or_else(|| ApiError::Validation("status is invalid".to_owned()))?;

        // Transition stamps mirror the TS action.
        if s == "sent" && before.status != "sent" && before.sent_at.is_none() {
            set.insert("sentAt", now);
        }
        if (s == "accepted" || s == "rejected")
            && before.status != s
            && before.responded_at.is_none()
        {
            set.insert("respondedAt", now);
        }

        set.insert("status", s);
    }
    if let Some(v) = patch.sections {
        let sections = filter_sections(v);
        let docs: Vec<Bson> = sections
            .iter()
            .filter_map(|s| bson::to_document(s).ok().map(Bson::Document))
            .collect();
        set.insert("sections", Bson::Array(docs));
    }
    if let Some(v) = patch.attachments {
        let atts = filter_attachments(v);
        let docs: Vec<Bson> = atts
            .iter()
            .filter_map(|a| bson::to_document(a).ok().map(Bson::Document))
            .collect();
        set.insert("attachments", Bson::Array(docs));
    }
    if let Some(v) = patch.design_metadata {
        if let Ok(doc) = bson::to_document(&v) {
            set.insert("designMetadata", doc);
        }
    }

    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmProposal) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProposal>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_proposals(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "proposalNumber", "accountId"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmProposal>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.find")))?;
    let mut rows: Vec<CrmProposal> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proposal_id))]
pub async fn get_proposal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proposal_id): Path<String>,
) -> Result<Json<CrmProposal>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proposal_id)?;
    let coll = mongo.collection::<CrmProposal>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.find_one")))?
        .ok_or_else(|| ApiError::NotFound("proposal".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_proposal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProposalInput>,
) -> Result<Json<CreateProposalResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = doc_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProposal>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.insert")))?;
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

    Ok(Json(CreateProposalResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proposal_id))]
pub async fn update_proposal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proposal_id): Path<String>,
    Json(patch): Json<UpdateProposalInput>,
) -> Result<Json<CrmProposal>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proposal_id)?;

    let coll = mongo.collection::<CrmProposal>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.find_one")))?
        .ok_or_else(|| ApiError::NotFound("proposal".to_owned()))?;

    let update = build_update_doc(patch, &before)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("proposal".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.refetch")))?
        .ok_or_else(|| ApiError::NotFound("proposal".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %proposal_id))]
pub async fn delete_proposal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(proposal_id): Path<String>,
) -> Result<Json<DeleteProposalResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&proposal_id)?;

    let coll = mongo.collection::<CrmProposal>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_proposals.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("proposal".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteProposalResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_hides_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateProposalInput {
            title: "  ".into(),
            ..Default::default()
        };
        assert!(doc_from_create(input, user_id).is_err());
    }

    #[test]
    fn create_defaults_currency_and_status() {
        let user_id = ObjectId::new();
        let input = CreateProposalInput {
            title: "Q3 Plan".into(),
            ..Default::default()
        };
        let row = doc_from_create(input, user_id).unwrap();
        assert_eq!(row.currency, "INR");
        assert_eq!(row.status, "draft");
        assert!(row.proposal_number.starts_with("PROP-"));
        assert_eq!(row.signs_count, 0);
        assert!(row.sent_at.is_none());
    }

    #[test]
    fn create_with_sent_status_stamps_sent_at() {
        let user_id = ObjectId::new();
        let input = CreateProposalInput {
            title: "Active".into(),
            status: Some("sent".into()),
            ..Default::default()
        };
        let row = doc_from_create(input, user_id).unwrap();
        assert_eq!(row.status, "sent");
        assert!(row.sent_at.is_some());
    }
}
