use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;

use crate::mock_db::AppState;
use crate::models::*;

// --- Workspace Settings Handlers ---

pub async fn list_workspaces(
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceSettings>>, StatusCode> {
    let db = state.db.workspaces.read().await;
    let workspaces: Vec<WorkspaceSettings> = db.values().cloned().collect();
    Ok(Json(workspaces))
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<WorkspaceSettings>, StatusCode> {
    let db = state.db.workspaces.read().await;
    match db.get(&id) {
        Some(ws) => Ok(Json(ws.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspaceSettingsReq>,
) -> Result<(StatusCode, Json<WorkspaceSettings>), StatusCode> {
    let mut db = state.db.workspaces.write().await;
    
    let new_ws = WorkspaceSettings {
        id: Uuid::new_v4().to_string(),
        name: payload.name,
        timezone: payload.timezone,
        business_hours: BusinessHours {
            enabled: false,
            schedule: HashMap::new(),
        },
        default_language: payload.default_language,
        allowed_domains: vec![],
    };

    db.insert(new_ws.id.clone(), new_ws.clone());
    Ok((StatusCode::CREATED, Json(new_ws)))
}

pub async fn update_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWorkspaceSettingsReq>,
) -> Result<Json<WorkspaceSettings>, StatusCode> {
    let mut db = state.db.workspaces.write().await;
    
    if let Some(ws) = db.get_mut(&id) {
        if let Some(name) = payload.name {
            ws.name = name;
        }
        if let Some(tz) = payload.timezone {
            ws.timezone = tz;
        }
        if let Some(lang) = payload.default_language {
            ws.default_language = lang;
        }
        Ok(Json(ws.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.workspaces.write().await;
    if db.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Custom Form Schema Handlers ---

pub async fn list_custom_forms(
    State(state): State<AppState>,
) -> Result<Json<Vec<CustomFormSchema>>, StatusCode> {
    let db = state.db.custom_forms.read().await;
    let forms: Vec<CustomFormSchema> = db.values().cloned().collect();
    Ok(Json(forms))
}

pub async fn get_custom_form(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<CustomFormSchema>, StatusCode> {
    let db = state.db.custom_forms.read().await;
    match db.get(&id) {
        Some(form) => Ok(Json(form.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_custom_form(
    State(state): State<AppState>,
    Json(payload): Json<CreateCustomFormSchemaReq>,
) -> Result<(StatusCode, Json<CustomFormSchema>), StatusCode> {
    let mut db = state.db.custom_forms.write().await;
    
    let new_form = CustomFormSchema {
        id: Uuid::new_v4().to_string(),
        form_name: payload.form_name,
        target_entity: payload.target_entity,
        fields: payload.fields,
        created_at: Utc::now().to_rfc3339(),
    };

    db.insert(new_form.id.clone(), new_form.clone());
    Ok((StatusCode::CREATED, Json(new_form)))
}

pub async fn update_custom_form(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<CreateCustomFormSchemaReq>, // reusing req for simplicity
) -> Result<Json<CustomFormSchema>, StatusCode> {
    let mut db = state.db.custom_forms.write().await;
    
    if let Some(form) = db.get_mut(&id) {
        form.form_name = payload.form_name;
        form.target_entity = payload.target_entity;
        form.fields = payload.fields;
        Ok(Json(form.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_custom_form(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.custom_forms.write().await;
    if db.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Channel Configuration Handlers ---

pub async fn list_channels(
    State(state): State<AppState>,
) -> Result<Json<Vec<ChannelConfiguration>>, StatusCode> {
    let db = state.db.channels.read().await;
    let channels: Vec<ChannelConfiguration> = db.values().cloned().collect();
    Ok(Json(channels))
}

pub async fn get_channel(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ChannelConfiguration>, StatusCode> {
    let db = state.db.channels.read().await;
    match db.get(&id) {
        Some(channel) => Ok(Json(channel.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_channel(
    State(state): State<AppState>,
    Json(payload): Json<CreateChannelConfigurationReq>,
) -> Result<(StatusCode, Json<ChannelConfiguration>), StatusCode> {
    let mut db = state.db.channels.write().await;
    
    let new_channel = ChannelConfiguration {
        id: Uuid::new_v4().to_string(),
        channel_type: payload.channel_type,
        is_active: payload.is_active,
        config: payload.config,
    };

    db.insert(new_channel.id.clone(), new_channel.clone());
    Ok((StatusCode::CREATED, Json(new_channel)))
}

pub async fn update_channel(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<CreateChannelConfigurationReq>,
) -> Result<Json<ChannelConfiguration>, StatusCode> {
    let mut db = state.db.channels.write().await;
    
    if let Some(channel) = db.get_mut(&id) {
        channel.channel_type = payload.channel_type;
        channel.is_active = payload.is_active;
        channel.config = payload.config;
        Ok(Json(channel.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_channel(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.channels.write().await;
    if db.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Team Handlers ---

pub async fn list_teams(
    State(state): State<AppState>,
) -> Result<Json<Vec<Team>>, StatusCode> {
    let db = state.db.teams.read().await;
    let teams: Vec<Team> = db.values().cloned().collect();
    Ok(Json(teams))
}

pub async fn get_team(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Team>, StatusCode> {
    let db = state.db.teams.read().await;
    match db.get(&id) {
        Some(team) => Ok(Json(team.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_team(
    State(state): State<AppState>,
    Json(payload): Json<CreateTeamReq>,
) -> Result<(StatusCode, Json<Team>), StatusCode> {
    let mut db = state.db.teams.write().await;
    
    let new_team = Team {
        id: Uuid::new_v4().to_string(),
        name: payload.name,
        description: payload.description,
        members: vec![],
        lead_id: None,
        skills: payload.skills,
    };

    db.insert(new_team.id.clone(), new_team.clone());
    Ok((StatusCode::CREATED, Json(new_team)))
}

pub async fn update_team(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<CreateTeamReq>,
) -> Result<Json<Team>, StatusCode> {
    let mut db = state.db.teams.write().await;
    
    if let Some(team) = db.get_mut(&id) {
        team.name = payload.name;
        team.description = payload.description;
        team.skills = payload.skills;
        Ok(Json(team.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_team(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.teams.write().await;
    if db.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn add_team_member(
    State(state): State<AppState>,
    Path(team_id): Path<String>,
    Json(payload): Json<AddTeamMemberReq>,
) -> Result<Json<Team>, StatusCode> {
    let mut db = state.db.teams.write().await;
    if let Some(team) = db.get_mut(&team_id) {
        if !team.members.contains(&payload.user_id) {
            team.members.push(payload.user_id);
        }
        Ok(Json(team.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn remove_team_member(
    State(state): State<AppState>,
    Path((team_id, user_id)): Path<(String, String)>,
) -> Result<Json<Team>, StatusCode> {
    let mut db = state.db.teams.write().await;
    if let Some(team) = db.get_mut(&team_id) {
        team.members.retain(|u| u != &user_id);
        Ok(Json(team.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Role Permission Handlers ---

pub async fn list_roles(
    State(state): State<AppState>,
) -> Result<Json<Vec<RolePermission>>, StatusCode> {
    let db = state.db.roles.read().await;
    let roles: Vec<RolePermission> = db.values().cloned().collect();
    Ok(Json(roles))
}

pub async fn get_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<RolePermission>, StatusCode> {
    let db = state.db.roles.read().await;
    match db.get(&id) {
        Some(role) => Ok(Json(role.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_role(
    State(state): State<AppState>,
    Json(payload): Json<CreateRolePermissionReq>,
) -> Result<(StatusCode, Json<RolePermission>), StatusCode> {
    let mut db = state.db.roles.write().await;
    
    let new_role = RolePermission {
        id: Uuid::new_v4().to_string(),
        role_name: payload.role_name,
        permissions: payload.permissions,
        is_system_role: false,
    };

    db.insert(new_role.id.clone(), new_role.clone());
    Ok((StatusCode::CREATED, Json(new_role)))
}

pub async fn update_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<CreateRolePermissionReq>,
) -> Result<Json<RolePermission>, StatusCode> {
    let mut db = state.db.roles.write().await;
    
    if let Some(role) = db.get_mut(&id) {
        if role.is_system_role {
            return Err(StatusCode::FORBIDDEN); // Cannot modify system roles
        }
        role.role_name = payload.role_name;
        role.permissions = payload.permissions;
        Ok(Json(role.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.roles.write().await;
    if let Some(role) = db.get(&id) {
        if role.is_system_role {
            return Err(StatusCode::FORBIDDEN);
        }
    } else {
        return Err(StatusCode::NOT_FOUND);
    }
    
    db.remove(&id);
    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_permissions_to_role(
    State(state): State<AppState>,
    Path(role_id): Path<String>,
    Json(new_permissions): Json<Vec<String>>,
) -> Result<Json<RolePermission>, StatusCode> {
    let mut db = state.db.roles.write().await;
    if let Some(role) = db.get_mut(&role_id) {
        if role.is_system_role {
            return Err(StatusCode::FORBIDDEN);
        }
        for p in new_permissions {
            if !role.permissions.contains(&p) {
                role.permissions.push(p);
            }
        }
        Ok(Json(role.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
