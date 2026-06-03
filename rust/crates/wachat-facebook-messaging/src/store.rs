//! Mongo plumbing: project lookup with tenant guard.
//!
//! `load_project_for` is intentionally inlined here (per the slice's
//! constraints) rather than re-using `wachat-features::tenancy` so this
//! crate stays self-contained. Behaviour matches the existing helpers
//! in sibling crates: 400 for an invalid hex id, 404 if the project does
//! not exist, 403 if the caller is not its owner.
//!
//! Unlike `wachat_types::Project`, which omits the Facebook-specific
//! fields, we read the project as a raw BSON `Document` so handlers can
//! pluck `accessToken` and `facebookPageId` regardless of how the schema
//! evolves.

use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

const PROJECTS_COLL: &str = "projects";

/// A loaded project document with the Messenger-relevant fields already
/// extracted. Holding the original BSON `Document` lets later handlers
/// expose it back to callers verbatim (e.g. `getFacebookChatInitialData`
/// returns the project alongside the conversations).
pub struct FacebookProject {
    pub raw: Document,
    pub access_token: Option<String>,
    pub facebook_page_id: Option<String>,
}

/// Load a project by hex id, enforcing tenant ownership.
///
/// 400 → invalid hex; 404 → not found; 403 → caller is not the owner.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<FacebookProject> {
    let oid = ObjectId::parse_str(project_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid Project ID.".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    let owner_hex = doc
        .get_object_id("userId")
        .map(|o| o.to_hex())
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?;
    if user.tenant_id != owner_hex {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }

    let access_token = doc.get_str("accessToken").ok().map(|s| s.to_owned());
    let facebook_page_id = doc.get_str("facebookPageId").ok().map(|s| s.to_owned());

    Ok(FacebookProject {
        raw: doc,
        access_token,
        facebook_page_id,
    })
}
