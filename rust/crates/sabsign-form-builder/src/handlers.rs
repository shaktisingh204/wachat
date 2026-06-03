use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::mock_db::AppState;
use crate::models::*;

// 1. Create a Form
pub async fn create_form(
    State(state): State<AppState>,
    Json(mut payload): Json<FormTemplate>,
) -> Result<Json<FormTemplate>, StatusCode> {
    payload.id = Uuid::new_v4();
    let now = Utc::now();
    payload.created_at = now;
    payload.updated_at = now;

    state
        .forms
        .write()
        .await
        .insert(payload.id, payload.clone());
    Ok(Json(payload))
}

// 2. Get Form
pub async fn get_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplate>, StatusCode> {
    if let Some(form) = state.forms.read().await.get(&id) {
        Ok(Json(form.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 3. List Forms
pub async fn list_forms(
    State(state): State<AppState>,
) -> Result<Json<Vec<FormTemplate>>, StatusCode> {
    let forms = state.forms.read().await.values().cloned().collect();
    Ok(Json(forms))
}

// 4. Update Form
pub async fn update_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(mut payload): Json<FormTemplate>,
) -> Result<Json<FormTemplate>, StatusCode> {
    let mut forms = state.forms.write().await;
    if let Some(form) = forms.get_mut(&id) {
        payload.id = id;
        payload.created_at = form.created_at;
        payload.updated_at = Utc::now();
        *form = payload.clone();
        Ok(Json(payload))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Delete Form
pub async fn delete_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if state.forms.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 6. Create Field
pub async fn create_field(
    State(state): State<AppState>,
    Json(mut payload): Json<CanvasField>,
) -> Result<Json<CanvasField>, StatusCode> {
    payload.id = Uuid::new_v4();
    let now = Utc::now();
    payload.created_at = now;
    payload.updated_at = now;

    // Auto-calculate relative if missing (simple logic)
    if payload.relative_x == 0.0 && payload.relative_y == 0.0 {
        payload.relative_x = payload.coordinate.x / payload.page_mapping.width;
        payload.relative_y = payload.coordinate.y / payload.page_mapping.height;
    }

    state
        .fields
        .write()
        .await
        .insert(payload.id, payload.clone());
    Ok(Json(payload))
}

// 7. Get Field
pub async fn get_field(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CanvasField>, StatusCode> {
    if let Some(field) = state.fields.read().await.get(&id) {
        Ok(Json(field.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 8. Update Field
pub async fn update_field(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(mut payload): Json<CanvasField>,
) -> Result<Json<CanvasField>, StatusCode> {
    let mut fields = state.fields.write().await;
    if let Some(field) = fields.get_mut(&id) {
        payload.id = id;
        payload.created_at = field.created_at;
        payload.updated_at = Utc::now();
        *field = payload.clone();
        Ok(Json(payload))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 9. Delete Field
pub async fn delete_field(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if state.fields.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 10. List Form Fields
pub async fn list_form_fields(
    State(state): State<AppState>,
    Path(form_id): Path<Uuid>,
) -> Result<Json<Vec<CanvasField>>, StatusCode> {
    let fields: Vec<CanvasField> = state
        .fields
        .read()
        .await
        .values()
        .filter(|f| f.form_id == form_id)
        .cloned()
        .collect();
    Ok(Json(fields))
}

// 11. Save Draft Tags (Bulk Update/Create Fields)
pub async fn save_draft_tags(
    State(state): State<AppState>,
    Path(form_id): Path<Uuid>,
    Json(tags): Json<Vec<CanvasField>>,
) -> Result<Json<Vec<CanvasField>>, StatusCode> {
    let mut fields = state.fields.write().await;
    let mut saved_tags = Vec::new();

    // In a real DB this would be a transaction
    for mut tag in tags {
        tag.form_id = form_id;
        if tag.id.is_nil() {
            tag.id = Uuid::new_v4();
            tag.created_at = Utc::now();
        }
        tag.updated_at = Utc::now();

        // Auto-calc
        tag.relative_x = tag.coordinate.x / tag.page_mapping.width;
        tag.relative_y = tag.coordinate.y / tag.page_mapping.height;

        fields.insert(tag.id, tag.clone());
        saved_tags.push(tag);
    }

    // Mark form as draft
    if let Some(form) = state.forms.write().await.get_mut(&form_id) {
        form.is_draft = true;
        form.updated_at = Utc::now();
    }

    Ok(Json(saved_tags))
}

// 12. Calculate Relative XY Position
pub async fn calculate_relative_xy(
    Json(req): Json<CalculateRelativePositionRequest>,
) -> Result<Json<CalculateRelativePositionResponse>, StatusCode> {
    if req.page_width == 0.0 || req.page_height == 0.0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let relative_x = req.coordinate.x / req.page_width;
    let relative_y = req.coordinate.y / req.page_height;

    Ok(Json(CalculateRelativePositionResponse {
        relative_x,
        relative_y,
    }))
}

// 13. Bulk Delete Fields
pub async fn bulk_delete_fields(
    State(state): State<AppState>,
    Json(ids): Json<Vec<Uuid>>,
) -> Result<Json<BulkActionResponse>, StatusCode> {
    let mut fields = state.fields.write().await;
    let mut processed = 0;

    for id in ids {
        if fields.remove(&id).is_some() {
            processed += 1;
        }
    }

    Ok(Json(BulkActionResponse {
        success: true,
        processed,
        failed: 0,
    }))
}

// 14. Bulk Update Fields
pub async fn bulk_update_fields(
    State(state): State<AppState>,
    Json(updates): Json<Vec<CanvasField>>,
) -> Result<Json<BulkActionResponse>, StatusCode> {
    let mut fields = state.fields.write().await;
    let mut processed = 0;
    let mut failed = 0;

    for update in updates {
        if let Some(field) = fields.get_mut(&update.id) {
            *field = update;
            field.updated_at = Utc::now();
            processed += 1;
        } else {
            failed += 1;
        }
    }

    Ok(Json(BulkActionResponse {
        success: true,
        processed,
        failed,
    }))
}

// 15. Copy Field
pub async fn copy_field(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CanvasField>, StatusCode> {
    let fields = state.fields.read().await;
    if let Some(field) = fields.get(&id) {
        let mut new_field = field.clone();
        new_field.id = Uuid::new_v4();
        new_field.coordinate.x += 10.0; // slight offset
        new_field.coordinate.y += 10.0;
        new_field.created_at = Utc::now();
        new_field.updated_at = Utc::now();

        drop(fields); // release read lock
        state
            .fields
            .write()
            .await
            .insert(new_field.id, new_field.clone());
        Ok(Json(new_field))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 16. Duplicate Form
pub async fn duplicate_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplate>, StatusCode> {
    let mut forms = state.forms.write().await;
    if let Some(form) = forms.get(&id) {
        let mut new_form = form.clone();
        new_form.id = Uuid::new_v4();
        new_form.name = format!("{} (Copy)", form.name);
        new_form.created_at = Utc::now();
        new_form.updated_at = Utc::now();
        new_form.is_draft = true;

        let new_form_id = new_form.id;
        forms.insert(new_form.id, new_form.clone());
        drop(forms);

        // Clone fields
        let mut fields = state.fields.write().await;
        let form_fields: Vec<CanvasField> = fields
            .values()
            .filter(|f| f.form_id == id)
            .cloned()
            .collect();
        for mut field in form_fields {
            field.id = Uuid::new_v4();
            field.form_id = new_form_id;
            field.created_at = Utc::now();
            field.updated_at = Utc::now();
            fields.insert(field.id, field);
        }

        Ok(Json(new_form))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 17. Publish Form
pub async fn publish_form(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplate>, StatusCode> {
    let mut forms = state.forms.write().await;
    if let Some(form) = forms.get_mut(&id) {
        form.is_draft = false;
        form.updated_at = Utc::now();
        Ok(Json(form.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 18. Get Form Analytics
pub async fn get_form_analytics(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormAnalytics>, StatusCode> {
    if let Some(analytics) = state.analytics.read().await.get(&id) {
        Ok(Json(analytics.clone()))
    } else {
        // Return dummy analytics if not found
        Ok(Json(FormAnalytics {
            form_id: id,
            total_views: 0,
            total_completions: 0,
            average_completion_time_ms: 0,
            field_metrics: vec![],
        }))
    }
}

// 19. Clear Form Fields
pub async fn clear_form_fields(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut fields = state.fields.write().await;
    fields.retain(|_, v| v.form_id != id);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct AlignRequest {
    pub field_ids: Vec<Uuid>,
}

// 20. Align Fields Horizontally
pub async fn align_fields_horizontally(
    State(state): State<AppState>,
    Json(req): Json<AlignRequest>,
) -> Result<Json<Vec<CanvasField>>, StatusCode> {
    if req.field_ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut fields = state.fields.write().await;

    // Find the average Y coordinate
    let mut sum_y = 0.0;
    let mut count = 0;
    for id in &req.field_ids {
        if let Some(f) = fields.get(id) {
            sum_y += f.coordinate.y;
            count += 1;
        }
    }

    if count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    let avg_y = sum_y / (count as f64);
    let mut updated = Vec::new();

    for id in &req.field_ids {
        if let Some(f) = fields.get_mut(id) {
            f.coordinate.y = avg_y;
            f.relative_y = avg_y / f.page_mapping.height;
            f.updated_at = Utc::now();
            updated.push(f.clone());
        }
    }

    Ok(Json(updated))
}

// 21. Align Fields Vertically
pub async fn align_fields_vertically(
    State(state): State<AppState>,
    Json(req): Json<AlignRequest>,
) -> Result<Json<Vec<CanvasField>>, StatusCode> {
    if req.field_ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut fields = state.fields.write().await;

    // Find the average X coordinate
    let mut sum_x = 0.0;
    let mut count = 0;
    for id in &req.field_ids {
        if let Some(f) = fields.get(id) {
            sum_x += f.coordinate.x;
            count += 1;
        }
    }

    if count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    let avg_x = sum_x / (count as f64);
    let mut updated = Vec::new();

    for id in &req.field_ids {
        if let Some(f) = fields.get_mut(id) {
            f.coordinate.x = avg_x;
            f.relative_x = avg_x / f.page_mapping.width;
            f.updated_at = Utc::now();
            updated.push(f.clone());
        }
    }

    Ok(Json(updated))
}
