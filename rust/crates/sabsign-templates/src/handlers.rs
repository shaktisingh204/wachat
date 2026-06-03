use crate::mock_db::MockDb;
use crate::models::*;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct PaginationParams {
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub query: Option<String>,
    pub tag: Option<String>,
}

// 1. Create Template
pub async fn create_template(
    State(db): State<MockDb>,
    Json(payload): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let now = Utc::now();
    let user_id = Uuid::new_v4(); // Mock user

    let template = Template {
        id,
        name: payload.name,
        description: payload.description,
        created_by: user_id,
        created_at: now,
        updated_at: now,
        is_active: true,
        tags: payload.tags,
        version: 1,
        roles: payload.roles,
        merge_fields: payload.merge_fields,
        settings: payload.settings,
    };

    let version = TemplateVersion {
        version_id: Uuid::new_v4(),
        template_id: id,
        version_number: 1,
        created_at: now,
        created_by: user_id,
        snapshot: template.clone(),
        change_log: "Initial creation".to_string(),
    };

    db.templates.write().await.insert(id, template.clone());
    db.template_versions.write().await.insert(id, vec![version]);

    (StatusCode::CREATED, Json(template))
}

// 2. Get Template
pub async fn get_template(State(db): State<MockDb>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let templates = db.templates.read().await;
    match templates.get(&id) {
        Some(t) => (StatusCode::OK, Json(t.clone())).into_response(),
        None => (StatusCode::NOT_FOUND, "Template not found").into_response(),
    }
}

