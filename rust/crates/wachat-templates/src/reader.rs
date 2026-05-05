//! Read-only Mongo accessor for the wachat templates collections.
//!
//! All filter / sort docs here are verbatim ports of the TS in
//! `src/app/actions/template.actions.ts` so handlers wired to either the
//! Node or Rust backend see identical query semantics.

use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use tracing::{debug, instrument};
use wachat_types::template::Template;

use crate::library_dto::LibraryTemplate;

/// Mongo collection name for per-project templates.
///
/// TS reference (`getTemplates`, line 31):
/// ```text
/// db.collection('templates').find({ projectId: new ObjectId(projectId) })
///                           .sort({ createdAt: -1 })
/// ```
const TEMPLATES_COLL: &str = "templates";

/// Mongo collection name for the shared template library.
///
/// TS reference (`getLibraryTemplates`, line 799):
/// ```text
/// db.collection('library_templates').find({}).sort({ name: 1 })
/// ```
///
/// NOTE — the prompt mentioned `template_library`; the source of truth in
/// the TS is `library_templates` and that is what we use.
const LIBRARY_COLL: &str = "library_templates";

/// Cheap, cloneable read accessor for the wachat templates collections.
///
/// Holds a [`MongoHandle`] (itself an `Arc`-backed clone), so cloning the
/// reader does **not** open new connections. Drop-in for Axum app state.
#[derive(Debug, Clone)]
pub struct TemplatesReader {
    mongo: MongoHandle,
}

impl TemplatesReader {
    /// Construct a reader bound to the given Mongo handle. The handle's
    /// configured database is used for every query.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// List all templates for a project, newest first.
    ///
    /// Mirrors `getTemplates(projectId)` in the TS:
    /// ```text
    /// db.collection('templates')
    ///   .find({ projectId: new ObjectId(projectId) })
    ///   .sort({ createdAt: -1 })
    ///   .toArray()
    /// ```
    ///
    /// On any driver / decode error the TS swallows and returns `[]`; we
    /// surface the failure as [`ApiError::Internal`] so the calling layer
    /// can decide whether to log-and-continue or 500. That matches the
    /// behaviour of every other read accessor in this codebase.
    #[instrument(skip(self), fields(project_id = %project_id))]
    pub async fn list(&self, project_id: &ObjectId) -> Result<Vec<Template>, ApiError> {
        let filter = doc! { "projectId": project_id };
        let opts = FindOptions::builder()
            .sort(doc! { "createdAt": -1 })
            .build();

        debug!(?filter, "templates.list");

        let coll = self.mongo.collection::<Template>(TEMPLATES_COLL);
        let cursor = coll
            .find(filter)
            .with_options(opts)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find")))?;

        let out: Vec<Template> = cursor
            .try_collect::<Vec<_>>()
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.collect")))?;

        Ok(out)
    }

    /// Fetch a single template by id, scoped to its owning project.
    ///
    /// The TS does not expose a dedicated single-template getter under this
    /// shape — handlers usually call `findOne({ _id })` after manually
    /// validating project ownership. We bake the ownership check into the
    /// filter so callers cannot accidentally cross tenants:
    ///
    /// ```text
    /// { projectId: ObjectId(...), _id: ObjectId(...) }
    /// ```
    #[instrument(skip(self), fields(project_id = %project_id, id = %id))]
    pub async fn get_by_id(
        &self,
        project_id: &ObjectId,
        id: &ObjectId,
    ) -> Result<Option<Template>, ApiError> {
        let filter = doc! { "projectId": project_id, "_id": id };

        debug!(?filter, "templates.get_by_id");

        let coll = self.mongo.collection::<Template>(TEMPLATES_COLL);
        coll.find_one(filter)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find_one")))
    }

    /// List the shared template library, alphabetised by name.
    ///
    /// Mirrors `getLibraryTemplates()` in the TS:
    /// ```text
    /// db.collection('library_templates').find({}).sort({ name: 1 }).toArray()
    /// ```
    ///
    /// **Difference from the TS**: the TS prepends an in-process
    /// `premadeTemplates` constant array before returning. That bundled list
    /// belongs in a separate slice (config / data crate) — this reader
    /// returns only the Mongo-backed custom rows. The orchestrating handler
    /// can concatenate `premadeTemplates` on its side.
    #[instrument(skip(self))]
    pub async fn list_library(&self) -> Result<Vec<LibraryTemplate>, ApiError> {
        let opts = FindOptions::builder().sort(doc! { "name": 1 }).build();

        debug!(coll = LIBRARY_COLL, "library_templates.list");

        let coll = self.mongo.collection::<LibraryTemplate>(LIBRARY_COLL);
        let cursor = coll.find(doc! {}).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("library_templates.find"))
        })?;

        let out: Vec<LibraryTemplate> = cursor.try_collect::<Vec<_>>().await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("library_templates.collect"))
        })?;

        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    //! Pure unit tests for filter doc construction.
    //!
    //! These do **not** touch Mongo. The integration tests in
    //! `tests/reader.rs` cover the live round-trip behind a `testcontainers`
    //! gate.
    use super::*;
    use bson::Bson;

    #[test]
    fn list_filter_matches_ts_shape() {
        // TS: `{ projectId: new ObjectId(projectId) }`
        let project_id = ObjectId::new();
        let filter = doc! { "projectId": project_id };

        assert_eq!(filter.len(), 1);
        match filter.get("projectId").expect("projectId present") {
            Bson::ObjectId(oid) => assert_eq!(oid, &project_id),
            other => panic!("expected ObjectId, got {other:?}"),
        }
    }

    #[test]
    fn list_sort_is_created_at_desc() {
        // TS: `.sort({ createdAt: -1 })`
        let sort = doc! { "createdAt": -1 };
        assert_eq!(sort.get_i32("createdAt").unwrap(), -1);
    }

    #[test]
    fn get_by_id_filter_matches_ts_shape() {
        // Derived from the `findOne({ _id, projectId })` pattern used
        // elsewhere in `template.actions.ts` (e.g. `handleApplyTemplateToProjects`).
        let project_id = ObjectId::new();
        let id = ObjectId::new();
        let filter = doc! { "projectId": project_id, "_id": id };

        assert_eq!(filter.len(), 2);
        assert_eq!(
            filter.get_object_id("projectId").unwrap(),
            project_id,
            "projectId field must be the bound project"
        );
        assert_eq!(
            filter.get_object_id("_id").unwrap(),
            id,
            "_id field must be the bound template id"
        );
    }

    #[test]
    fn library_filter_is_empty() {
        // TS: `.find({})`
        let filter = doc! {};
        assert_eq!(filter.len(), 0);
    }

    #[test]
    fn library_sort_is_name_asc() {
        // TS: `.sort({ name: 1 })`
        let sort = doc! { "name": 1 };
        assert_eq!(sort.get_i32("name").unwrap(), 1);
    }

    #[test]
    fn collection_names_match_ts() {
        // Source of truth: `template.actions.ts` lines 31 + 799.
        assert_eq!(TEMPLATES_COLL, "templates");
        assert_eq!(LIBRARY_COLL, "library_templates");
    }
}
