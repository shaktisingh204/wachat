//! HTTP handlers for SabSheet cells + formula recompute.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    EvaluateFormulaInput, EvaluateFormulaResponse, ListCellsQuery, ListCellsResponse,
    RecomputeInput, RecomputeResponse, SetCellInput, SetCellResponse,
};
use crate::formula::{self, CellAddr, FormulaContext, RangeAddr, Value};
use crate::types::{CellRef, CellValue, SabsheetCell};

pub(crate) const COLL: &str = "sabsheet_cells";
const SHEET_COLL: &str = "sabsheet_sheets";

/// Snapshot of a workbook's cells used by the formula engine.
struct WorkbookCtx {
    by_addr: HashMap<(ObjectId, u32, u32), Value>,
    sheet_id_by_name: HashMap<String, ObjectId>,
    current_sheet: ObjectId,
}

impl FormulaContext for WorkbookCtx {
    fn resolve_cell(&self, addr: &CellAddr) -> Value {
        let sheet_id = match &addr.sheet {
            Some(name) => match self.sheet_id_by_name.get(name) {
                Some(id) => *id,
                None => return Value::Error(format!("#REF!({name})")),
            },
            None => self.current_sheet,
        };
        self.by_addr
            .get(&(sheet_id, addr.row, addr.col))
            .cloned()
            .unwrap_or(Value::Empty)
    }
    fn resolve_named_range(&self, _name: &str) -> Option<RangeAddr> {
        None // TODO: pre-load from sabsheet_named_ranges
    }
}

fn cell_value_to_eval(v: &CellValue) -> Value {
    match v {
        CellValue::Number(n) => Value::Number(*n),
        CellValue::Text(s) => Value::Text(s.clone()),
        CellValue::Bool(b) => Value::Bool(*b),
        CellValue::Null(()) => Value::Empty,
    }
}

fn eval_to_cell_value(v: &Value) -> Option<CellValue> {
    match v {
        Value::Number(n) => Some(CellValue::Number(*n)),
        Value::Text(s) => Some(CellValue::Text(s.clone())),
        Value::Bool(b) => Some(CellValue::Bool(*b)),
        Value::Empty => None,
        Value::Error(e) => Some(CellValue::Text(e.clone())),
    }
}