// 3. Update Template (creates new version)
pub async fn update_template(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTemplateRequest>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(template) = templates.get_mut(&id) {
        let old_version = template.version;
        template.version += 1;
        template.updated_at = Utc::now();

        if let Some(n) = payload.name {
            template.name = n;
        }
        if let Some(d) = payload.description {
            template.description = Some(d);
        }
        if let Some(a) = payload.is_active {
            template.is_active = a;
        }
        if let Some(r) = payload.roles {
            template.roles = r;
        }
        if let Some(m) = payload.merge_fields {
            template.merge_fields = m;
        }
        if let Some(s) = payload.settings {
            template.settings = s;
        }
        if let Some(t) = payload.tags {
            template.tags = t;
        }

        let version_snap = TemplateVersion {
            version_id: Uuid::new_v4(),
            template_id: id,
            version_number: template.version,
            created_at: Utc::now(),
            created_by: template.created_by,
            snapshot: template.clone(),
            change_log: payload
                .change_log
                .unwrap_or_else(|| format!("Updated from version {}", old_version)),
        };

        let mut versions = db.template_versions.write().await;
        versions.entry(id).or_default().push(version_snap);

        (StatusCode::OK, Json(template.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 4. Delete Template
pub async fn delete_template(State(db): State<MockDb>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if templates.remove(&id).is_some() {
        let mut versions = db.template_versions.write().await;
        versions.remove(&id);
        (StatusCode::NO_CONTENT, "").into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 5. List Templates (Paginated)
pub async fn list_templates(
    State(db): State<MockDb>,
    Query(params): Query<PaginationParams>,
) -> impl IntoResponse {
    let templates = db.templates.read().await;
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(10).max(1);

    let all: Vec<_> = templates.values().cloned().collect();
    let total = all.len();
    let skip = (page - 1) * limit;

    let data = all.into_iter().skip(skip).take(limit).collect();

    Json(PaginatedResponse {
        data,
        total,
        page,
        limit,
    })
}

// 6. Clone Template
pub async fn clone_template(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CloneTemplateRequest>,
) -> impl IntoResponse {
    let templates_read = db.templates.read().await;
    if let Some(source) = templates_read.get(&id) {
        let new_id = Uuid::new_v4();
        let now = Utc::now();
        let mut cloned = source.clone();

        cloned.id = new_id;
        cloned.name = payload.new_name;
        cloned.created_at = now;
        cloned.updated_at = now;
        cloned.version = 1;

        drop(templates_read);

        let version = TemplateVersion {
            version_id: Uuid::new_v4(),
            template_id: new_id,
            version_number: 1,
            created_at: now,
            created_by: cloned.created_by,
            snapshot: cloned.clone(),
            change_log: format!("Cloned from {}", id),
        };

        db.templates.write().await.insert(new_id, cloned.clone());
        db.template_versions
            .write()
            .await
            .insert(new_id, vec![version]);

        (StatusCode::CREATED, Json(cloned)).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Source template not found").into_response()
    }
}

// 7. Archive Template
pub async fn archive_template(State(db): State<MockDb>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.is_active = false;
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 8. Unarchive Template
pub async fn unarchive_template(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.is_active = true;
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 9. Add Role
pub async fn add_role(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(role): Json<RoleTemplate>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.roles.push(role);
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 10. Remove Role
pub async fn remove_role(
    State(db): State<MockDb>,
    Path((id, role_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.roles.retain(|r| r.role_id != role_id);
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 11. Add Merge Field
pub async fn add_merge_field(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(field): Json<MergeField>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.merge_fields.push(field);
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 12. Remove Merge Field
pub async fn remove_merge_field(
    State(db): State<MockDb>,
    Path((id, field_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let mut templates = db.templates.write().await;
    if let Some(t) = templates.get_mut(&id) {
        t.merge_fields.retain(|f| f.field_id != field_id);
        t.updated_at = Utc::now();
        (StatusCode::OK, Json(t.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 13. Apply Template to Envelope
pub async fn apply_to_envelope(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApplyTemplateRequest>,
) -> impl IntoResponse {
    let templates = db.templates.read().await;
    let _template = match templates.get(&id) {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, "Template not found").into_response(),
    };
    drop(templates);

    let mut envelopes = db.envelopes.write().await;
    let envelope = envelopes
        .entry(payload.envelope_id)
        .or_insert_with(|| Envelope {
            envelope_id: payload.envelope_id,
            template_id: Some(id),
            status: "draft".to_string(),
            created_at: Utc::now(),
            custom_fields: HashMap::new(),
        });

    // Mock applying roles and fields...
    envelope.template_id = Some(id);

    (StatusCode::OK, Json(envelope.clone())).into_response()
}

// 14. List Versions
pub async fn list_versions(State(db): State<MockDb>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let versions = db.template_versions.read().await;
    if let Some(v) = versions.get(&id) {
        (StatusCode::OK, Json(v.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Template not found").into_response()
    }
}

// 15. Get Specific Version
pub async fn get_version(
    State(db): State<MockDb>,
    Path((id, version_num)): Path<(Uuid, u32)>,
) -> impl IntoResponse {
    let versions = db.template_versions.read().await;
    if let Some(v_list) = versions.get(&id) {
        if let Some(v) = v_list.iter().find(|x| x.version_number == version_num) {
            return (StatusCode::OK, Json(v.clone())).into_response();
        }
    }
    (StatusCode::NOT_FOUND, "Version not found").into_response()
}

// 16. Rollback to Version
pub async fn rollback_version(
    State(db): State<MockDb>,
    Path((id, version_num)): Path<(Uuid, u32)>,
) -> impl IntoResponse {
    let versions_read = db.template_versions.read().await;
    let snapshot = if let Some(v_list) = versions_read.get(&id) {
        if let Some(v) = v_list.iter().find(|x| x.version_number == version_num) {
            Some(v.snapshot.clone())
        } else {
            None
        }
    } else {
        None
    };
    drop(versions_read);

    if let Some(mut snap) = snapshot {
        let mut templates = db.templates.write().await;
        if let Some(t) = templates.get_mut(&id) {
            let new_version_num = t.version + 1;
            snap.version = new_version_num;
            snap.updated_at = Utc::now();
            *t = snap.clone();

            let version_record = TemplateVersion {
                version_id: Uuid::new_v4(),
                template_id: id,
                version_number: new_version_num,
                created_at: Utc::now(),
                created_by: t.created_by,
                snapshot: t.clone(),
                change_log: format!("Rolled back to version {}", version_num),
            };

            let mut versions = db.template_versions.write().await;
            versions.entry(id).or_default().push(version_record);

            return (StatusCode::OK, Json(t.clone())).into_response();
        }
    }
    (StatusCode::NOT_FOUND, "Template or version not found").into_response()
}

// 17. Bulk Create
pub async fn bulk_create(
    State(db): State<MockDb>,
    Json(payload): Json<BulkCreateRequest>,
) -> impl IntoResponse {
    let mut success_count = 0;

    for req in payload.templates {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let t = Template {
            id,
            name: req.name,
            description: req.description,
            created_by: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            is_active: true,
            tags: req.tags,
            version: 1,
            roles: req.roles,
            merge_fields: req.merge_fields,
            settings: req.settings,
        };
        db.templates.write().await.insert(id, t);
        success_count += 1;
    }

    Json(BulkActionResponse {
        success_count,
        failed_count: 0,
        errors: vec![],
    })
}

// 18. Bulk Delete
#[derive(Deserialize)]
pub struct BulkDeleteRequest {
    pub ids: Vec<Uuid>,
}

pub async fn bulk_delete(
    State(db): State<MockDb>,
    Json(payload): Json<BulkDeleteRequest>,
) -> impl IntoResponse {
    let mut success_count = 0;
    let mut failed_count = 0;
    let mut templates = db.templates.write().await;
    let mut versions = db.template_versions.write().await;

    for id in payload.ids {
        if templates.remove(&id).is_some() {
            versions.remove(&id);
            success_count += 1;
        } else {
            failed_count += 1;
        }
    }

    Json(BulkActionResponse {
        success_count,
        failed_count,
        errors: vec![],
    })
}

// 19. Search Templates
pub async fn search_templates(
    State(db): State<MockDb>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    let templates = db.templates.read().await;
    let mut results: Vec<Template> = templates.values().cloned().collect();

    if let Some(q) = params.query {
        let q_lower = q.to_lowercase();
        results.retain(|t| {
            t.name.to_lowercase().contains(&q_lower)
                || t.description
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&q_lower)
        });
    }

    if let Some(tag) = params.tag {
        let tag_lower = tag.to_lowercase();
        results.retain(|t| t.tags.iter().any(|tg| tg.to_lowercase() == tag_lower));
    }

    Json(results)
}

// 20. Analytics
#[derive(Serialize)]
pub struct TemplateAnalytics {
    pub total_templates: usize,
    pub active_templates: usize,
    pub total_versions: usize,
}

pub async fn get_analytics(State(db): State<MockDb>) -> impl IntoResponse {
    let templates = db.templates.read().await;
    let versions = db.template_versions.read().await;

    let total = templates.len();
    let active = templates.values().filter(|t| t.is_active).count();
    let total_v: usize = versions.values().map(|v| v.len()).sum();

    Json(TemplateAnalytics {
        total_templates: total,
        active_templates: active,
        total_versions: total_v,
    })
}
