//! Axum handlers for the wachat-facebook-crm router.
//!
//! Each handler ports one of the 12 Subscribers/CRM/Labels server actions
//! from `src/app/actions/facebook.actions.ts`.
//!
//! Errors thrown by the legacy TS are translated into envelope shape
//! (`{ success: false, error: ... }` or `{ error: ... }`) — the TS callers
//! already pattern-match on those shapes.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;

use crate::dto::{
    CreateLabelBody, CreateLabelResult, KanbanResult, LabelsResult, ProfileIdBody,
    SaveKanbanStatusesBody, SubscribersResult, SuccessResult, UpdateStatusBody, UserPsidBody,
};
use crate::state::WachatFacebookCrmState;
use crate::store;

// ---------------------------------------------------------------------
// Subscribers + Kanban
// ---------------------------------------------------------------------

pub async fn list_subscribers(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
) -> Result<Json<SubscribersResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SubscribersResult {
                subscribers: None,
                error: Some("Project not found or is not configured for Facebook.".to_owned()),
            }));
        }
    };
    match store::list_subscribers(&s.mongo, &project).await {
        Ok(v) => Ok(Json(SubscribersResult {
            subscribers: Some(v),
            error: None,
        })),
        Err(sabnode_common::ApiError::BadRequest(m)) => Ok(Json(SubscribersResult {
            subscribers: None,
            error: Some(m),
        })),
        Err(e) => Ok(Json(SubscribersResult {
            subscribers: None,
            error: Some(e.to_string()),
        })),
    }
}

pub async fn update_subscriber_status(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(subscriber_id): Path<String>,
    Json(body): Json<UpdateStatusBody>,
) -> Result<Json<SuccessResult>> {
    Ok(Json(
        store::update_subscriber_status(&s.mongo, &user.tenant_id, &subscriber_id, &body.status)
            .await?,
    ))
}

pub async fn get_kanban(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
) -> Result<Json<KanbanResult>> {
    // Match the TS `defaultData = { project: null, columns: [] }` on any
    // failure path so the kanban UI degrades gracefully instead of 4xx-ing.
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(KanbanResult::default()));
        }
    };
    match store::get_kanban_data(&s.mongo, &project).await {
        Ok(r) => Ok(Json(r)),
        Err(_) => Ok(Json(KanbanResult::default())),
    }
}

pub async fn save_kanban_statuses(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveKanbanStatusesBody>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::save_kanban_statuses(&s.mongo, &project, body.statuses).await?,
    ))
}

// ---------------------------------------------------------------------
// Custom labels — Meta Graph API
// ---------------------------------------------------------------------

pub async fn list_custom_labels(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
) -> Result<Json<LabelsResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(LabelsResult {
                labels: None,
                error: Some("Project not found or missing configuration.".to_owned()),
            }));
        }
    };
    match store::list_custom_labels(&s.meta, &project).await {
        Ok(v) => Ok(Json(LabelsResult {
            labels: Some(v),
            error: None,
        })),
        Err(e) => Ok(Json(LabelsResult {
            labels: None,
            error: Some(e.to_string()),
        })),
    }
}

pub async fn create_custom_label(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateLabelBody>,
) -> Result<Json<CreateLabelResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(CreateLabelResult {
                label_id: None,
                error: Some("Project not found or missing configuration.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::create_custom_label(&s.meta, &project, &body.name).await?,
    ))
}

pub async fn delete_custom_label(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path((project_id, label_id)): Path<(String, String)>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::delete_custom_label(&s.meta, &project, &label_id).await?,
    ))
}

pub async fn assign_label_to_user(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path((project_id, label_id)): Path<(String, String)>,
    Json(body): Json<UserPsidBody>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::assign_label_to_user(&s.meta, &project, &label_id, &body.psid).await?,
    ))
}

pub async fn remove_label_from_user(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path((project_id, label_id)): Path<(String, String)>,
    Json(body): Json<UserPsidBody>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::remove_label_from_user(&s.meta, &project, &label_id, &body.psid).await?,
    ))
}

pub async fn get_labels_for_user(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path((project_id, psid)): Path<(String, String)>,
) -> Result<Json<LabelsResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(LabelsResult {
                labels: None,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    match store::get_labels_for_user(&s.meta, &project, &psid).await {
        Ok(v) => Ok(Json(LabelsResult {
            labels: Some(v),
            error: None,
        })),
        Err(e) => Ok(Json(LabelsResult {
            labels: None,
            error: Some(e.to_string()),
        })),
    }
}

// ---------------------------------------------------------------------
// Profile block / unblock
// ---------------------------------------------------------------------

pub async fn block_profile(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
    Json(body): Json<ProfileIdBody>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::block_profile(&s.meta, &project, &body.profile_id).await?,
    ))
}

pub async fn unblock_profile(
    user: AuthUser,
    State(s): State<WachatFacebookCrmState>,
    Path(project_id): Path<String>,
    Json(body): Json<ProfileIdBody>,
) -> Result<Json<SuccessResult>> {
    let project = match store::load_project_for(&user.tenant_id, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(Json(SuccessResult {
                success: false,
                error: Some("Access denied.".to_owned()),
            }));
        }
    };
    Ok(Json(
        store::unblock_profile(&s.meta, &project, &body.profile_id).await?,
    ))
}
