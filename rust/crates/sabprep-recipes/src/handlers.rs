//! HTTP handlers for `/v1/sabprep/recipes`.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`.
//! Best-effort audit rows are written to `crm_audit_log`.

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
use sabprep_steps::{Row, Step, StepKind, apply_steps};
use tracing::instrument;

use crate::dto::{
    CreateRecipeInput, CreateRecipeResponse, DeleteRecipeResponse, ListQuery, ListResponse,
    PreviewInput, PreviewResponse, RunRecipeInput, RunRecipeResponse, UpdateRecipeInput,
};
use crate::types::SabprepRecipe;

const RECIPES_COLL: &str = "sabprep_recipes";
const OUTPUTS_COLL: &str = "sabprep_outputs";
const RUNS_COLL: &str = "sabprep_runs";
const ENTITY_KIND: &str = "sabprep_recipe";

const DEFAULT_PREVIEW_LIMIT: usize = 50;
const MAX_PREVIEW_LIMIT: usize = 500;

// ─── filter helpers ─────────────────────────────────────────────────────

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

fn ownership_filter(user_id: ObjectId, recipe_oid: ObjectId) -> Document {
    doc! { "_id": recipe_oid, "userId": user_id }
}

// ─── mapping helpers ────────────────────────────────────────────────────

fn parse_optional_oid(s: &Option<String>) -> Result<Option<ObjectId>> {
    match s {
        Some(s) if !s.trim().is_empty() => {
            let oid = oid_from_str(s)?;
            Ok(Some(oid))
        }
        _ => Ok(None),
    }
}

fn recipe_from_create(input: CreateRecipeInput, user_id: ObjectId) -> Result<SabprepRecipe> {
    Ok(SabprepRecipe {
        id: None,
        user_id,
        name: input.name,
        description: input.description,
        source_dataset_id: parse_optional_oid(&input.source_dataset_id)?,
        source_columns: input.source_columns,
        steps: input.steps,
        output_dataset_id: None,
        last_run_id: None,
        schedule_cron: input.schedule_cron,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    })
}

fn build_update_doc(patch: UpdateRecipeInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.source_dataset_id {
        if v.trim().is_empty() {
            set.insert("sourceDatasetId", bson::Bson::Null);
        } else {
            set.insert("sourceDatasetId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.source_columns {
        set.insert(
            "sourceColumns",
            bson::to_bson(&v).unwrap_or(bson::Bson::Null),
        );
    }
    if let Some(v) = patch.steps {
        set.insert("steps", bson::to_bson(&v).unwrap_or(bson::Bson::Null));
    }
    if let Some(v) = patch.schedule_cron {
        set.insert("scheduleCron", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(recipe: &SabprepRecipe) -> Document {
    bson::to_document(recipe).unwrap_or_default()
}

// ─── GET / ──────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_recipes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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

    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.find"))
        })?;
    let mut rows: Vec<SabprepRecipe> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.collect"))
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

// ─── GET /:id ───────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, recipe_id = %recipe_id))]
pub async fn get_recipe(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recipe_id): Path<String>,
) -> Result<Json<SabprepRecipe>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recipe_id)?;
    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_recipe".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_recipe(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRecipeInput>,
) -> Result<Json<CreateRecipeResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut recipe = recipe_from_create(input, user_id)?;
    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let inserted = coll
        .insert_one(&recipe)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    recipe.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&recipe)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateRecipeResponse {
        id: new_id.to_hex(),
        entity: recipe,
    }))
}

// ─── PATCH /:id ─────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, recipe_id = %recipe_id))]
pub async fn update_recipe(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recipe_id): Path<String>,
    Json(patch): Json<UpdateRecipeInput>,
) -> Result<Json<SabprepRecipe>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recipe_id)?;
    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_recipe".to_owned()))?;

    let update = build_update_doc(patch)?;
    coll.update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.update")))?;

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_recipe".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, recipe_id = %recipe_id))]
pub async fn delete_recipe(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recipe_id): Path<String>,
) -> Result<Json<DeleteRecipeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recipe_id)?;
    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let update = doc! {
        "$set": {
            "status": "archived",
            "updatedAt": BsonDateTime::from_chrono(Utc::now()),
        }
    };
    let res = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.archive"))
        })?;
    let deleted = res.matched_count > 0;
    if deleted {
        if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
            write_audit(&mongo, event).await;
        }
    }
    Ok(Json(DeleteRecipeResponse { deleted }))
}

// ─── POST /preview ──────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, n_steps = input.steps.len()))]
pub async fn preview_recipe(
    user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Json(input): Json<PreviewInput>,
) -> Result<Json<PreviewResponse>> {
    let _ = user_oid(&user)?;
    let limit = input
        .limit
        .map(|n| (n as usize).min(MAX_PREVIEW_LIMIT))
        .unwrap_or(DEFAULT_PREVIEW_LIMIT);
    // Resolved-row injection for joins/unions is the caller's job — preview
    // runs with whatever `right_rows`/`other_rows` are in the body.
    let res = apply_steps(input.rows, &input.steps);
    let rows_total = res.rows.len() as u32;
    let mut rows = res.rows;
    if rows.len() > limit {
        rows.truncate(limit);
    }
    Ok(Json(PreviewResponse {
        rows,
        summaries: res.summaries,
        total_errors: res.total_errors,
        rows_total,
    }))
}

