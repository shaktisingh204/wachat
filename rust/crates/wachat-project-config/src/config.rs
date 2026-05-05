//! `ProjectConfig` — Mongo-backed read + manual upsert of a wachat
//! Project. See the crate-level docs for the TS counterparts.

use anyhow::Context;
use bson::{doc, oid::ObjectId};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use serde::Deserialize;

use sabnode_common::ApiError;
use sabnode_db::MongoHandle;
use wachat_types::{PhoneNumberSummary, Project};

use crate::dto::{ManualSetupReq, PublicProject};

/// Mongo collection name. Matches the TS:
///
/// ```text
/// db.collection<Project>('projects').findOne(...)
/// db.collection('projects').insertOne(newProject)
/// ```
const COLL: &str = "projects";

/// Read + manual upsert handle for the `projects` collection.
///
/// `MongoHandle` is `Clone`, so this struct is cheap to clone and safe
/// to store in Axum app state.
#[derive(Debug, Clone)]
pub struct ProjectConfig {
    mongo: MongoHandle,
}

impl ProjectConfig {
    /// Wrap a `MongoHandle`.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Fetch a project by id and return the **token-redacted** view.
    ///
    /// Mirrors `getPublicProjectById` (line 19), but additionally drops
    /// the access token at the projection boundary so the caller cannot
    /// accidentally serialize it back to the client.
    ///
    /// Returns `Ok(None)` when the document is not found — the caller
    /// is expected to map that to `404 NOT_FOUND` (the TS `getPublic…`
    /// also returns `null` here).
    #[tracing::instrument(skip(self), fields(project_id = %project_id))]
    pub async fn get_public(
        &self,
        project_id: &ObjectId,
    ) -> Result<Option<PublicProject>, ApiError> {
        let coll = self.mongo.collection::<Project>(COLL);

        let project = coll
            .find_one(doc! { "_id": project_id })
            .await
            .context("projects.findOne by _id")
            .map_err(ApiError::Internal)?;

        Ok(project.map(project_to_public))
    }

    /// Manually create a wachat Project for `user_id`, keyed on
    /// `(wabaId, userId)` to match the TS uniqueness check at line 73:
    ///
    /// ```ts
    /// db.collection('projects').findOne({ wabaId: wabaId, userId: new ObjectId(userId) })
    /// ```
    ///
    /// Implemented as a single atomic upsert. On insert we set the same
    /// fields the TS path writes at line 81:
    ///
    /// ```ts
    /// const newProject: Omit<Project, '_id'> = {
    ///     userId: new ObjectId(userId),
    ///     name: projectData.name,
    ///     wabaId: wabaId,
    ///     appId: appId,
    ///     businessId: businessId,
    ///     accessToken: accessToken,
    ///     phoneNumbers: [],
    ///     createdAt: new Date(),
    ///     ...
    /// };
    /// ```
    ///
    /// `createdAt` only fires on insert (`$setOnInsert`); subsequent
    /// calls with the same `(wabaId, userId)` refresh the mutable
    /// fields (`name`, `appId`, `accessToken`, `businessId`) without
    /// rewriting the create timestamp.
    ///
    /// Returns the project's `_id` (newly inserted, or the existing one
    /// when this was an update).
    #[tracing::instrument(skip(self, req), fields(user_id = %user_id, waba_id = %req.waba_id))]
    pub async fn manual_setup(
        &self,
        user_id: &ObjectId,
        req: ManualSetupReq,
    ) -> Result<ObjectId, ApiError> {
        // Mirror the TS guard at line 42:
        //   if (!wabaId || !appId || !accessToken) {
        //       return { error: 'WABA ID, App ID, and Access Token are required.' };
        //   }
        if req.waba_id.trim().is_empty()
            || req.access_token.trim().is_empty()
            || req.app_id.as_deref().map(str::trim).unwrap_or("").is_empty()
        {
            return Err(ApiError::BadRequest(
                "WABA ID, App ID, and Access Token are required.".to_owned(),
            ));
        }
        if req.name.trim().is_empty() {
            return Err(ApiError::BadRequest("Project name is required.".to_owned()));
        }

        let coll = self.mongo.collection::<bson::Document>(COLL);

        let filter = doc! {
            "wabaId": &req.waba_id,
            "userId": user_id,
        };

        // Mutable fields refreshed on every call.
        let mut set_doc = doc! {
            "userId":  user_id,
            "name":    &req.name,
            "wabaId":  &req.waba_id,
            "accessToken": &req.access_token,
            "phoneNumbers": bson::Bson::Array(Vec::<bson::Bson>::new()),
        };
        if let Some(app_id) = req.app_id.as_ref() {
            set_doc.insert("appId", app_id);
        }
        if let Some(business_id) = req.business_id.as_ref() {
            set_doc.insert("businessId", business_id);
        }

        // `createdAt` is only ever written on first insert.
        let set_on_insert = doc! {
            "createdAt": bson::DateTime::from_chrono(Utc::now()),
        };

        let update = doc! {
            "$set":         set_doc,
            "$setOnInsert": set_on_insert,
        };

        let opts = UpdateOptions::builder().upsert(true).build();

        let result = coll
            .update_one(filter.clone(), update)
            .with_options(opts)
            .await
            .context("projects.updateOne upsert by (wabaId, userId)")
            .map_err(ApiError::Internal)?;

        // Resolve the document `_id`. On insert the driver hands it back
        // via `upserted_id`; on update we read it from the existing doc
        // (the filter is unique by index convention).
        if let Some(upserted) = result.upserted_id {
            let oid = upserted
                .as_object_id()
                .context("upserted_id was not an ObjectId")
                .map_err(ApiError::Internal)?;
            tracing::info!(project_id = %oid, "manual wachat setup: inserted project");
            return Ok(oid);
        }

        // Update path — fetch the doc to return its `_id`.
        #[derive(Deserialize)]
        struct IdOnly {
            #[serde(rename = "_id")]
            id: ObjectId,
        }
        let coll_id = self.mongo.collection::<IdOnly>(COLL);
        let existing = coll_id
            .find_one(filter)
            .await
            .context("projects.findOne after upsert match")
            .map_err(ApiError::Internal)?
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "upsert matched but follow-up read returned no document"
                ))
            })?;
        tracing::info!(project_id = %existing.id, "manual wachat setup: updated project");
        Ok(existing.id)
    }
}

