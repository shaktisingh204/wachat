//! `TemplatesMutator` — the only public entry point for create / edit /
//! delete operations against the Meta WhatsApp message-template
//! endpoints. Construct once per process and clone freely (the
//! underlying `MetaClient`, `MediaUploader`, and `MongoHandle` are all
//! cheap-clone Arc-wrappers).
//!
//! ## Meta API surface, pinned to TS source
//!
//! Each call below quotes the originating TypeScript URL line so a
//! reviewer can byte-compare the wire shape. The version segment
//! (`v22.0` in the TS) is supplied to `MetaClient::new`; we forward
//! whatever the caller chose.
//!
//! - **create**       `POST /{wabaId}/message_templates`
//!   TS L463-473 of `template.actions.ts`.
//! - **flow create**  `POST /{wabaId}/message_templates`
//!   TS L692-696.
//! - **edit**         `POST /{metaTemplateId}`
//!   TS L970-980.
//! - **delete by name** `DELETE /{wabaId}/message_templates?name={name}`
//!   TS L1021-1027.
//! - **delete by id**   `DELETE /{metaTemplateId}`
//!   TS L1060-1066.
//!
//! ## Body shape
//!
//! `create` and `flow_create` build a `serde_json::Value` payload
//! whose top-level keys are `name`, `language`, `category`,
//! `allow_category_change` (only for non-flow), and `components` —
//! exactly what `wachat_meta_dto::CreateTemplateReq` describes. We do
//! **not** use `CreateTemplateReq` directly because we need to add
//! `allow_category_change` (which the DTO doesn't model) and we want
//! per-component JSON construction control.

use std::collections::BTreeSet;

use bson::doc;
use bson::oid::ObjectId;
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_common::{ApiError, error::Result};
use serde_json::{Value, json};
use tracing::{debug, warn};
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_types::{Project, Template, TemplateCategory, TemplateStatus};

use crate::dto::{
    BulkCreateOutcome, BulkError, CreateFlowTemplateRequest, CreateTemplateRequest,
    EditTemplateRequest, HeaderFormat, HeaderMedia, TemplateButton,
};

use sabnode_db::MongoHandle;

/// Templates mutator. Cheap to clone.
#[derive(Debug, Clone)]
pub struct TemplatesMutator {
    mongo: MongoHandle,
    meta: MetaClient,
    media: MediaUploader,
}

impl TemplatesMutator {
    /// Build a new mutator. Construct once per process, clone freely.
    pub fn new(mongo: MongoHandle, meta: MetaClient, media: MediaUploader) -> Self {
        Self { mongo, meta, media }
    }

    // -----------------------------------------------------------------
    // create
    // -----------------------------------------------------------------

