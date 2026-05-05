//! [`TemplatesLibrary`] — write-side handle for the wachat *library / catalog*
//! template endpoints.
//!
//! See the crate-level docs for the TS source-of-truth mapping. This file is
//! the implementation; pure shape tests live in `tests/library.rs`.
//!
//! ## Mongo collections touched
//! * `library_templates`  — admin pool. `save` inserts; `delete` deletes.
//! * `templates`          — per-project rows. `apply_to_projects` reads one
//!   source row and bulk-upserts copies into N target projects.

use bson::oid::ObjectId;
use bson::{Document, doc};
use chrono::Utc;
use mongodb::Collection;
use mongodb::options::UpdateOptions;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use tracing::{debug, info, instrument, warn};

use crate::dto::{ApplyOutcome, LibraryTemplateId, SaveLibraryTemplateReq};
use crate::{LIBRARY_TEMPLATES_COLLECTION, TEMPLATES_COLLECTION};

/// Maximum length the TS enforces on `name` (line 741):
/// `if (name.length > 512) return { error: 'Template name cannot exceed 512 characters.' };`
const MAX_NAME_LEN: usize = 512;

/// Write-side handle for the wachat library / catalog templates endpoints.
///
/// Cheap to clone (it just wraps a `MongoHandle`, which is internally
/// reference-counted).
#[derive(Debug, Clone)]
pub struct TemplatesLibrary {
    mongo: MongoHandle,
}

