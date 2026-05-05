//! Request / response DTOs for [`crate::TemplatesLibrary`].
//!
//! These mirror the TS form-field shape of `saveLibraryTemplate` and the
//! return shape of `handleApplyTemplateToProjects`. They are deliberately
//! plain `serde` structs so the wrapping HTTP crate can wire them up to
//! either an `axum::Form` or an `axum::Json` extractor without translation.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use wachat_types::TemplateCategory;

/// Form payload accepted by [`crate::TemplatesLibrary::save`].
///
/// Mirrors `saveLibraryTemplate`'s `formData.get(...)` extraction at
/// `src/app/actions/template.actions.ts:735-757`:
///
/// ```text
/// name       = formData.get('name')                 // required, lowercase, [a-z0-9_]+, <= 512
/// category   = formData.get('category')             // required
/// language   = formData.get('language')             // required, e.g. "en_US"
/// body       = formData.get('body')                 // required, plain text
/// components = JSON.parse(formData.get('components'))  // required, opaque Meta-shaped JSON
/// ```
///
/// The TS hardcodes `isCustom: true` and `createdAt: new Date()` — we do the
/// same inside `save()` rather than accepting them from callers.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SaveLibraryTemplateReq {
    /// Template name. Must match `^[a-z0-9_]+$` and be at most 512 chars —
    /// validation is enforced inside `save()` so this stays a pure DTO.
    pub name: String,

    /// Meta category: MARKETING / UTILITY / AUTHENTICATION.
    pub category: TemplateCategory,

    /// BCP-47-ish language code as Meta uses them (`en_US`, `hi`, `pt_BR`).
    pub language: String,

    /// Raw body text (the convenience `body` field on `Template`, kept for
    /// quick previews — the canonical body still lives inside `components`).
    pub body: String,

    /// Opaque Meta-wire components array. The TS does
    /// `JSON.parse(formData.get('components'))`; we accept it pre-parsed
    /// because callers using a JSON extractor have it as a `serde_json::Value`
    /// already. HTTP wrappers that take `multipart/form-data` should parse
    /// the string with `serde_json::from_str` before constructing this DTO.
    pub components: serde_json::Value,
}

/// Newtype around the inserted `_id` returned by [`crate::TemplatesLibrary::save`].
///
/// Wrapping the `ObjectId` keeps call-site signatures honest — a bare
/// `ObjectId` could be a project id, a template id, or an inserted-id.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct LibraryTemplateId(pub ObjectId);

impl From<ObjectId> for LibraryTemplateId {
    fn from(oid: ObjectId) -> Self {
        Self(oid)
    }
}

impl From<LibraryTemplateId> for ObjectId {
    fn from(id: LibraryTemplateId) -> Self {
        id.0
    }
}

/// Outcome of [`crate::TemplatesLibrary::apply_to_projects`].
///
/// Mirrors the TS return shape (line 870-874):
///
/// ```ts
/// return { success: true,
///          applied: validatedTargetIds.length,
///          skipped: targetProjectIds.length - validatedTargetIds.length };
/// ```
///
/// In the Rust API we receive the targets pre-validated from the auth crate,
/// so `applied` == `target_project_ids.len()` and `skipped` == 0 in the
/// happy path. The HTTP layer can compute `skipped` itself before calling
/// us by counting how many input ids it rejected, and pass us only the
/// surviving ids — mirroring the TS pattern but with auth concerns hoisted
/// out of this crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ApplyOutcome {
    /// Number of projects that received a bulk-upsert op.
    pub applied: usize,
    /// Number of input target project ids that were dropped before reaching
    /// the bulk write. Always `0` when callers pass already-validated ids.
    pub skipped: usize,
}
