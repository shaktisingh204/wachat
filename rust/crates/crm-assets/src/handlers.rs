//! HTTP handlers for the IT/office Asset entity.

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
    CreateAssetInput, CreateAssetResponse, DeleteAssetResponse, ListQuery, UpdateAssetInput,
};
use crate::types::CrmAsset;

const COLL: &str = "crm_assets";
const ENTITY_KIND: &str = "asset";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    assignee_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "available" | "assigned" | "in_repair" | "retired" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(a) = assignee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("currentAssigneeId", a);
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

fn normalize_tag(s: &str) -> String {
    s.trim().to_owned()
}

/// Status auto-flip rules: assigning sets `"assigned"`, unassigning
/// while currently `"assigned"` resets to `"available"`. Other
/// terminal statuses (`in_repair`, `retired`, `archived`) are
/// preserved.
fn auto_status_for_assignee(
    has_assignee: bool,
    current_status: &str,
    explicit_status: Option<&str>,
) -> Option<String> {
    if explicit_status.is_some() {
        return None;
    }
    if has_assignee {
        if current_status == "available" || current_status == "assigned" {
            return Some("assigned".to_owned());
        }
        None
    } else if current_status == "assigned" {
        Some("available".to_owned())
    } else {
        None
    }
}

fn asset_from_create(input: CreateAssetInput, user_id: ObjectId) -> Result<CrmAsset> {
    let asset_tag = normalize_tag(&input.asset_tag);
    if asset_tag.is_empty() {
        return Err(ApiError::Validation("assetTag is required".to_owned()));
    }
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let assignee_oid = input
        .current_assignee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    let has_assignee = assignee_oid.is_some();

    let status = input.status.clone().unwrap_or_else(|| {
        if has_assignee {
            "assigned".to_owned()
        } else {
            "available".to_owned()
        }
    });

    Ok(CrmAsset {
        id: None,
        user_id,
        asset_tag,
        name,
        category: input.category,
        brand: input.brand,
        model: input.model,
        serial_number: input.serial_number,
        purchase_date: input.purchase_date.as_deref().and_then(parse_date),
        purchase_price: input.purchase_price,
        currency: input.currency,
        warranty_expiry: input.warranty_expiry.as_deref().and_then(parse_date),
        location: input.location,
        branch_id: input
            .branch_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        current_assignee_id: assignee_oid,
        current_assignee_name: input.current_assignee_name,
        condition: input.condition,
        status,
        notes: input.notes,
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAssetInput, before: &CrmAsset) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let mut unset: Option<Document> = None;

    if let Some(v) = patch.asset_tag.as_ref().map(|s| s.trim().to_owned()) {
        set.insert("assetTag", v);
    }
    if let Some(v) = patch.name.as_ref().map(|s| s.trim().to_owned()) {
        set.insert("name", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.brand {
        set.insert("brand", v);
    }
    if let Some(v) = patch.model {
        set.insert("model", v);
    }
    if let Some(v) = patch.serial_number {
        set.insert("serialNumber", v);
    }
    if let Some(v) = patch.purchase_date.as_deref().and_then(parse_date) {
        set.insert("purchaseDate", v);
    }
    if let Some(v) = patch.purchase_price {
        set.insert("purchasePrice", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.warranty_expiry.as_deref().and_then(parse_date) {
        set.insert("warrantyExpiry", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch
        .branch_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("branchId", v);
    }

    // assignee patch handling (with auto status flip).
    // Field-present-and-null clears (also clears the cached name unless
    // the caller explicitly set one in this same patch).
    let mut new_has_assignee = before.current_assignee_id.is_some();
    let has_explicit_name = patch.current_assignee_name.is_some();
    if let Some(inner) = &patch.current_assignee_id {
        match inner {
            Some(s) => {
                if let Ok(oid) = ObjectId::parse_str(s.trim()) {
                    set.insert("currentAssigneeId", oid);
                    new_has_assignee = true;
                }
            }
            None => {
                let mut u = unset.unwrap_or_default();
                u.insert("currentAssigneeId", "");
                if !has_explicit_name {
                    u.insert("currentAssigneeName", "");
                }
                unset = Some(u);
                new_has_assignee = false;
            }
        }
    }
    if let Some(v) = patch.current_assignee_name {
        set.insert("currentAssigneeName", v);
    }

    if let Some(v) = patch.condition {
        set.insert("condition", v);
    }
    if let Some(v) = patch.status.clone() {
        set.insert("status", v);
    } else if let Some(auto) =
        auto_status_for_assignee(new_has_assignee, &before.status, patch.status.as_deref())
    {
        set.insert("status", auto);
    }

    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }

    let mut update = doc! { "$set": set };
    if let Some(u) = unset {
        update.insert("$unset", u);
    }
    update
}

fn doc_for_audit(entity: &CrmAsset) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

async fn ensure_tag_unique(
    mongo: &MongoHandle,
    user_id: ObjectId,
    asset_tag: &str,
    exclude_id: Option<ObjectId>,
) -> Result<()> {
    let coll = mongo.collection::<CrmAsset>(COLL);
    let mut filter = doc! {
        "userId": user_id,
        "assetTag": asset_tag,
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude_id {
        filter.insert("_id", doc! { "$ne": oid });
    }
    let existing = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_assets.find_one_unique"))
    })?;
    if existing.is_some() {
        return Err(ApiError::Conflict(format!(
            "assetTag '{}' already exists",
            asset_tag
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAsset>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_assets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.assignee_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "assetTag",
                "name",
                "brand",
                "model",
                "serialNumber",
                "location",
                "currentAssigneeName",
                "notes",
            ],
        );
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
    let coll = mongo.collection::<CrmAsset>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.find")))?;
    let mut rows: Vec<CrmAsset> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %asset_id))]
pub async fn get_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
) -> Result<Json<CrmAsset>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&asset_id)?;
    let coll = mongo.collection::<CrmAsset>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("asset".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAssetInput>,
) -> Result<Json<CreateAssetResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = asset_from_create(input, user_id)?;
    ensure_tag_unique(&mongo, user_id, &entity.asset_tag, None).await?;
    let coll = mongo.collection::<CrmAsset>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateAssetResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %asset_id))]
