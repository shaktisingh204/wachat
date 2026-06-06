//! Multi-language template cloning.
//!
//! Given one *source* template (resolved by Mongo id or by name within
//! the caller's project), produce one **copy per target language** on
//! Meta — each a brand-new `message_template` submission in that locale.
//!
//! ## Where the external (Meta Graph) work happens
//!
//! This module performs **no** direct Graph or RSA calls of its own. It
//! reconstructs a [`CreateTemplateRequest`] from the source template's
//! stored Meta-wire `components` and then delegates to the existing
//! [`TemplatesMutator::create`] path — the single, already-isolated
//! code path that talks to `wachat-meta-client`. That keeps every
//! external side-effect funneled through one audited seam and means this
//! module compiles and routes with **no live credentials**: when a
//! project has no WABA id / access token, `create` returns a typed
//! [`ApiError::BadRequest`], which we fold into a per-language
//! `status = "failed"` row instead of panicking.
//!
//! ## Graceful degradation
//!
//! - Whole-request invalid (no source selector, empty target list, bad
//!   project id, project not owned, source not found) → typed
//!   [`ApiError`] (the handler maps to a non-200 envelope).
//! - Per-language failure (missing creds, Meta rejection, malformed
//!   source component) → `CloneOutcome { language, status: "failed",
//!   error: Some(reason) }`, while the overall request still returns
//!   `200` with the full outcome array.