    /// Port of `handleCreateTemplate` (TS L163).
    ///
    /// Wire call: `POST {version}/{wabaId}/message_templates`
    /// (TS L463-473). The body shape mirrors the TS literal at L300-305
    /// plus per-component pushes.
    pub async fn create(&self, project: &Project, req: CreateTemplateRequest) -> Result<Template> {
        let waba_id = project_waba_id(project)?;
        let access_token = project_access_token(project)?;

        let payload = self.build_create_payload(project, &req).await?;

        debug!(
            template = %req.name,
            "submitting create template payload to Meta"
        );

        let path = format!("{}/message_templates", waba_id);
        let resp: Value = self.meta.post_json(&path, access_token, &payload).await?;

        let meta_id = resp
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "Template created on Meta, but no ID was returned. Please sync manually."
                ))
            })?
            .to_owned();

        let status = parse_status(resp.get("status"));

        let components = payload
            .get("components")
            .cloned()
            .unwrap_or(Value::Array(vec![]));

        self.insert_template_doc(
            project.id,
            &req.name,
            &req.language,
            req.category,
            status,
            &meta_id,
            &components,
            Some(&req.body),
        )
        .await
    }

    // -----------------------------------------------------------------
    // bulk_create
    // -----------------------------------------------------------------

    /// Port of `handleBulkCreateTemplate` (TS L511).
    ///
    /// The TS handler **does not** call Meta synchronously — it inserts
    /// `status: 'LOCAL'` rows that a cron job later submits. We mirror
    /// that here: each request is forwarded to [`Self::create`]
    /// in parallel (per the slice doc-string `parallel create`),
    /// collecting per-name failures rather than aborting the batch.
    pub async fn bulk_create(
        &self,
        project: &Project,
        reqs: Vec<CreateTemplateRequest>,
    ) -> Result<BulkCreateOutcome> {
        let mut handles = Vec::with_capacity(reqs.len());
        for req in reqs {
            let name = req.name.clone();
            let this = self.clone();
            let project_clone = clone_project(project);
            handles.push(tokio::spawn(async move {
                let res = this.create(&project_clone, req).await;
                (name, res)
            }));
        }

        let mut outcome = BulkCreateOutcome {
            created: Vec::new(),
            failed: Vec::new(),
        };

        for h in handles {
            match h.await {
                Ok((_name, Ok(t))) => outcome.created.push(t),
                Ok((name, Err(e))) => outcome.failed.push(BulkError {
                    name,
                    message: format!("{e}"),
                }),
                Err(join_err) => outcome.failed.push(BulkError {
                    name: "<panicked>".to_owned(),
                    message: format!("task join error: {join_err}"),
                }),
            }
        }

        Ok(outcome)
    }

    // -----------------------------------------------------------------
    // create_flow
    // -----------------------------------------------------------------

    /// Port of `handleCreateFlowTemplate` (TS L649).
    ///
    /// Wire call: `POST {version}/{wabaId}/message_templates`
    /// (TS L692-696). Body mirrors the literal at L668-688: a BODY
    /// component plus a single FLOW button.
    pub async fn create_flow(
        &self,
        project: &Project,
        req: CreateFlowTemplateRequest,
    ) -> Result<Template> {
        let waba_id = project_waba_id(project)?;
        let access_token = project_access_token(project)?;

        // TS L669: `name: templateName.toLowerCase().replace(/\s+/g, '_')`.
        let name = normalize_flow_template_name(&req.template_name);

        let components = json!([
            { "type": "BODY", "text": req.body_text },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "FLOW",
                        "text": req.button_text,
                        "flow_id": req.flow_id,
                    }
                ]
            }
        ]);

        let payload = json!({
            "name": name,
            "language": req.language,
            "category": category_to_meta(req.category),
            "components": components,
        });

        let path = format!("{}/message_templates", waba_id);
        let resp: Value = self.meta.post_json(&path, access_token, &payload).await?;

        let meta_id = resp
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "Template created on Meta, but no ID was returned. Please sync manually."
                ))
            })?
            .to_owned();
        let status = parse_status(resp.get("status"));

        self.insert_template_doc(
            project.id,
            &name,
            &req.language,
            req.category,
            status,
            &meta_id,
            &components,
            Some(&req.body_text),
        )
        .await
    }

    // -----------------------------------------------------------------
    // edit
    // -----------------------------------------------------------------

    /// Port of `handleEditTemplate` (TS L884).
    ///
    /// Wire call: `POST {version}/{metaTemplateId}` (TS L970-980). We
    /// look up the local row by `(metaId, projectId)` and update its
    /// status + components.
    pub async fn edit(
        &self,
        project: &Project,
        template_id: &ObjectId,
        req: EditTemplateRequest,
    ) -> Result<Template> {
        let access_token = project_access_token(project)?;

        // Build the `components` array exactly like TS L901-961.
        let mut components: Vec<Value> = Vec::new();

        if let Some(format) = req.header_format
            && format != HeaderFormat::None
        {
            let mut header = json!({
                "type": "HEADER",
                "format": format.as_meta_str(),
            });
            if format == HeaderFormat::Text {
                if let Some(t) = &req.header_text {
                    header["text"] = json!(t.trim());
                }
            } else if format.requires_media()
                && let Some(media) = &req.header_media
            {
                let app_id = req.app_id.as_deref().ok_or_else(|| {
                    ApiError::BadRequest(
                        "App ID required to upload edit template header media".to_owned(),
                    )
                })?;
                let handle = self
                    .upload_header_media(app_id, access_token, media)
                    .await?;
                header["example"] = json!({ "header_handle": [handle] });
            }
            components.push(header);
        }

        if let Some(body) = &req.body {
            let mut body_component = json!({ "type": "BODY", "text": body.trim() });
            // Only emit `example.body_text` when at least one example
            // is provided — matches TS L939 (`if (bodyExamples.length > 0)`).
            if !req.body_examples.is_empty() {
                body_component["example"] = json!({ "body_text": [req.body_examples] });
            }
            components.push(body_component);
        }

        if let Some(footer) = &req.footer {
            let trimmed = footer.trim();
            if !trimmed.is_empty() {
                components.push(json!({ "type": "FOOTER", "text": trimmed }));
            }
        }

        if let Some(buttons) = &req.buttons
            && !buttons.is_empty()
        {
            let formatted: Vec<Value> = buttons.iter().map(format_button).collect();
            components.push(json!({ "type": "BUTTONS", "buttons": formatted }));
        }

        let mut payload = serde_json::Map::new();
        if !components.is_empty() {
            payload.insert("components".to_owned(), Value::Array(components.clone()));
        }
        if let Some(cat) = req.category {
            payload.insert("category".to_owned(), json!(category_to_meta(cat)));
        }
        let payload = Value::Object(payload);

        let resp: Value = self
            .meta
            .post_json(&req.meta_template_id, access_token, &payload)
            .await?;

        let status = parse_status(resp.get("status"));

        // Update Mongo doc: TS L991-998 sets `status` plus optionally
        // `components` and `body`.
        let coll = self.mongo.collection::<bson::Document>("templates");

        let mut set_fields = doc! {
            "status": meta_status_str(status),
        };
        if !components.is_empty() {
            let bson_components = bson::to_bson(&Value::Array(components))
                .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
            set_fields.insert("components", bson_components);
        }
        if let Some(body) = &req.body {
            set_fields.insert("body", body.trim());
        }

        coll.update_one(
            doc! {
                "metaId": &req.meta_template_id,
                "projectId": project.id,
            },
            doc! { "$set": set_fields },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        // Return the freshest row, which is what callers expect.
        let updated = coll
            .find_one(doc! { "_id": template_id })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
            .ok_or_else(|| ApiError::NotFound(format!("template {template_id} not found")))?;

        let template: Template =
            bson::from_document(updated).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        Ok(template)
    }

    // -----------------------------------------------------------------
    // delete_by_name
    // -----------------------------------------------------------------

    /// Port of `handleDeleteTemplate` (TS L1009).
    ///
    /// Wire call: `DELETE {version}/{wabaId}/message_templates?name={url-encoded name}`
    /// (TS L1021-1027). Deletes ALL language variants matching the
    /// name on Meta, then mirrors the deletion locally with
    /// `deleteMany({ projectId, name })`.
    pub async fn delete_by_name(&self, project: &Project, name: &str) -> Result<()> {
        let waba_id = project_waba_id(project)?;
        let access_token = project_access_token(project)?;

        let path = format!("{}/message_templates?name={}", waba_id, urlencode(name));
        self.meta.delete(&path, access_token).await?;

        let coll = self.mongo.collection::<bson::Document>("templates");
        coll.delete_many(doc! {
            "projectId": project.id,
            "name": name,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        Ok(())
    }

    // -----------------------------------------------------------------
    // delete_by_id
    // -----------------------------------------------------------------

    /// Port of `handleDeleteTemplateById` (TS L1052).
    ///
    /// Wire call: `DELETE {version}/{metaTemplateId}` (TS L1060-1066).
    /// `template_id` is the local Mongo `_id`; we look up the Meta id
    /// from it (or from a passed-in metaId via the public API by
    /// pre-resolving), then mirror the delete locally.
    ///
    /// To stay token-free of tradeoffs the TS handler accepts the
    /// Meta id directly. To keep the public Rust API project-scoped
    /// + ObjectId-keyed, we resolve the Mongo doc first.
    pub async fn delete_by_id(&self, project: &Project, template_id: &ObjectId) -> Result<()> {
        let access_token = project_access_token(project)?;

        let coll = self.mongo.collection::<bson::Document>("templates");
        let row = coll
            .find_one(doc! {
                "_id": template_id,
                "projectId": project.id,
            })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
            .ok_or_else(|| {
                ApiError::NotFound(format!(
                    "template {template_id} not found in project {}",
                    project.id
                ))
            })?;

        // `metaId` may be empty for LOCAL-only drafts — in that case
        // we skip the Meta call (mirrors the TS not finding `hsm_id`).
        let meta_id = row
            .get_str("metaId")
            .ok()
            .filter(|s| !s.is_empty())
            .map(str::to_owned);

        if let Some(meta_id) = meta_id {
            self.meta.delete(&meta_id, access_token).await?;
        } else {
            warn!(
                template_id = %template_id,
                "delete_by_id: template has no metaId, skipping Meta call"
            );
        }

        coll.delete_one(doc! {
            "_id": template_id,
            "projectId": project.id,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        Ok(())
    }

    // =================================================================
    // internals
    // =================================================================

    async fn build_create_payload(
        &self,
        _project: &Project,
        req: &CreateTemplateRequest,
    ) -> Result<Value> {
        // Validate body — matches TS L406.
        if req.body.trim().is_empty() {
            return Err(ApiError::BadRequest(
                "Body text is required for standard templates.".to_owned(),
            ));
        }

        // Variables-at-edge check — matches TS L408-414.
        let trimmed_body = req.body.trim();
        if starts_with_var(trimmed_body) || ends_with_var(trimmed_body) {
            return Err(ApiError::BadRequest(
                "Variables cannot be at the beginning or end of the template body. \
                 Please add text before and after any variables."
                    .to_owned(),
            ));
        }

        let mut components: Vec<Value> = Vec::new();

        // Header (TS L416-436).
        if req.header_format != HeaderFormat::None {
            let mut header = json!({
                "type": "HEADER",
                "format": req.header_format.as_meta_str(),
            });
            match req.header_format {
                HeaderFormat::Text => {
                    let text = req
                        .header_text
                        .as_deref()
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .ok_or_else(|| {
                            ApiError::BadRequest(
                                "Header text is required for TEXT header format.".to_owned(),
                            )
                        })?;
                    header["text"] = json!(text);
                    if has_any_variable(text) {
                        let example = req.header_example.as_deref().ok_or_else(|| {
                            ApiError::BadRequest(
                                "Example for header variable is required.".to_owned(),
                            )
                        })?;
                        header["example"] = json!({ "header_text": [example] });
                    }
                }
                f if f.requires_media() => {
                    let media = req.header_media.as_ref().ok_or_else(|| {
                        ApiError::BadRequest(format!(
                            "A sample file or URL is required for {} headers.",
                            f.as_meta_str()
                        ))
                    })?;
                    let app_id = req.app_id.as_deref().ok_or_else(|| {
                        ApiError::BadRequest(
                            "App ID is not configured for this project, and no fallback is set in environment variables. \
                             Please set NEXT_PUBLIC_META_APP_ID in the .env file or re-configure the project."
                                .to_owned(),
                        )
                    })?;
                    let access_token = req
                        .header_media
                        .as_ref()
                        .map(|_| ()) // just to silence unused
                        .map(|_| project_token_for_create(_project))
                        .transpose()?
                        .unwrap_or("");
                    let handle = self
                        .upload_header_media(app_id, access_token, media)
                        .await?;
                    header["example"] = json!({ "header_handle": [handle] });
                }
                _ => {}
            }
            components.push(header);
        }

        // Body (TS L438-452).
        let mut body_component = json!({ "type": "BODY", "text": &req.body });
        let body_var_count = distinct_var_count(&req.body);
        if body_var_count > 0 {
            if req.body_examples.len() < body_var_count {
                return Err(ApiError::BadRequest(format!(
                    "An example value for body variable {{{{{}}}}} is required.",
                    body_var_count
                )));
            }
            body_component["example"] = json!({ "body_text": [req.body_examples.iter().take(body_var_count).collect::<Vec<_>>()] });
        }
        components.push(body_component);

        // Footer (TS L454).
        if let Some(footer) = &req.footer {
            let trimmed = footer.trim();
            if !trimmed.is_empty() {
                components.push(json!({ "type": "FOOTER", "text": trimmed }));
            }
        }

        // Buttons (TS L455-458).
        if !req.buttons.is_empty() {
            let buttons: Vec<Value> = req.buttons.iter().map(format_button).collect();
            components.push(json!({ "type": "BUTTONS", "buttons": buttons }));
        }

        let payload = json!({
            "name": req.name,
            "language": req.language,
            "category": category_to_meta(req.category),
            "allow_category_change": req.allow_category_change,
            "components": components,
        });

        Ok(payload)
    }

    async fn upload_header_media(
        &self,
        app_id: &str,
        access_token: &str,
        media: &HeaderMedia,
    ) -> Result<String> {
        let (bytes, mime, filename) = match media {
            HeaderMedia::Bytes {
                bytes,
                mime,
                filename,
            } => (bytes.clone(), mime.clone(), filename.clone()),
            HeaderMedia::Url(url) => {
                let resp = reqwest::get(url).await.map_err(|e| {
                    ApiError::BadRequest(format!("Failed to fetch media from URL: {e}"))
                })?;
                let mime = resp
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_owned();
                if mime.contains("text/html") || mime.contains("application/json") {
                    return Err(ApiError::BadRequest(format!(
                        "The provided URL returned {mime} instead of a valid media file. \
                         Please provide a direct link to the image or video."
                    )));
                }
                let bytes = resp
                    .bytes()
                    .await
                    .map_err(|e| ApiError::BadRequest(format!("Failed to read media body: {e}")))?;
                let filename = url.rsplit('/').next().unwrap_or("file").to_owned();
                (bytes, mime, filename)
            }
        };

        let handle = self
            .media
            .upload_for_template_header(app_id, access_token, bytes, &mime, &filename)
            .await
            .map_err(ApiError::from)?;

        Ok(handle.0)
    }

    #[allow(clippy::too_many_arguments)]
    async fn insert_template_doc(
        &self,
        project_id: ObjectId,
        name: &str,
        language: &str,
        category: TemplateCategory,
        status: TemplateStatus,
        meta_id: &str,
        components: &Value,
        body: Option<&str>,
    ) -> Result<Template> {
        let coll = self.mongo.collection::<bson::Document>("templates");

        let new_id = ObjectId::new();
        let bson_components =
            bson::to_bson(components).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        let now = bson::DateTime::from_chrono(Utc::now());

        let mut doc = doc! {
            "_id": new_id,
            "projectId": project_id,
            "name": name,
            "language": language,
            "category": category_to_meta(category),
            "status": meta_status_str(status),
            "metaId": meta_id,
            "components": bson_components,
            "qualityScore": "UNKNOWN",
            "createdAt": now,
        };
        if let Some(body) = body {
            doc.insert("body", body);
        }

        // Upsert on (projectId, name, language) so re-creates do not
        // duplicate. The TS handler uses `insertOne` unconditionally,
        // but unique-name-per-project is guaranteed by the cron job's
        // upsert pattern; we follow the safer path.
        coll.update_one(
            doc! {
                "projectId": project_id,
                "name": name,
                "language": language,
            },
            doc! { "$set": &doc },
        )
        .with_options(UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        // Re-read the row to return a fully-typed `Template`.
        let stored = coll
            .find_one(doc! {
                "projectId": project_id,
                "name": name,
                "language": language,
            })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "template {name}/{language} disappeared between upsert and read"
                ))
            })?;

        bson::from_document(stored).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))
    }
}

