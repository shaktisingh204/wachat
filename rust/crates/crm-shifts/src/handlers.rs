//! HTTP handlers for the Shift entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateShiftInput, CreateShiftResponse, DeleteShiftResponse, ListQuery, UpdateShiftInput,
};
use crate::types::CrmShift;

const COLL: &str = "crm_shifts";
const ENTITY_KIND: &str = "shift";

/// Validate `HH:MM` 24-hour time strings, e.g. `"09:00"`, `"23:59"`.
///
/// Returns the trimmed/canonical value on success.
fn validate_hhmm(field: &str, value: &str) -> Result<String> {
    let s = value.trim();
    if s.is_empty() {
        return Err(ApiError::Validation(format!("{field} is required")));
    }
    let mut parts = s.split(':');
    let h_str = parts.next();
    let m_str = parts.next();
    if parts.next().is_some() || h_str.is_none() || m_str.is_none() {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    let h_str = h_str.unwrap();
    let m_str = m_str.unwrap();
    if h_str.is_empty() || h_str.len() > 2 || m_str.len() != 2 {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    let hour: u8 = h_str
        .parse()
        .map_err(|_| ApiError::Validation(format!("{field} must be in HH:MM 24-hour format")))?;
    let minute: u8 = m_str
        .parse()
        .map_err(|_| ApiError::Validation(format!("{field} must be in HH:MM 24-hour format")))?;
    if hour > 23 || minute > 59 {
        return Err(ApiError::Validation(format!(
            "{field} must be in HH:MM 24-hour format"
        )));
    }
    Ok(format!("{hour:02}:{minute:02}"))
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    is_active: Option<bool>,
    is_default: Option<bool>,
    department_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(v) = is_active {
        filter.insert("isActive", v);
    }
    if let Some(v) = is_default {
        filter.insert("isDefault", v);
    }
    if let Some(d) = department_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("departmentIds", d);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_oid_vec(input: Option<Vec<String>>) -> Vec<ObjectId> {
    input
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

fn shift_from_create(input: CreateShiftInput, user_id: ObjectId) -> Result<CrmShift> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let start_time = validate_hhmm("startTime", &input.start_time)?;
    let end_time = validate_hhmm("endTime", &input.end_time)?;
    Ok(CrmShift {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        start_time,
        end_time,
        break_minutes: input.break_minutes,
        grace_minutes: input.grace_minutes,
        is_night_shift: input.is_night_shift.unwrap_or(false),
        working_days: input.working_days.unwrap_or_default(),
        color: input
            .color
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        is_default: input.is_default.unwrap_or(false),
        department_ids: parse_oid_vec(input.department_ids),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateShiftInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.start_time.as_deref() {
        let t = validate_hhmm("startTime", v)?;
        set.insert("startTime", t);
    }
    if let Some(v) = patch.end_time.as_deref() {
        let t = validate_hhmm("endTime", v)?;
        set.insert("endTime", t);
    }
    if let Some(v) = patch.break_minutes {
        set.insert("breakMinutes", v);
    }
    if let Some(v) = patch.grace_minutes {
        set.insert("graceMinutes", v);
    }
    if let Some(v) = patch.is_night_shift {
        set.insert("isNightShift", v);
    }
    if let Some(v) = patch.working_days {
        set.insert("workingDays", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.department_ids {
        let arr: Vec<ObjectId> = v
            .into_iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert("departmentIds", arr);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmShift) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmShift>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_shifts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.is_active,
        q.is_default,
        q.department_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "description"]);
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
    let coll = mongo.collection::<CrmShift>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find")))?;
    let mut rows: Vec<CrmShift> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn get_shift(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
) -> Result<Json<CrmShift>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_shift(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateShiftInput>,
) -> Result<Json<CreateShiftResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = shift_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    if entity.is_default {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateShiftResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn update_shift(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
    Json(patch): Json<UpdateShiftInput>,
) -> Result<Json<CrmShift>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
    if matches!(patch.is_default, Some(true)) {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true, "_id": { "$ne": oid } },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("shift".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %shift_id))]
pub async fn delete_shift(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(shift_id): Path<String>,
) -> Result<Json<DeleteShiftResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&shift_id)?;
    let coll = mongo.collection::<CrmShift>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_shifts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("shift".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteShiftResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_hhmm_accepts_valid_times() {
        assert_eq!(validate_hhmm("startTime", "09:00").unwrap(), "09:00");
        assert_eq!(validate_hhmm("startTime", "23:59").unwrap(), "23:59");
        assert_eq!(validate_hhmm("startTime", "00:00").unwrap(), "00:00");
        // single-digit hour is normalised to two digits
        assert_eq!(validate_hhmm("startTime", "9:05").unwrap(), "09:05");
    }

    #[test]
    fn validate_hhmm_rejects_invalid_times() {
        assert!(validate_hhmm("startTime", "").is_err());
        assert!(validate_hhmm("startTime", "24:00").is_err());
        assert!(validate_hhmm("startTime", "12:60").is_err());
        assert!(validate_hhmm("startTime", "12").is_err());
        assert!(validate_hhmm("startTime", "12:00:00").is_err());
        assert!(validate_hhmm("startTime", "ab:cd").is_err());
        assert!(validate_hhmm("startTime", "12:5").is_err());
    }

    #[test]
    fn shift_from_create_defaults_and_rejects_empty_name() {
        let user_id = ObjectId::new();
        let ok = CreateShiftInput {
            name: "Morning".into(),
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        let s = shift_from_create(ok, user_id).unwrap();
        assert_eq!(s.name, "Morning");
        assert_eq!(s.start_time, "09:00");
        assert_eq!(s.end_time, "18:00");
        assert_eq!(s.status, "active");
        assert!(s.is_active);
        assert!(!s.is_default);
        assert!(!s.is_night_shift);

        let bad = CreateShiftInput {
            name: "   ".into(),
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        assert!(shift_from_create(bad, user_id).is_err());

        let bad_time = CreateShiftInput {
            name: "Morning".into(),
            start_time: "9".into(),
            end_time: "18:00".into(),
            ..Default::default()
        };
        assert!(shift_from_create(bad_time, user_id).is_err());
    }
}
