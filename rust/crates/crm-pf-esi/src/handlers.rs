//! HTTP handlers for the PF/ESI Record entity.

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
    CreatePfEsiRecordInput, CreatePfEsiRecordResponse, DeletePfEsiRecordResponse, ListQuery,
    UpdatePfEsiRecordInput,
};
use crate::types::CrmPfEsiRecord;

const COLL: &str = "crm_pf_esi_records";
const ENTITY_KIND: &str = "pf_esi_record";

const VALID_STATUSES: &[&str] = &["pending", "deposited", "filed", "archived"];

fn is_valid_month(m: &str) -> bool {
    if m.len() != 7 {
        return false;
    }
    let bytes = m.as_bytes();
    if bytes[4] != b'-' {
        return false;
    }
    let year_ok = bytes[..4].iter().all(|b| b.is_ascii_digit());
    let month_ok = bytes[5..].iter().all(|b| b.is_ascii_digit());
    if !(year_ok && month_ok) {
        return false;
    }
    matches!(
        &m[5..],
        "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12"
    )
}

fn parse_iso_date(s: &str) -> Result<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map(|nd| BsonDateTime::from_chrono(nd.and_hms_opt(0, 0, 0).unwrap().and_utc()))
        })
        .map_err(|_| ApiError::Validation(format!("invalid date '{s}'")))
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("active_visible") {
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
    if let Some(m) = q.month.as_deref()
        && is_valid_month(m)
    {
        filter.insert("month", m);
    }
    if let Some(v) = q.employee_id.as_deref() {
        filter.insert("employeeId", v);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreatePfEsiRecordInput, user_id: ObjectId) -> Result<CrmPfEsiRecord> {
    if input.employee_name.trim().is_empty() {
        return Err(ApiError::Validation("employee_name is required".to_owned()));
    }
    if !is_valid_month(&input.month) {
        return Err(ApiError::Validation(
            "month must be in YYYY-MM format".to_owned(),
        ));
    }
    let status = input
        .status
        .filter(|s| VALID_STATUSES.contains(&s.as_str()))
        .unwrap_or_else(|| "pending".to_owned());
    let deposit_date = match input.deposit_date.as_deref() {
        Some(s) if !s.is_empty() => Some(parse_iso_date(s)?),
        _ => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(CrmPfEsiRecord {
        id: None,
        user_id,
        employee_id: input.employee_id,
        employee_name: input.employee_name.trim().to_string(),
        month: input.month,
        pf_employer: input.pf_employer,
        pf_employee: input.pf_employee,
        pf_uan: input.pf_uan,
        esi_employer: input.esi_employer,
        esi_employee: input.esi_employee,
        esi_ic_number: input.esi_ic_number,
        challan_number: input.challan_number,
        deposit_date,
        status,
        notes: input.notes,
        created_at: now,
        updated_at: now,
    })
}

fn build_update_doc(patch: UpdatePfEsiRecordInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v.trim());
    }
    if let Some(v) = patch.month {
        if !is_valid_month(&v) {
            return Err(ApiError::Validation(
                "month must be in YYYY-MM format".to_owned(),
            ));
        }
        set.insert("month", v);
    }
    if let Some(v) = patch.pf_employer {
        set.insert("pfEmployer", v);
    }
    if let Some(v) = patch.pf_employee {
        set.insert("pfEmployee", v);
    }
    if let Some(v) = patch.pf_uan {
        set.insert("pfUan", v);
    }
    if let Some(v) = patch.esi_employer {
        set.insert("esiEmployer", v);
    }
    if let Some(v) = patch.esi_employee {
        set.insert("esiEmployee", v);
    }
    if let Some(v) = patch.esi_ic_number {
        set.insert("esiIcNumber", v);
    }
    if let Some(v) = patch.challan_number {
        set.insert("challanNumber", v);
    }
    if let Some(v) = patch.deposit_date {
        set.insert("depositDate", parse_iso_date(&v)?);
    }
    if let Some(v) = patch.status {
        if !VALID_STATUSES.contains(&v.as_str()) {
            return Err(ApiError::Validation("invalid status".to_owned()));
        }
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmPfEsiRecord) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPfEsiRecord>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pf_esi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "employeeName",
                "pfUan",
                "esiIcNumber",
                "challanNumber",
                "month",
            ],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "month": -1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmPfEsiRecord>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.find")))?;
    let mut rows: Vec<CrmPfEsiRecord> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn get_pf_esi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
) -> Result<Json<CrmPfEsiRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;
    let coll = mongo.collection::<CrmPfEsiRecord>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pf_esi_record".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_pf_esi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePfEsiRecordInput>,
) -> Result<Json<CreatePfEsiRecordResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPfEsiRecord>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreatePfEsiRecordResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn update_pf_esi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
    Json(patch): Json<UpdatePfEsiRecordInput>,
) -> Result<Json<CrmPfEsiRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;

    let coll = mongo.collection::<CrmPfEsiRecord>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pf_esi_record".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pf_esi_record".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.refetch")))?
        .ok_or_else(|| ApiError::NotFound("pf_esi_record".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn delete_pf_esi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
) -> Result<Json<DeletePfEsiRecordResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;

    let coll = mongo.collection::<CrmPfEsiRecord>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pf_esi.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pf_esi_record".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeletePfEsiRecordResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_valid_month_accepts_well_formed() {
        assert!(is_valid_month("2026-05"));
        assert!(is_valid_month("2025-12"));
        assert!(!is_valid_month("2026-13"));
        assert!(!is_valid_month("2026-00"));
        assert!(!is_valid_month("2026/05"));
        assert!(!is_valid_month("2026-5"));
    }

    #[test]
    fn entity_from_create_stamps_pending_status() {
        let user_id = ObjectId::new();
        let input = CreatePfEsiRecordInput {
            employee_name: "Bob".into(),
            month: "2026-05".into(),
            pf_employer: 1800.0,
            pf_employee: 1800.0,
            esi_employer: 300.0,
            esi_employee: 75.0,
            ..Default::default()
        };
        let e = entity_from_create(input, user_id).unwrap();
        assert_eq!(e.status, "pending");
        assert_eq!(e.month, "2026-05");
        assert_eq!(e.pf_employer, 1800.0);
    }

    #[test]
    fn entity_from_create_rejects_bad_month() {
        let user_id = ObjectId::new();
        let input = CreatePfEsiRecordInput {
            employee_name: "Bob".into(),
            month: "2026-15".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }
}