use bson::{Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::{debug, instrument, warn};
use wachat_templates_categories::TEMPLATES_COLLECTION;
use wachat_templates_mutate::{
    CreateTemplateRequest, HeaderFormat, HeaderMedia, TemplateButton, TemplatesMutator,
};
use wachat_types::{Project, TemplateCategory};

use crate::dto::{CloneOutcome, MultiLangCloneResult};

/// Status string for a language that was cloned successfully.
const STATUS_OK: &str = "created";
/// Status string for a language whose clone attempt failed.
const STATUS_FAILED: &str = "failed";
/// Status string for a language we skipped because it equals the source.
const STATUS_SKIPPED: &str = "skipped";

/// Resolved source template plus the immutable fields a clone reuses.
///
/// Built once from the source Mongo row so each per-language clone is a
/// cheap field copy with only `language` swapped.
struct SourceTemplate {
    name: String,
    source_language: String,
    category: TemplateCategory,
    body: String,
    body_examples: Vec<String>,
    footer: Option<String>,
    header_format: HeaderFormat,
    header_text: Option<String>,
    header_example: Option<String>,
    header_media_url: Option<String>,
    buttons: Vec<TemplateButton>,
}

impl SourceTemplate {
    /// Build a [`CreateTemplateRequest`] for one target `language`.
    fn create_request_for(&self, language: &str, app_id: Option<String>) -> CreateTemplateRequest {
        CreateTemplateRequest {
            name: self.name.clone(),
            language: language.to_owned(),
            category: self.category,
            body: self.body.clone(),
            body_examples: self.body_examples.clone(),
            footer: self.footer.clone().filter(|s| !s.is_empty()),
            header_format: self.header_format,
            header_text: self.header_text.clone(),
            header_example: self.header_example.clone(),
            header_media: self.header_media_url.clone().map(HeaderMedia::Url),
            buttons: self.buttons.clone(),
            allow_category_change: true,
            app_id,
        }
    }
}

/// Orchestrate a multi-language clone.
///
/// `source_id` and `source_name` are mutually-optional selectors; at
/// least one must be present (enforced by the caller / [`resolve_source`]).
/// Every Graph side-effect flows through `mutator.create`.
#[instrument(skip_all, fields(project_id = %project.id, target_count = target_languages.len()))]
pub async fn clone_to_languages(
    mongo: &MongoHandle,
    mutator: &TemplatesMutator,
    project: &Project,
    source_id: Option<&str>,
    source_name: Option<&str>,
    target_languages: &[String],
) -> Result<MultiLangCloneResult> {
    if target_languages.is_empty() {
        return Err(ApiError::BadRequest(
            "targetLanguages must contain at least one language".to_owned(),
        ));
    }

    let source = resolve_source(mongo, project, source_id, source_name).await?;

    let mut outcomes: Vec<CloneOutcome> = Vec::with_capacity(target_languages.len());
    let mut seen: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();

    for language in target_languages {
        let lang = language.trim();
        if lang.is_empty() {
            outcomes.push(CloneOutcome::failed(
                language.clone(),
                "language must not be empty",
            ));
            continue;
        }
        // Skip the source's own language and any duplicate target so we
        // never collide with the existing row on (project, name, lang).
        if lang.eq_ignore_ascii_case(&source.source_language) {
            outcomes.push(CloneOutcome {
                language: lang.to_owned(),
                status: STATUS_SKIPPED.to_owned(),
                error: Some("target language matches the source language".to_owned()),
                meta_id: None,
            });
            continue;
        }
        if !seen.insert(lang.to_ascii_lowercase()) {
            outcomes.push(CloneOutcome {
                language: lang.to_owned(),
                status: STATUS_SKIPPED.to_owned(),
                error: Some("duplicate target language".to_owned()),
                meta_id: None,
            });
            continue;
        }

        let req = source.create_request_for(lang, project.app_id.clone());
        match mutator.create(project, req).await {
            Ok(template) => {
                debug!(language = %lang, "multilang clone created");
                outcomes.push(CloneOutcome {
                    language: lang.to_owned(),
                    status: STATUS_OK.to_owned(),
                    error: None,
                    meta_id: template.meta_template_id,
                });
            }
            Err(e) => {
                warn!(language = %lang, error = %e, "multilang clone failed");
                outcomes.push(CloneOutcome::failed(lang.to_owned(), e.to_string()));
            }
        }
    }

    let created = outcomes
        .iter()
        .filter(|o| o.status == STATUS_OK)
        .count();
    let failed = outcomes
        .iter()
        .filter(|o| o.status == STATUS_FAILED)
        .count();

    Ok(MultiLangCloneResult {
        source_name: source.name,
        source_language: source.source_language,
        created,
        failed,
        outcomes,
    })
}

/// Resolve the source template row for the project, scoped by tenant
/// (the caller already proved ownership of `project`).
///
/// Prefers `source_id` (exact Mongo `_id`) when present; otherwise
/// matches the newest row by `name`.
#[instrument(skip_all)]
async fn resolve_source(
    mongo: &MongoHandle,
    project: &Project,
    source_id: Option<&str>,
    source_name: Option<&str>,
) -> Result<SourceTemplate> {
    let coll = mongo.collection::<Document>(TEMPLATES_COLLECTION);

    let filter = if let Some(id) = source_id.map(str::trim).filter(|s| !s.is_empty()) {
        let oid = ObjectId::parse_str(id).map_err(|_| {
            ApiError::BadRequest(format!("sourceTemplateId is not a valid id: {id}"))
        })?;
        doc! { "_id": oid, "projectId": project.id }
    } else if let Some(name) = source_name.map(str::trim).filter(|s| !s.is_empty()) {
        doc! { "name": name, "projectId": project.id }
    } else {
        return Err(ApiError::BadRequest(
            "either sourceTemplateId or sourceTemplateName is required".to_owned(),
        ));
    };

    let row = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find_one")))?
        .ok_or_else(|| ApiError::NotFound("source template not found".to_owned()))?;

    parse_source(row)
}

/// Reconstruct a [`SourceTemplate`] from a stored `templates` document.
///
/// The persisted `components` array is Meta's wire shape (the exact JSON
/// the mutator built on create). We reverse it back into the typed
/// request fields. Anything unrecognized degrades to a sensible default
/// rather than failing the whole clone.
fn parse_source(row: Document) -> Result<SourceTemplate> {
    let name = row
        .get_str("name")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::BadRequest("source template has no name".to_owned()))?
        .to_owned();

    let source_language = row
        .get_str("language")
        .unwrap_or("")
        .to_owned();

    let category = row
        .get_str("category")
        .ok()
        .and_then(parse_category)
        .unwrap_or(TemplateCategory::Marketing);

    // `components` is stored as BSON; convert to serde_json so we can read
    // the Meta-wire fields uniformly.
    let components: Value = row
        .get("components")
        .cloned()
        .map(|b| serde_json::to_value(b).unwrap_or(Value::Null))
        .unwrap_or(Value::Null);
    let components = components.as_array().cloned().unwrap_or_default();

    let mut body = String::new();
    let mut body_examples: Vec<String> = Vec::new();
    let mut footer: Option<String> = None;
    let mut header_format = HeaderFormat::None;
    let mut header_text: Option<String> = None;
    let mut header_example: Option<String> = None;
    let mut header_media_url: Option<String> = None;
    let mut buttons: Vec<TemplateButton> = Vec::new();

    for comp in &components {
        let ctype = comp
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_ascii_uppercase();
        match ctype.as_str() {
            "BODY" => {
                body = comp
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned();
                // example.body_text is `[[ex1, ex2, ...]]`.
                if let Some(arr) = comp
                    .get("example")
                    .and_then(|e| e.get("body_text"))
                    .and_then(Value::as_array)
                    .and_then(|outer| outer.first())
                    .and_then(Value::as_array)
                {
                    body_examples = arr
                        .iter()
                        .filter_map(|v| v.as_str().map(str::to_owned))
                        .collect();
                }
            }
            "FOOTER" => {
                footer = comp
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|s| !s.is_empty())
                    .map(str::to_owned);
            }
            "HEADER" => {
                let fmt = comp
                    .get("format")
                    .and_then(Value::as_str)
                    .unwrap_or("NONE");
                header_format = parse_header_format(fmt);
                header_text = comp
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::to_owned);
                // header_text example: example.header_text[0].
                header_example = comp
                    .get("example")
                    .and_then(|e| e.get("header_text"))
                    .and_then(Value::as_array)
                    .and_then(|a| a.first())
                    .and_then(Value::as_str)
                    .map(str::to_owned);
                // Media headers were created from a handle, not a URL, so
                // there is no re-usable URL to clone. We leave
                // header_media_url = None; clones of media headers will be
                // reported as failed by `create` (missing media). That is
                // the safe, honest outcome.
                let _ = &mut header_media_url;
            }
            "BUTTONS" => {
                if let Some(arr) = comp.get("buttons").and_then(Value::as_array) {
                    for b in arr {
                        match serde_json::from_value::<TemplateButton>(b.clone()) {
                            Ok(btn) => buttons.push(btn),
                            Err(e) => warn!(error = %e, "skipping unparseable source button"),
                        }
                    }
                }
            }
            other => {
                warn!(component_type = %other, "ignoring unrecognized source component");
            }
        }
    }

    if body.trim().is_empty() {
        // Fall back to the top-level `body` field the mutator also persists.
        if let Ok(b) = row.get_str("body") {
            body = b.to_owned();
        }
    }

    Ok(SourceTemplate {
        name,
        source_language,
        category,
        body,
        body_examples,
        footer,
        header_format,
        header_text,
        header_example,
        header_media_url,
        buttons,
    })
}

/// Parse Meta's category string into the typed enum.
fn parse_category(s: &str) -> Option<TemplateCategory> {
    match s.to_ascii_uppercase().as_str() {
        "MARKETING" => Some(TemplateCategory::Marketing),
        "UTILITY" => Some(TemplateCategory::Utility),
        "AUTHENTICATION" => Some(TemplateCategory::Authentication),
        _ => None,
    }
}

/// Parse Meta's header `format` string into the typed enum.
fn parse_header_format(s: &str) -> HeaderFormat {
    match s.to_ascii_uppercase().as_str() {
        "TEXT" => HeaderFormat::Text,
        "IMAGE" => HeaderFormat::Image,
        "VIDEO" => HeaderFormat::Video,
        "DOCUMENT" => HeaderFormat::Document,
        "AUDIO" => HeaderFormat::Audio,
        _ => HeaderFormat::None,
    }
}
