//! HTTP handlers for the OKR entity.

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

use crate::dto::{CreateOkrInput, CreateOkrResponse, DeleteOkrResponse, ListQuery, UpdateOkrInput};
use crate::types::{CrmOkr, KeyResult};

const COLL: &str = "crm_okrs";
const ENTITY_KIND: &str = "okr";

const ALLOWED_STATUS: &[&str] = &[
    "draft",
    "in_progress",
    "on_track",
    "at_risk",
    "behind",
    "completed",
    "missed",
    "archived",
];

const ALLOWED_KR_STATUS: &[&str] = &["on_track", "at_risk", "behind", "completed"];

fn clamp_pct(v: f64) -> f64 {
    if v.is_nan() {
        0.0
    } else if v < 0.0 {
        0.0
    } else if v > 100.0 {
        100.0
    } else {
        v
    }
}

fn clamp_pct_opt(p: Option<f64>) -> Option<f64> {
    p.map(clamp_pct)
}

fn normalize_status(raw: Option<String>) -> String {
    match raw {
        Some(s) => {
            let trimmed = s.trim();
            if ALLOWED_STATUS.contains(&trimmed) {
                trimmed.to_owned()
            } else {
                "draft".to_owned()
            }
        }
        None => "draft".to_owned(),
    }
}

fn normalize_kr_status(raw: &str) -> String {
    let t = raw.trim();
    if ALLOWED_KR_STATUS.contains(&t) {
        t.to_owned()
    } else {
        "on_track".to_owned()
    }
}

fn normalize_key_results(mut krs: Vec<KeyResult>) -> Vec<KeyResult> {
    for kr in krs.iter_mut() {
        kr.status = normalize_kr_status(&kr.status);
        kr.target_value = kr.target_value.filter(|v| !v.is_nan());
        kr.current_value = kr.current_value.filter(|v| !v.is_nan());
        if let Some(w) = kr.weight {
            if w.is_nan() || w < 0.0 {
                kr.weight = Some(0.0);
            }
        }
    }
    krs
}

/// Weighted-average progress across KRs. KR progress = `current / target`
/// clamped to `[0, 100]` (or 100 when KR is `completed`). Missing weights
/// default to `1.0`. Returns `None` when KRs are empty or total weight is
/// zero.
fn compute_progress_from_krs(krs: &[KeyResult]) -> Option<f64> {
    if krs.is_empty() {
        return None;
    }
    let mut weighted_sum = 0.0_f64;
    let mut total_weight = 0.0_f64;
    for kr in krs {
        let weight = kr.weight.unwrap_or(1.0).max(0.0);
        if weight == 0.0 {
            continue;
        }
        let kr_progress = if kr.status == "completed" {
            100.0
        } else {
            match (kr.target_value, kr.current_value) {
                (Some(t), Some(c)) if t > 0.0 => clamp_pct((c / t) * 100.0),
                _ => 0.0,
            }
        };
        weighted_sum += kr_progress * weight;
        total_weight += weight;
    }
    if total_weight <= 0.0 {
        None
    } else {
        Some(clamp_pct(weighted_sum / total_weight))
    }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    period: Option<&str>,
    owner_id: Option<&str>,
    department_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        s if ALLOWED_STATUS.contains(&s) => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(p) = period.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", p);
    }
    if let Some(oid) = owner_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("ownerId", oid);
    }
    if let Some(oid) = department_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("departmentId", oid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn okr_from_create(input: CreateOkrInput, user_id: ObjectId) -> Result<CrmOkr> {
    let objective = input.objective.trim();
    if objective.is_empty() {
        return Err(ApiError::Validation("objective is required".to_owned()));
    }
    let krs = normalize_key_results(input.key_results.unwrap_or_default());
    let explicit_progress = input.progress.is_some();
    let progress = if explicit_progress {
        clamp_pct(input.progress.unwrap())
    } else {
        compute_progress_from_krs(&krs).unwrap_or(0.0)
    };
    Ok(CrmOkr {
        id: None,
        user_id,
        objective: objective.to_owned(),
        description: input.description,
        period: input.period,
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        owner_name: input.owner_name,
        team_id: input
            .team_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        department_id: input
            .department_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        parent_okr_id: input
            .parent_okr_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        key_results: krs,
        progress,
        confidence: clamp_pct_opt(input.confidence),
        status: normalize_status(input.status),
        start_date: input.start_date.as_deref().and_then(parse_date),
        end_date: input.end_date.as_deref().and_then(parse_date),
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateOkrInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .objective
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("objective", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.period {
        set.insert("period", v);
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.owner_name {
        set.insert("ownerName", v);
    }
    if let Some(v) = patch
        .team_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("teamId", v);
    }
    if let Some(v) = patch
        .department_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("departmentId", v);
    }
    if let Some(v) = patch
        .parent_okr_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("parentOkrId", v);
    }

    let explicit_progress = patch.progress.is_some();
    let patched_krs = patch.key_results.map(normalize_key_results);
    if let Some(ref krs) = patched_krs {
        let arr: Vec<Document> = krs
            .iter()
            .filter_map(|kr| bson::to_document(kr).ok())
            .collect();
        set.insert("keyResults", arr);
    }

    // Auto-compute progress from new KRs unless caller supplied an explicit
    // progress value. Only triggered when the patch *did* include
    // `keyResults`; otherwise leave progress untouched.
    if explicit_progress {
        if let Some(p) = clamp_pct_opt(patch.progress) {
            set.insert("progress", p);
        }
    } else if let Some(ref krs) = patched_krs {
        if !krs.is_empty() {
            if let Some(p) = compute_progress_from_krs(krs) {
                set.insert("progress", p);
            }
        }
    }

    if let Some(v) = clamp_pct_opt(patch.confidence) {
        set.insert("confidence", v);
    }
    if let Some(v) = patch
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| ALLOWED_STATUS.contains(s))
    {
        set.insert("status", v.to_owned());
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_date) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.end_date.as_deref().and_then(parse_date) {
        set.insert("endDate", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmOkr) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmOkr>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_okrs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.period.as_deref(),
        q.owner_id.as_deref(),
        q.department_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["objective", "description", "ownerName", "period"]);
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
    let coll = mongo.collection::<CrmOkr>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.find")))?;
    let mut rows: Vec<CrmOkr> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %okr_id))]