// =====================================================================
// project field accessors
// =====================================================================

fn project_waba_id(project: &Project) -> Result<&str> {
    project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Project has no WABA id configured.".to_owned()))
}

fn project_access_token(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Project has no Meta access token.".to_owned()))
}

// Used inside `build_create_payload` where we cannot borrow `self` and
// `project` simultaneously through the &mut header construction; the
// payload builder takes `_project` so we expose this helper here.
fn project_token_for_create(project: &Project) -> Result<&str> {
    project_access_token(project)
}

// `Project` doesn't `impl Clone` lightly without dragging owned fields;
// the type does derive Clone, so just call it. Helper kept for clarity
// at the call site.
fn clone_project(project: &Project) -> Project {
    project.clone()
}

// =====================================================================
// JSON helpers
// =====================================================================

fn category_to_meta(c: TemplateCategory) -> &'static str {
    match c {
        TemplateCategory::Marketing => "MARKETING",
        TemplateCategory::Utility => "UTILITY",
        TemplateCategory::Authentication => "AUTHENTICATION",
    }
}

fn meta_status_str(s: TemplateStatus) -> &'static str {
    match s {
        TemplateStatus::Approved => "APPROVED",
        TemplateStatus::Pending => "PENDING",
        TemplateStatus::Rejected => "REJECTED",
        TemplateStatus::Disabled => "DISABLED",
        TemplateStatus::Paused => "PAUSED",
    }
}

