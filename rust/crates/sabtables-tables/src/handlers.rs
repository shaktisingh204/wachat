//! HTTP handlers for the Table-schema entity.

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
    AddFieldInput, CreateTableInput, CreateTableResponse, DeleteTableResponse, ListQuery,
    UpdateFieldInput, UpdateTableInput,
};
use crate::types::{SabtablesField, SabtablesFieldType, SabtablesTable};

const COLL: &str = "sabtables_tables";

fn gen_field_id() -> String {
    // ObjectId hex is 24 chars; plenty for a stable field id.
    format!("fld_{}", ObjectId::new().to_hex())
}

fn list_filter(user_id: ObjectId, base_id: Option<ObjectId>, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(b) = base_id {
        filter.insert("baseId", b);
    }
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
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesTable>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tables(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let base_oid = match q.base_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let mut filter = list_filter(user_id, base_oid, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.find"))
        })?;
    let mut rows: Vec<SabtablesTable> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id))]
pub async fn get_table(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(table_id): Path<String>,
) -> Result<Json<SabtablesTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("table".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_table(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTableInput>,
) -> Result<Json<CreateTableResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let base_oid = oid_from_str(&input.base_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());

    // Seed a `Name` primary text-field when caller did not supply one.
    let (fields, primary_field_id) = match input.fields {
        Some(mut fs) if !fs.is_empty() => {
            // Ensure each field has a stable id.
            for f in fs.iter_mut() {
                if f.id.trim().is_empty() {
                    f.id = gen_field_id();
                }
            }
            let primary = input
                .primary_field_id
                .filter(|p| fs.iter().any(|f| &f.id == p))
                .unwrap_or_else(|| fs[0].id.clone());
            (fs, primary)
        }
        _ => {
            let id = gen_field_id();
            let f = SabtablesField {
                id: id.clone(),
                name: "Name".to_owned(),
                field_type: SabtablesFieldType::Text,
                options: None,
                order: Some(0),
                is_required: true,
            };
            (vec![f], id)
        }
    };

    let mut entity = SabtablesTable {
        id: None,
        user_id,
        base_id: base_oid,
        name: input.name.trim().to_owned(),
        description: input.description,
        primary_field_id,
        fields,
        records_count: 0,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateTableResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id))]
pub async fn update_table(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(table_id): Path<String>,
    Json(patch): Json<UpdateTableInput>,
) -> Result<Json<SabtablesTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(mut fs) = patch.fields {
        for f in fs.iter_mut() {
            if f.id.trim().is_empty() {
                f.id = gen_field_id();
            }
        }
        let bson_fields = bson::to_bson(&fs).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.serialize_fields"))
        })?;
        set.insert("fields", bson_fields);
    }
    if let Some(v) = patch.primary_field_id {
        set.insert("primaryFieldId", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("table".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.refetch")))?
        .ok_or_else(|| ApiError::NotFound("table".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id))]
pub async fn delete_table(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(table_id): Path<String>,
) -> Result<Json<DeleteTableResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("table".to_owned()));
    }
    Ok(Json(DeleteTableResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id))]
pub async fn add_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(table_id): Path<String>,
    Json(input): Json<AddFieldInput>,
) -> Result<Json<SabtablesTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let mut field = input.field;
    if field.id.trim().is_empty() {
        field.id = gen_field_id();
    }
    let bson_field = bson::to_bson(&field).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.serialize_field"))
    })?;
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$push": { "fields": bson_field },
                "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.add_field"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("table".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.refetch")))?
        .ok_or_else(|| ApiError::NotFound("table".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id))]
pub async fn update_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(table_id): Path<String>,
    Json(input): Json<UpdateFieldInput>,
) -> Result<Json<SabtablesTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let mut set = doc! {
        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
    };
    if let Some(v) = input.name {
        set.insert("fields.$[f].name", v);
    }
    if let Some(v) = input.options {
        set.insert("fields.$[f].options", v);
    }
    if let Some(v) = input.is_required {
        set.insert("fields.$[f].isRequired", v);
    }
    let array_filters = vec![doc! { "f.id": &input.field_id }];
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .with_options(
            mongodb::options::UpdateOptions::builder()
                .array_filters(array_filters)
                .build(),
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.update_field"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("table".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.refetch")))?
        .ok_or_else(|| ApiError::NotFound("table".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %table_id, fld = %field_id))]
pub async fn delete_field(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((table_id, field_id)): Path<(String, String)>,
) -> Result<Json<SabtablesTable>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&table_id)?;
    let coll = mongo.collection::<SabtablesTable>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$pull": { "fields": { "id": &field_id } },
                "$set": { "updatedAt": BsonDateTime::from_chrono(Utc::now()) }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.delete_field"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("table".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabtables_tables.refetch")))?
        .ok_or_else(|| ApiError::NotFound("table".to_owned()))?;
    Ok(Json(after))
}