pub async fn get_okr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(okr_id): Path<String>,
) -> Result<Json<CrmOkr>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&okr_id)?;
    let coll = mongo.collection::<CrmOkr>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("okr".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_okr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateOkrInput>,
) -> Result<Json<CreateOkrResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = okr_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmOkr>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateOkrResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %okr_id))]
pub async fn update_okr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(okr_id): Path<String>,
    Json(patch): Json<UpdateOkrInput>,
) -> Result<Json<CrmOkr>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&okr_id)?;
    let coll = mongo.collection::<CrmOkr>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("okr".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("okr".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("okr".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %okr_id))]
pub async fn delete_okr(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(okr_id): Path<String>,
) -> Result<Json<DeleteOkrResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&okr_id)?;
    let coll = mongo.collection::<CrmOkr>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_okrs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("okr".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteOkrResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kr(id: &str, target: f64, current: f64, weight: Option<f64>, status: &str) -> KeyResult {
        KeyResult {
            id: id.to_owned(),
            title: format!("KR {id}"),
            metric: None,
            target_value: Some(target),
            current_value: Some(current),
            unit: None,
            weight,
            status: status.to_owned(),
        }
    }

    #[test]
    fn okr_from_create_rejects_empty_objective() {
        let user_id = ObjectId::new();
        let input = CreateOkrInput {
            objective: "   ".into(),
            ..Default::default()
        };
        assert!(okr_from_create(input, user_id).is_err());
    }

    #[test]
    fn okr_from_create_defaults_status_and_clamps_confidence_and_explicit_progress() {
        let user_id = ObjectId::new();
        let input = CreateOkrInput {
            objective: "Grow ARR".into(),
            progress: Some(250.0),
            confidence: Some(-10.0),
            ..Default::default()
        };
        let o = okr_from_create(input, user_id).unwrap();
        assert_eq!(o.status, "draft");
        // Explicit progress is clamped, not overridden.
        assert_eq!(o.progress, 100.0);
        assert_eq!(o.confidence, Some(0.0));
    }

    #[test]
    fn okr_progress_auto_computed_as_weighted_average_when_not_supplied() {
        let user_id = ObjectId::new();
        // KR1: 50% done, weight 3  -> contributes 50 * 3 = 150
        // KR2: 100% done (completed), weight 1 -> contributes 100 * 1 = 100
        // total weight 4, expected progress = 250 / 4 = 62.5
        let input = CreateOkrInput {
            objective: "Ship V2".into(),
            key_results: Some(vec![
                kr("a", 100.0, 50.0, Some(3.0), "on_track"),
                kr("b", 1.0, 1.0, Some(1.0), "completed"),
            ]),
            ..Default::default()
        };
        let o = okr_from_create(input, user_id).unwrap();
        assert!((o.progress - 62.5).abs() < 1e-6, "got {}", o.progress);
    }
}