fn parse_literal(input: &str) -> CellValue {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return CellValue::Null(());
    }
    if let Ok(n) = trimmed.parse::<f64>() {
        return CellValue::Number(n);
    }
    match trimmed.to_uppercase().as_str() {
        "TRUE" => CellValue::Bool(true),
        "FALSE" => CellValue::Bool(false),
        _ => CellValue::Text(input.to_owned()),
    }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_cells(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListCellsQuery>,
) -> Result<Json<ListCellsResponse>> {
    let user_id = user_oid(&user)?;
    let sheet_id = oid_from_str(&q.sheet_id)?;
    let coll = mongo.collection::<SabsheetCell>(COLL);
    let mut filter = doc! { "sheetId": sheet_id, "ownerUserId": user_id };
    if let (Some(min_r), Some(max_r)) = (q.min_row, q.max_row) {
        filter.insert("row", doc! { "$gte": min_r as i64, "$lte": max_r as i64 });
    }
    if let (Some(min_c), Some(max_c)) = (q.min_col, q.max_col) {
        filter.insert("col", doc! { "$gte": min_c as i64, "$lte": max_c as i64 });
    }
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.find")))?;
    let items: Vec<SabsheetCell> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.collect")))?;
    Ok(Json(ListCellsResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn set_cell(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<SetCellInput>,
) -> Result<Json<SetCellResponse>> {
    let user_id = user_oid(&user)?;
    let sheet_id = oid_from_str(&input.sheet_id)?;

    // Look up workbook id from sheet so we can store it on the cell.
    let sheets = mongo.collection::<Document>(SHEET_COLL);
    let sheet_doc = sheets
        .find_one(doc! { "_id": sheet_id, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.sheet_lookup"))
        })?
        .ok_or_else(|| ApiError::NotFound("sheet".to_owned()))?;
    let workbook_id = sheet_doc
        .get_object_id("workbookId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sheet.workbookId missing")))?;

    let raw = input.value_or_formula.unwrap_or_default();
    let mut formula: Option<String> = None;
    let mut depends_on: Vec<CellRef> = Vec::new();
    let mut computed: Option<CellValue> = None;
    let value: Option<CellValue>;

    if let Some(src) = raw.strip_prefix('=') {
        formula = Some(src.to_owned());
        match formula::parse(src) {
            Ok(ast) => {
                // Build context from existing cells (single-pass — for the
                // initial save we ignore stale upstream values; full
                // recompute is run via /recompute).
                let ctx = build_ctx(&mongo, workbook_id, user_id, sheet_id).await?;
                let v = formula::eval(&ast, &ctx);
                computed = eval_to_cell_value(&v);
                value = computed.clone();
                depends_on = formula::collect_dependencies(&ast)
                    .into_iter()
                    .map(|a| CellRef {
                        sheet_id: a
                            .sheet
                            .as_ref()
                            .and_then(|n| ctx.sheet_id_by_name.get(n).cloned())
                            .unwrap_or(sheet_id),
                        row: a.row,
                        col: a.col,
                    })
                    .collect();
            }
            Err(e) => {
                value = Some(CellValue::Text(format!("#ERROR! {e}")));
                computed = value.clone();
            }
        }
    } else if raw.is_empty() {
        value = Some(CellValue::Null(()));
    } else {
        value = Some(parse_literal(&raw));
    }

    let now = BsonDateTime::from_chrono(Utc::now());

    let mut set_doc = doc! {
        "sheetId": sheet_id,
        "workbookId": workbook_id,
        "ownerUserId": user_id,
        "row": input.row as i64,
        "col": input.col as i64,
        "updatedAt": now,
    };
    if let Some(v) = &value {
        set_doc.insert("value", bson::to_bson(v).unwrap_or(bson::Bson::Null));
    } else {
        set_doc.insert("value", bson::Bson::Null);
    }
    if let Some(f) = &formula {
        set_doc.insert("formula", f.clone());
    } else {
        // Explicitly clear formula on literal write.
        set_doc.insert("formula", bson::Bson::Null);
    }
    if let Some(fmt) = &input.format {
        set_doc.insert("formatJson", fmt.clone());
    }
    let deps_bson = bson::to_bson(&depends_on).unwrap_or(bson::Bson::Array(vec![]));
    set_doc.insert("dependsOn", deps_bson);

    let cells = mongo.collection::<Document>(COLL);
    let filter = doc! {
        "sheetId": sheet_id,
        "row": input.row as i64,
        "col": input.col as i64,
        "ownerUserId": user_id,
    };
    cells
        .update_one(
            filter.clone(),
            doc! { "$set": set_doc, "$setOnInsert": { "createdAt": now } },
        )
        .upsert(true)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.upsert")))?;

    let typed = mongo.collection::<SabsheetCell>(COLL);
    let entity = typed
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.refetch")))?
        .ok_or_else(|| ApiError::NotFound("cell".to_owned()))?;

    // Find dependents — cells that reference (sheet_id,row,col) — for the
    // UI to re-fetch.
    let dependents_filter = doc! {
        "ownerUserId": user_id,
        "dependsOn": { "$elemMatch": {
            "sheetId": sheet_id,
            "row": input.row as i64,
            "col": input.col as i64,
        }},
    };
    let dep_cursor = typed.find(dependents_filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.dependents"))
    })?;
    let dep_rows: Vec<SabsheetCell> = dep_cursor.try_collect().await.unwrap_or_default();
    let affected = dep_rows
        .into_iter()
        .filter_map(|c| c.id.map(|id| id.to_hex()))
        .collect::<Vec<_>>();

    Ok(Json(SetCellResponse {
        entity,
        computed,
        affected,
    }))
}