// ─── POST /:id/run ──────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, recipe_id = %recipe_id))]
pub async fn run_recipe(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recipe_id): Path<String>,
    Json(input): Json<RunRecipeInput>,
) -> Result<Json<RunRecipeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recipe_id)?;
    let coll = mongo.collection::<SabprepRecipe>(RECIPES_COLL);
    let recipe = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_recipes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabprep_recipe".to_owned()))?;

    let started = Utc::now();
    let source_rows: Vec<Row> = if let Some(rows) = input.rows {
        rows
    } else {
        fetch_source_rows(&mongo, user_id, recipe.source_dataset_id).await?
    };

    let rows_in = source_rows.len() as u32;
    // Resolve any cross-dataset references on join/union steps.
    let steps = resolve_cross_dataset_refs(&mongo, user_id, recipe.steps.clone()).await?;

    let result = apply_steps(source_rows, &steps);
    let rows_out = result.rows.len() as u32;
    let finished = Utc::now();
    let status_str = if result.total_errors == 0 {
        "ok"
    } else {
        "partial"
    };

    // Persist output rows (if requested).
    let output_dataset_id: Option<ObjectId> = if input.persist_output {
        let outputs_coll = mongo.collection::<Document>(OUTPUTS_COLL);
        let output_doc = doc! {
            "userId": user_id,
            "recipeId": oid,
            "rows": bson::to_bson(&result.rows).unwrap_or(bson::Bson::Array(vec![])),
            "rowsCount": rows_out as i64,
            "createdAt": BsonDateTime::from_chrono(finished),
        };
        let inserted = outputs_coll.insert_one(output_doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabprep_outputs.insert"))
        })?;
        inserted.inserted_id.as_object_id()
    } else {
        None
    };

    // Persist a run row.
    let runs_coll = mongo.collection::<Document>(RUNS_COLL);
    let errors_bson = bson::to_bson(
        &result
            .summaries
            .iter()
            .flat_map(|s| s.errors.iter().cloned())
            .collect::<Vec<_>>(),
    )
    .unwrap_or(bson::Bson::Array(vec![]));
    let run_doc = doc! {
        "userId": user_id,
        "recipeId": oid,
        "startedAt": BsonDateTime::from_chrono(started),
        "finishedAt": BsonDateTime::from_chrono(finished),
        "status": status_str,
        "rowsIn": rows_in as i64,
        "rowsOut": rows_out as i64,
        "errors": errors_bson,
        "summaries": bson::to_bson(&result.summaries).unwrap_or(bson::Bson::Array(vec![])),
        "outputDatasetId": output_dataset_id.map(bson::Bson::ObjectId).unwrap_or(bson::Bson::Null),
    };
    let inserted_run = runs_coll
        .insert_one(run_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabprep_runs.insert")))?;
    let run_id = inserted_run
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("run inserted_id was not ObjectId")))?;

    // Update recipe with last run + last output ids.
    let mut set = doc! { "lastRunId": run_id, "updatedAt": BsonDateTime::from_chrono(finished) };
    if let Some(out_id) = output_dataset_id {
        set.insert("outputDatasetId", out_id);
    }
    let _ = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await;

    Ok(Json(RunRecipeResponse {
        run_id: run_id.to_hex(),
        output_dataset_id: output_dataset_id.map(|o| o.to_hex()),
        rows_in,
        rows_out,
        status: status_str.to_owned(),
        summaries: result.summaries,
    }))
}

/// Look up rows for the recipe's source dataset. Supports `sabprep_outputs`
/// today; `bi_datasets` lookup is a follow-up (TODO when BI execution
/// engine exposes a rows-fetcher).
async fn fetch_source_rows(
    mongo: &MongoHandle,
    user_id: ObjectId,
    source_id: Option<ObjectId>,
) -> Result<Vec<Row>> {
    let Some(source_id) = source_id else {
        return Ok(vec![]);
    };
    let coll = mongo.collection::<Document>(OUTPUTS_COLL);
    if let Some(doc) = coll
        .find_one(doc! { "_id": source_id, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabprep_outputs.find_one"))
        })?
    {
        if let Ok(rows_bson) = doc.get_array("rows") {
            let rows: Vec<Row> =
                bson::from_bson(bson::Bson::Array(rows_bson.clone())).unwrap_or_default();
            return Ok(rows);
        }
    }
    // TODO: when bi-datasets exposes a row-fetcher, fall back to it here.
    Ok(vec![])
}

/// Inject `right_rows` / `other_rows` for join / union steps by fetching
/// the referenced datasets from `sabprep_outputs`.
async fn resolve_cross_dataset_refs(
    mongo: &MongoHandle,
    user_id: ObjectId,
    mut steps: Vec<Step>,
) -> Result<Vec<Step>> {
    for step in &mut steps {
        match &mut step.kind {
            StepKind::Join(op) => {
                if let Ok(id) = oid_from_str(&op.right_dataset_id) {
                    op.right_rows = fetch_source_rows(mongo, user_id, Some(id)).await?;
                }
            }
            StepKind::Union(op) => {
                if let Ok(id) = oid_from_str(&op.other_dataset_id) {
                    op.other_rows = fetch_source_rows(mongo, user_id, Some(id)).await?;
                }
            }
            _ => {}
        }
    }
    Ok(steps)
}
