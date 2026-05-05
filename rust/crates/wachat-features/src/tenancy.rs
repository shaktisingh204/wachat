//! Per-project tenancy guard shared by every per-project handler.
//!
//! Mirrors `load_project_for` in `wachat-send-router::handlers` exactly so
//! the contract is identical: 404 if the project doesn't exist, 403 if
//! the caller is not its owner.

use bson::doc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;
use wachat_types::Project;

const PROJECTS_COLL: &str = "projects";

#[instrument(skip_all, fields(project_id = %project_id_hex))]
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}