fn parse_status(v: Option<&Value>) -> TemplateStatus {
    match v.and_then(|v| v.as_str()) {
        Some("APPROVED") => TemplateStatus::Approved,
        Some("REJECTED") => TemplateStatus::Rejected,
        Some("DISABLED") => TemplateStatus::Disabled,
        Some("PAUSED") => TemplateStatus::Paused,
        // PENDING is the TS default at L490 / L712 when Meta doesn't
        // echo a status back.
        _ => TemplateStatus::Pending,
    }
}

/// Format a button into Meta's wire shape — matches TS L456.
fn format_button(b: &TemplateButton) -> Value {
    let mut out = serde_json::Map::new();
    out.insert("type".to_owned(), json!(b.button_type));
    out.insert("text".to_owned(), json!(b.text));
    if let Some(url) = &b.url
        && !url.is_empty()
    {
        out.insert("url".to_owned(), json!(url));
        if let Some(example) = &b.example {
            out.insert("example".to_owned(), json!(example));
        }
    }
    if let Some(phone) = &b.phone_number
        && !phone.is_empty()
    {
        out.insert("phone_number".to_owned(), json!(phone));
    }
    Value::Object(out)
}

/// Match `/^{{\s*\d+\s*}}/`.
fn starts_with_var(s: &str) -> bool {
    let s = s.trim_start();
    let mut bytes = s.as_bytes().iter();
    if !matches!(bytes.next(), Some(b'{')) {
        return false;
    }
    if !matches!(bytes.next(), Some(b'{')) {
        return false;
    }
    let rest = &s[2..];
    let inner = rest.trim_start();
    let digit_end = inner.bytes().take_while(|b| b.is_ascii_digit()).count();
    if digit_end == 0 {
        return false;
    }
    let after = &inner[digit_end..];
    let after = after.trim_start();
    after.starts_with("}}")
}

