//! HTTP handlers for the Production Order entity.

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
    CreateProductionOrderInput, CreateProductionOrderResponse, DeleteProductionOrderResponse,
    ListQuery, UpdateProductionOrderInput,
};
use crate::types::CrmProductionOrder;

const COLL: &str = "crm_production_orders";
const ENTITY_KIND: &str = "production_order";

fn list_filter(user_id: ObjectId, status: Option<&str>, bom_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "planned" | "in_progress" | "complete" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(b) = bom_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("bomId", b);
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

fn calc_material_cost(components: &[crate::types::ProductionComponent]) -> f64 {
    components
        .iter()
        .map(|c| c.qty * c.cost_per_unit.unwrap_or(0.0))
        .sum()
}

fn order_from_create(
    input: CreateProductionOrderInput,
    user_id: ObjectId,
) -> Result<CrmProductionOrder> {
    if input.finished_good_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "finishedGoodName is required".to_owned(),
        ));
    }
    if input.planned_qty <= 0.0 {
        return Err(ApiError::Validation(
            "plannedQty must be positive".to_owned(),
        ));
    }
    let order_no = input
        .order_no
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            let suffix = Utc::now().timestamp_millis().to_string();
            let tail = suffix.chars().rev().take(6).collect::<String>();
            format!("PO-{}", tail.chars().rev().collect::<String>())
        });
    let material_cost = calc_material_cost(&input.components);
    let labour = input.labour_cost.unwrap_or(0.0);
    let overhead = input.overhead_cost.unwrap_or(0.0);
    let total = ((material_cost + labour + overhead) * 100.0).round() / 100.0;
    Ok(CrmProductionOrder {
        id: None,
        user_id,
        order_no,
        bom_ref: input.bom_ref,
        bom_id: input
            .bom_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        finished_good_id: input
            .finished_good_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        finished_good_name: input.finished_good_name.trim().to_owned(),
        planned_qty: input.planned_qty,
        actual_yield: 0.0,
        scrap: 0.0,
        unit: input.unit,
        planned_start: input.planned_start.as_deref().and_then(parse_date),
        planned_end: input.planned_end.as_deref().and_then(parse_date),
        machine_id: input.machine_id,
        machine_operator: input.machine_operator,
        machine_operator_id: input
            .machine_operator_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        notes: input.notes,
        status: Some("planned".to_owned()),
        components: input.components,
        labour_cost: Some(labour),
        overhead_cost: Some(overhead),
        material_cost: Some(material_cost),
        total_cost: Some(total),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProductionOrderInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.order_no {
        set.insert("orderNo", v);
    }
    if let Some(v) = patch.bom_ref {
        set.insert("bomRef", v);
    }
    if let Some(v) = patch
        .bom_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("bomId", v);
    }
    if let Some(v) = patch
        .finished_good_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("finishedGoodId", v);
    }
    if let Some(v) = patch.finished_good_name {
        set.insert("finishedGoodName", v);
    }
    if let Some(v) = patch.planned_qty {
        set.insert("plannedQty", v);
    }
    if let Some(v) = patch.actual_yield {
        set.insert("actualYield", v);
    }
    if let Some(v) = patch.scrap {
        set.insert("scrap", v);
    }
    if let Some(v) = patch.unit {
        set.insert("unit", v);
    }
    if let Some(v) = patch.planned_start.as_deref().and_then(parse_date) {
        set.insert("plannedStart", v);
    }
    if let Some(v) = patch.planned_end.as_deref().and_then(parse_date) {
        set.insert("plannedEnd", v);
    }
    if let Some(v) = patch.machine_id {
        set.insert("machineId", v);
    }
    if let Some(v) = patch.machine_operator {
        set.insert("machineOperator", v);
    }
    if let Some(v) = patch
        .machine_operator_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("machineOperatorId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.components {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("components", arr);
    }
    if let Some(v) = patch.labour_cost {
        set.insert("labourCost", v);
    }
    if let Some(v) = patch.overhead_cost {
        set.insert("overheadCost", v);
    }
    if let Some(v) = patch.material_cost {
        set.insert("materialCost", v);
    }
    if let Some(v) = patch.total_cost {
        set.insert("totalCost", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmProductionOrder) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmProductionOrder>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_orders(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.bom_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["orderNo", "finishedGoodName", "notes", "bomRef"]);
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
    let coll = mongo.collection::<CrmProductionOrder>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.find"))
    })?;
    let mut rows: Vec<CrmProductionOrder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn get_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
) -> Result<Json<CrmProductionOrder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmProductionOrder>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("production_order".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProductionOrderInput>,
) -> Result<Json<CreateProductionOrderResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = order_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmProductionOrder>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateProductionOrderResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn update_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
    Json(patch): Json<UpdateProductionOrderInput>,
) -> Result<Json<CrmProductionOrder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmProductionOrder>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("production_order".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("production_order".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("production_order".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %order_id))]
pub async fn delete_order(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(order_id): Path<String>,
) -> Result<Json<DeleteProductionOrderResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&order_id)?;
    let coll = mongo.collection::<CrmProductionOrder>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_production_orders.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("production_order".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProductionOrderResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn order_from_create_seeds_status_and_material_cost() {
        let user_id = ObjectId::new();
        let input = CreateProductionOrderInput {
            finished_good_name: "Widget".into(),
            planned_qty: 100.0,
            unit: "pcs".into(),
            components: vec![crate::types::ProductionComponent {
                item_id: None,
                item_name: "Resin".into(),
                qty: 5.0,
                unit: "kg".into(),
                scrap_pct: 0.0,
                cost_per_unit: Some(20.0),
            }],
            ..Default::default()
        };
        let o = order_from_create(input, user_id).unwrap();
        assert_eq!(o.status.as_deref(), Some("planned"));
        assert_eq!(o.material_cost, Some(100.0));
        assert!(o.order_no.starts_with("PO-"));
    }

    #[test]
    fn order_from_create_rejects_zero_planned() {
        let user_id = ObjectId::new();
        let input = CreateProductionOrderInput {
            finished_good_name: "Widget".into(),
            planned_qty: 0.0,
            unit: "pcs".into(),
            ..Default::default()
        };
        assert!(order_from_create(input, user_id).is_err());
    }
}
