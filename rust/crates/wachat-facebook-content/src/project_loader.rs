//! Inline project resolver for the Facebook content router.
//!
//! The shared `wachat-types::Project` model omits `facebookPageId` (it's a
//! Facebook-only concern), so handlers need a lightweight loader that
//! pulls just the fields this crate cares about — namely `userId`,
//! `accessToken`, and `facebookPageId` — from the `projects` Mongo
//! collection. Keeping this local also avoids a circular dep on
//! `facebook-flow` or `wachat-config`.
//!
//! Mirrors the access pattern in `getProjectById` from the legacy TS:
//! the row must exist *and* the requesting user must be the owner.

use bson::{Document, doc};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};

const PROJECTS_COLL: &str = "projects";

/// Minimal project shape the content handlers rely on.
#[derive(Debug, Clone)]
pub struct FacebookProject {
    /// Page-scoped Meta access token. Required for every Graph call.
    pub access_token: String,
    /// Facebook Page id (numeric, opaque string in practice).
    pub facebook_page_id: String,
}

/// Resolve `(accessToken, facebookPageId)` for the given project, applying
/// the same owner check the TS server actions do.
///
/// Returns:
/// * `BadRequest` for an invalid project id hex string.
/// * `NotFound` if no row matches.
/// * `Forbidden` if the requesting user doesn't own the row.
/// * `BadRequest` if the row is found but missing either Facebook field
///   (matches the TS "Project not found or is missing Facebook Page ID
///   or access token" error path).
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<FacebookProject> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let owner_id_hex = doc
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?
        .to_hex();
    if owner_id_hex != user.tenant_id {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }

    let access_token = doc.get_str("accessToken").map(str::to_owned).map_err(|_| {
        ApiError::BadRequest(
            "Project not found or is missing Facebook Page ID or access token.".to_owned(),
        )
    })?;
    let facebook_page_id = doc
        .get_str("facebookPageId")
        .map(str::to_owned)
        .map_err(|_| {
            ApiError::BadRequest(
                "Project not found or is missing Facebook Page ID or access token.".to_owned(),
            )
        })?;

    Ok(FacebookProject {
        access_token,
        facebook_page_id,
    })
}

/// Same as [`load_project_for`] but only returns the access token. A few
/// endpoints (delete-post, publish-scheduled-post, …) take a Facebook
/// object id directly and don't need the page id.
pub async fn load_token_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<String> {
    Ok(load_project_for(user, mongo, project_id_hex)
        .await?
        .access_token)
}