/// Build a [`WorkbookCtx`] by scanning all cells in a workbook. This is the
/// O(N) path used during single-cell writes; the on-disk `dependsOn` graph
/// is used to scope down recomputes.
async fn build_ctx(
    mongo: &MongoHandle,
    workbook_id: ObjectId,
    user_id: ObjectId,
    current_sheet: ObjectId,
) -> Result<WorkbookCtx> {
    let cells = mongo.collection::<SabsheetCell>(COLL);
    let cursor = cells
        .find(doc! { "workbookId": workbook_id, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.ctx_scan"))
        })?;
    let rows: Vec<SabsheetCell> = cursor.try_collect().await.unwrap_or_default();
    let mut by_addr = HashMap::new();
    for r in &rows {
        if let Some(v) = &r.value {
            by_addr.insert((r.sheet_id, r.row, r.col), cell_value_to_eval(v));
        }
    }
    // Map sheet name -> id for `Sheet2!A1` references.
    let sheets = mongo.collection::<Document>(SHEET_COLL);
    let sheet_cursor = sheets
        .find(doc! { "workbookId": workbook_id, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_cells.sheet_scan"))
        })?;
    let sheet_docs: Vec<Document> = sheet_cursor.try_collect().await.unwrap_or_default();
    let mut sheet_id_by_name = HashMap::new();
    for d in &sheet_docs {
        if let (Ok(id), Ok(name)) = (d.get_object_id("_id"), d.get_str("name")) {
            sheet_id_by_name.insert(name.to_owned(), id);
        }
    }
    Ok(WorkbookCtx {
        by_addr,
        sheet_id_by_name,
        current_sheet,
    })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn evaluate_formula(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<EvaluateFormulaInput>,
) -> Result<Json<EvaluateFormulaResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    let src = input.formula.trim_start_matches('=');
    // Use first sheet of the workbook as the "current sheet" — caller can
    // refine later if needed.
    let sheets = mongo.collection::<Document>(SHEET_COLL);
    let first_sheet = sheets
        .find_one(doc! { "workbookId": workbook_id, "ownerUserId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("evaluate.sheet_lookup")))?
        .and_then(|d| d.get_object_id("_id").ok())
        .ok_or_else(|| ApiError::NotFound("sheet".to_owned()))?;

    match formula::parse(src) {
        Ok(ast) => {
            let ctx = build_ctx(&mongo, workbook_id, user_id, first_sheet).await?;
            let v = formula::eval(&ast, &ctx);
            Ok(Json(EvaluateFormulaResponse {
                display: v.to_display_string(),
                kind: match v {
                    Value::Number(_) => "number",
                    Value::Text(_) => "text",
                    Value::Bool(_) => "bool",
                    Value::Empty => "empty",
                    Value::Error(_) => "error",
                }
                .to_owned(),
                error: if let Value::Error(e) = v {
                    Some(e)
                } else {
                    None
                },
            }))
        }
        Err(e) => Ok(Json(EvaluateFormulaResponse {
            display: format!("#PARSE! {e}"),
            kind: "error".into(),
            error: Some(e),
        })),
    }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn recompute(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RecomputeInput>,
) -> Result<Json<RecomputeResponse>> {
    let user_id = user_oid(&user)?;
    let workbook_id = oid_from_str(&input.workbook_id)?;
    // Naive full recompute: iterate all cells with a formula, re-eval, write
    // back. A real implementation should use a topological sort over the
    // `dependsOn` graph — left as TODO.
    let cells = mongo.collection::<SabsheetCell>(COLL);
    let formula_cursor = cells
        .find(doc! {
            "workbookId": workbook_id,
            "ownerUserId": user_id,
            "formula": { "$type": "string" },
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("recompute.find")))?;
    let formula_rows: Vec<SabsheetCell> = formula_cursor.try_collect().await.unwrap_or_default();
    let mut updated: u32 = 0;
    for c in formula_rows {
        let Some(src) = c.formula.clone() else {
            continue;
        };
        let ctx = build_ctx(&mongo, workbook_id, user_id, c.sheet_id).await?;
        let Ok(ast) = formula::parse(&src) else {
            continue;
        };
        let v = formula::eval(&ast, &ctx);
        let new_val = eval_to_cell_value(&v);
        let raw_coll = mongo.collection::<Document>(COLL);
        let _ = raw_coll
            .update_one(
                doc! { "_id": c.id },
                doc! { "$set": {
                    "value": bson::to_bson(&new_val).unwrap_or(bson::Bson::Null),
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                } },
            )
            .await;
        updated += 1;
    }
    Ok(Json(RecomputeResponse {
        recomputed: updated,
    }))
}