impl TemplatesLibrary {
    /// Construct from a Mongo handle. The handle is expected to already point
    /// at the SabNode database (typically `MONGODB_DB`); we take it by value
    /// to mirror sibling crates.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Insert a custom row into the `library_templates` collection.
    ///
    /// Mirrors `saveLibraryTemplate`
    /// (`src/app/actions/template.actions.ts:731`):
    ///
    /// ```ts
    /// const templateData = {
    ///     name, category, language, body, components,
    ///     isCustom: true,
    ///     createdAt: new Date(),
    /// };
    /// await db.collection('library_templates').insertOne(templateData);
    /// ```
    ///
    /// Validation (also from the TS, lines 738-745):
    /// * `name` is required, lowercase letters / digits / `_` only,
    ///   <= 512 chars.
    /// * `category`, `language`, `body` are required.
    ///
    /// Auth (`getAdminSession()`) is **not** enforced here — caller is
    /// expected to be the admin HTTP handler that wraps this method.
    #[instrument(level = "debug", skip(self, req), fields(name = %req.name, language = %req.language))]
    pub async fn save(&self, req: SaveLibraryTemplateReq) -> Result<LibraryTemplateId, ApiError> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(ApiError::Validation(
                "Template name is required.".to_owned(),
            ));
        }
        if name.len() > MAX_NAME_LEN {
            return Err(ApiError::Validation(
                "Template name cannot exceed 512 characters.".to_owned(),
            ));
        }
        if !is_lowercase_underscore(name) {
            return Err(ApiError::Validation(
                "Template name can only contain lowercase letters, numbers, and underscores (_)."
                    .to_owned(),
            ));
        }

        if req.language.trim().is_empty() || req.body.trim().is_empty() {
            return Err(ApiError::Validation(
                "Category, language, and body are required.".to_owned(),
            ));
        }

        // Build the BSON doc directly so we can pin the field-name shape to
        // the existing TS rows (camelCase, no `_id` — Mongo assigns it).
        let category_str = serde_json::to_value(req.category)
            .ok()
            .and_then(|v| v.as_str().map(str::to_owned))
            .unwrap_or_else(|| "MARKETING".to_owned());

        // `components` arrived as a JSON array; round-trip through bson for
        // storage parity with how the TS driver serializes JS arrays.
        let components_bson =
            bson::to_bson(&req.components).map_err(|e| ApiError::Internal(e.into()))?;

        let now = bson::DateTime::from_chrono(Utc::now());
        let doc = doc! {
            "name": name,
            "category": category_str,
            "language": req.language.trim(),
            "body": req.body,
            "components": components_bson,
            "isCustom": true,
            "createdAt": now,
        };

        let coll: Collection<Document> = self
            .mongo
            .collection::<Document>(LIBRARY_TEMPLATES_COLLECTION);
        let result = coll
            .insert_one(doc)
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;

        let id = result.inserted_id.as_object_id().ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "library_templates insert returned non-ObjectId _id"
            ))
        })?;

        info!(library_template_id = %id, "library template saved");
        Ok(LibraryTemplateId(id))
    }

    /// Delete a custom row from `library_templates` by `_id`.
    ///
    /// Mirrors `deleteLibraryTemplate`
    /// (`src/app/actions/template.actions.ts:776`). Returns `NotFound` when
    /// `deletedCount == 0`, matching the TS error string semantics.
    #[instrument(level = "debug", skip(self), fields(library_template_id = %id))]
    pub async fn delete(&self, id: &ObjectId) -> Result<(), ApiError> {
        let coll: Collection<Document> = self
            .mongo
            .collection::<Document>(LIBRARY_TEMPLATES_COLLECTION);
        let result = coll
            .delete_one(doc! { "_id": id })
            .await
            .map_err(|e| ApiError::Internal(e.into()))?;

        if result.deleted_count == 0 {
            warn!(library_template_id = %id, "delete: row not found");
            return Err(ApiError::NotFound(
                "Could not find the custom library template to delete.".to_owned(),
            ));
        }

        info!(library_template_id = %id, "library template deleted");
        Ok(())
    }

    /// Copy a per-project source template into N target projects.
    ///
    /// Mirrors `handleApplyTemplateToProjects`
    /// (`src/app/actions/template.actions.ts:808`).
    ///
    /// **Important — this reads from `templates`, not `library_templates`.**
    /// The TS source row at line 815 is loaded with:
    /// `db.collection('templates').findOne({ _id: new ObjectId(sourceTemplateId) })`.
    ///
    /// **Dedup rule.** The TS bulk write upserts using filter
    /// `{ projectId, name, language }` (line 861) — meaning a target project
    /// that already has a template with the same `(name, language)` gets its
    /// row **updated in place** rather than a duplicate inserted. We honor
    /// that filter exactly. Projects without a match get a fresh insert via
    /// `upsert: true`.
    ///
    /// **Auth-derived `skipped`.** The TS computes `skipped` from
    /// `targetProjectIds.length - validatedTargetIds.length` (line 873) — i.e.
    /// targets dropped by `getProjectById`. Auth is hoisted out of this crate
    /// (the HTTP wrapper validates ids first), so callers pass already-vetted
    /// targets and `skipped` defaults to 0. To preserve the TS observability
    /// the wrapper can construct the final `ApplyOutcome` itself.
    ///
    /// Per-row writes use `update_one` with `upsert: true` in a sequential
    /// loop. The TS uses `bulkWrite` for round-trip efficiency; the
    /// observable outcome is identical and a loop sidesteps the
    /// per-driver-version bulk-write API differences.
    #[instrument(
        level = "debug",
        skip(self, target_project_ids),
        fields(source_id = %source_id, target_count = target_project_ids.len()),
    )]
    pub async fn apply_to_projects(
        &self,
        source_id: &ObjectId,
        target_project_ids: &[ObjectId],
    ) -> Result<ApplyOutcome, ApiError> {
        if target_project_ids.is_empty() {
            return Err(ApiError::BadRequest(
                "Source template and target projects are required.".to_owned(),
            ));
        }

        let templates: Collection<Document> =
            self.mongo.collection::<Document>(TEMPLATES_COLLECTION);

        // ---- 1. Load the source row from `templates` ------------------------
        let source = templates
            .find_one(doc! { "_id": source_id })
            .await
            .map_err(|e| ApiError::Internal(e.into()))?
            .ok_or_else(|| ApiError::NotFound("Source template not found.".to_owned()))?;

        // Pull out the dedup-key fields. TS treats both as definitely-present
        // strings (`sourceTemplate.name`, `sourceTemplate.language`); enforce
        // the same expectation here so a malformed Mongo row surfaces as a
        // clear 422 rather than a panic.
        let source_name = source
            .get_str("name")
            .map_err(|_| ApiError::Validation("Source template is missing `name`.".to_owned()))?;
        let source_language = source.get_str("language").map_err(|_| {
            ApiError::Validation("Source template is missing `language`.".to_owned())
        })?;

        // ---- 2. Build the per-target update payload --------------------------
        // Strip fields that must NOT be carried over. Mirrors TS lines 851-857:
        //   _id          → regenerated (we let upsert assign on insert path)
        //   projectId    → set per-target below
        //   status       → "LOCAL" so the cron picks it up
        //   metaId       → "" (cleared)
        //   createdAt    → bumped to now()
        //   headerSampleUrl → deleted
        let mut base = source.clone();
        base.remove("_id");
        base.remove("projectId");
        base.remove("status");
        base.remove("metaId");
        base.remove("createdAt");
        base.remove("headerSampleUrl");

        let now = bson::DateTime::from_chrono(Utc::now());

        // ---- 3. Upsert per target with the (projectId, name, language) filter
        let mut applied = 0usize;
        for target in target_project_ids {
            let mut payload = base.clone();
            payload.insert("projectId", target);
            payload.insert("name", source_name);
            payload.insert("language", source_language);
            payload.insert("status", "LOCAL");
            payload.insert("metaId", "");
            payload.insert("createdAt", now);

            let filter = doc! {
                "projectId": target,
                "name": source_name,
                "language": source_language,
            };
            let update = doc! { "$set": payload };

            let opts = UpdateOptions::builder().upsert(true).build();
            templates
                .update_one(filter, update)
                .with_options(opts)
                .await
                .map_err(|e| ApiError::Internal(e.into()))?;

            applied += 1;
            debug!(target_project_id = %target, "apply_to_projects: upserted");
        }

        info!(applied, "apply_to_projects: completed");
        Ok(ApplyOutcome {
            applied,
            // Auth-derived skips happen in the HTTP wrapper; see method docs.
            skipped: 0,
        })
    }
}

/// True iff `s` matches `^[a-z0-9_]+$`. Pure-ASCII so we walk bytes and skip
/// the `regex` dependency — this helper is hot only on admin saves.
fn is_lowercase_underscore(s: &str) -> bool {
    !s.is_empty()
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_regex_accepts_lowercase_digits_underscore() {
        assert!(is_lowercase_underscore("hello"));
        assert!(is_lowercase_underscore("hello_world_42"));
        assert!(is_lowercase_underscore("a"));
        assert!(is_lowercase_underscore("___"));
        assert!(is_lowercase_underscore("0"));
    }

    #[test]
    fn name_regex_rejects_uppercase_dashes_dots_empty() {
        assert!(!is_lowercase_underscore(""));
        assert!(!is_lowercase_underscore("Hello"));
        assert!(!is_lowercase_underscore("hello-world"));
        assert!(!is_lowercase_underscore("hello.world"));
        assert!(!is_lowercase_underscore("hello world"));
        assert!(!is_lowercase_underscore("héllo"));
    }
}