/// Match `/{{\s*\d+\s*}}$/`.
fn ends_with_var(s: &str) -> bool {
    let s = s.trim_end();
    if !s.ends_with("}}") {
        return false;
    }
    let head = &s[..s.len() - 2];
    let head = head.trim_end();
    let mut digit_count = 0;
    for b in head.bytes().rev() {
        if b.is_ascii_digit() {
            digit_count += 1;
        } else {
            break;
        }
    }
    if digit_count == 0 {
        return false;
    }
    let head = &head[..head.len() - digit_count];
    let head = head.trim_end();
    head.ends_with("{{")
}

fn has_any_variable(s: &str) -> bool {
    distinct_var_count(s) > 0
}

/// Extract distinct positional variable indices `{{N}}` in body order
/// (deduped). Mirrors the TS regex `/{{\s*(\d+)\s*}}/g` followed by
/// `[...new Set(...)].sort((a,b)=>a-b)` (TS L441).
fn distinct_var_count(s: &str) -> usize {
    let mut set: BTreeSet<u32> = BTreeSet::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            // skip {{
            let mut j = i + 2;
            // skip whitespace
            while j < bytes.len() && (bytes[j] as char).is_whitespace() {
                j += 1;
            }
            let digit_start = j;
            while j < bytes.len() && bytes[j].is_ascii_digit() {
                j += 1;
            }
            if j > digit_start {
                let num_str = &s[digit_start..j];
                if let Ok(n) = num_str.parse::<u32>() {
                    while j < bytes.len() && (bytes[j] as char).is_whitespace() {
                        j += 1;
                    }
                    if j + 1 < bytes.len() && bytes[j] == b'}' && bytes[j + 1] == b'}' {
                        set.insert(n);
                        i = j + 2;
                        continue;
                    }
                }
            }
        }
        i += 1;
    }
    set.len()
}