/// Build the public-safe projection by copying every field from
/// [`Project`] **except** the access token.
///
/// This is a freestanding helper so the regression test below can pin
/// the shape directly without touching Mongo.
fn project_to_public(p: Project) -> PublicProject {
    let Project {
        id,
        user_id,
        name,
        waba_id,
        business_id,
        app_id,
        access_token: _redacted, // <-- sensitive; explicitly dropped.
        phone_numbers,
        messages_per_second,
        credits,
        plan_id,
        review_status,
        ban_state,
        created_at,
    } = p;

    PublicProject {
        id,
        user_id,
        name,
        waba_id,
        business_id,
        app_id,
        phone_numbers,
        messages_per_second,
        credits,
        plan_id,
        review_status,
        ban_state,
        created_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression test: serializing a `PublicProject` must never produce
    /// an `accessToken` key, even by accident (e.g. someone adds the
    /// field back without removing the `#[serde(skip)]` attribute).
    #[test]
    fn public_project_has_no_access_token() {
        let p = Project {
            id: ObjectId::new(),
            user_id: ObjectId::new(),
            name: "demo".into(),
            waba_id: Some("WABA".into()),
            business_id: Some("BIZ".into()),
            app_id: Some("APP".into()),
            access_token: Some("SECRET-DO-NOT-LEAK".into()),
            phone_numbers: vec![PhoneNumberSummary {
                id: "PN".into(),
                display_phone_number: "+1 555-0100".into(),
                verified_name: "Demo".into(),
                quality_rating: Some("GREEN".into()),
            }],
            messages_per_second: Some(80),
            credits: Some(1.0),
            plan_id: None,
            review_status: None,
            ban_state: None,
            created_at: Utc::now(),
        };

        let public = project_to_public(p);
        let json = serde_json::to_string(&public).expect("serialize PublicProject");

        assert!(
            !json.contains("accessToken"),
            "PublicProject leaked accessToken: {json}"
        );
        assert!(
            !json.contains("SECRET-DO-NOT-LEAK"),
            "PublicProject leaked the token value: {json}"
        );
        // sanity: the rest of the fields are still there
        assert!(json.contains("\"wabaId\":\"WABA\""));
        assert!(json.contains("\"name\":\"demo\""));
    }
}