pub async fn update_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
    Json(patch): Json<UpdateAssetInput>,
) -> Result<Json<CrmAsset>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&asset_id)?;
    let coll = mongo.collection::<CrmAsset>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("asset".to_owned()))?;

    if let Some(tag) = patch
        .asset_tag
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if tag != before.asset_tag {
            ensure_tag_unique(&mongo, user_id, tag, Some(oid)).await?;
        }
    } else if patch.asset_tag.is_some() {
        return Err(ApiError::Validation("assetTag cannot be empty".to_owned()));
    }
    if let Some(name) = patch.name.as_deref() {
        if name.trim().is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
    }

    let update = build_update_doc(patch, &before);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("asset".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.refetch")))?
        .ok_or_else(|| ApiError::NotFound("asset".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %asset_id))]
pub async fn delete_asset(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(asset_id): Path<String>,
) -> Result<Json<DeleteAssetResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&asset_id)?;
    let coll = mongo.collection::<CrmAsset>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_assets.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("asset".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAssetResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_empty_asset_tag_and_name() {
        let user_id = ObjectId::new();
        let bad_tag = CreateAssetInput {
            asset_tag: "   ".into(),
            name: "Laptop".into(),
            ..Default::default()
        };
        assert!(asset_from_create(bad_tag, user_id).is_err());

        let bad_name = CreateAssetInput {
            asset_tag: "LAP-001".into(),
            name: "".into(),
            ..Default::default()
        };
        assert!(asset_from_create(bad_name, user_id).is_err());
    }

    #[test]
    fn create_defaults_status_based_on_assignee() {
        let user_id = ObjectId::new();
        let unassigned = CreateAssetInput {
            asset_tag: "LAP-001".into(),
            name: "MBP 14".into(),
            ..Default::default()
        };
        assert_eq!(
            asset_from_create(unassigned, user_id).unwrap().status,
            "available"
        );

        let assigned = CreateAssetInput {
            asset_tag: "LAP-002".into(),
            name: "MBP 16".into(),
            current_assignee_id: Some(ObjectId::new().to_hex()),
            ..Default::default()
        };
        assert_eq!(
            asset_from_create(assigned, user_id).unwrap().status,
            "assigned"
        );
    }

    #[test]
    fn auto_status_flip_rules() {
        // assigning while available → assigned
        assert_eq!(
            auto_status_for_assignee(true, "available", None).as_deref(),
            Some("assigned")
        );
        // unassigning while assigned → available
        assert_eq!(
            auto_status_for_assignee(false, "assigned", None).as_deref(),
            Some("available")
        );
        // explicit status wins (no auto flip)
        assert_eq!(
            auto_status_for_assignee(true, "available", Some("in_repair")),
            None
        );
        // terminal statuses preserved
        assert_eq!(auto_status_for_assignee(true, "retired", None), None);
        assert_eq!(auto_status_for_assignee(false, "in_repair", None), None);
    }

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }
}