/// Lowercase + collapse whitespace runs to underscores. Matches TS
/// `templateName.toLowerCase().replace(/\s+/g, '_')` at L669.
fn normalize_flow_template_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut prev_underscore = false;
    let mut in_ws_run = false;
    for c in lower.chars() {
        if c.is_whitespace() {
            if !in_ws_run {
                out.push('_');
                in_ws_run = true;
                prev_underscore = true;
            }
        } else {
            in_ws_run = false;
            out.push(c);
            prev_underscore = false;
        }
    }
    let _ = prev_underscore;
    out
}

/// Percent-encode for query string values. We need this for the
/// delete-by-name path because `MetaClient::delete` takes a path that
/// is fed straight to `Url::join`.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod inline_tests {
    use super::*;

    #[test]
    fn distinct_vars_is_ordered_count_of_unique() {
        assert_eq!(distinct_var_count("hi {{1}} and {{2}} and {{1}}"), 2);
        assert_eq!(distinct_var_count("none"), 0);
        assert_eq!(distinct_var_count("{{ 3 }} {{ 1 }} {{ 2 }}"), 3);
    }

    #[test]
    fn flow_name_lowers_and_underscores() {
        assert_eq!(
            normalize_flow_template_name("Order Confirm"),
            "order_confirm"
        );
        assert_eq!(
            normalize_flow_template_name("  Hello\tWorld\n!"),
            "_hello_world_!"
        );
    }

    #[test]
    fn vars_at_start_or_end_detected() {
        assert!(starts_with_var("{{1}} hello"));
        assert!(starts_with_var("{{ 12 }} hello"));
        assert!(!starts_with_var("hi {{1}} hi"));
        assert!(ends_with_var("hello {{1}}"));
        assert!(ends_with_var("hello {{ 7 }}"));
        assert!(!ends_with_var("hi {{1}} hi"));
    }

    #[test]
    fn category_round_trips() {
        assert_eq!(category_to_meta(TemplateCategory::Marketing), "MARKETING");
        assert_eq!(category_to_meta(TemplateCategory::Utility), "UTILITY");
        assert_eq!(
            category_to_meta(TemplateCategory::Authentication),
            "AUTHENTICATION"
        );
    }

    #[test]
    fn url_encode_handles_spaces_and_specials() {
        assert_eq!(urlencode("hello world"), "hello%20world");
        assert_eq!(urlencode("a&b=c"), "a%26b%3Dc");
        assert_eq!(urlencode("safe-_.~"), "safe-_.~");
    }
}
