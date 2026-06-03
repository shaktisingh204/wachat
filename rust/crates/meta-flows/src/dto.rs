//! DTOs for the Meta Flows router.
//!
//! Wire format is camelCase (the Rust BFF convention). Field names mirror
//! the TS `meta-flow.actions.ts` action inputs and the local `MetaFlow`
//! Mongo document. Wherever Meta returns a value verbatim (e.g.
//! `validation_errors`, `health_status`, `preview`) we keep snake_case
//! inside the JSON object so the wire shape matches Meta exactly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One entry in `validation_errors`. Mirrors `MetaFlowValidationError` in
/// `src/lib/definitions.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationError {
    pub error: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_type: Option<String>,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_start: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_end: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_start: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_end: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pointers: Option<Vec<String>>,
}

/// Stored `meta_flows` document.
///
/// `flow_data` is opaque JSON the UI maintains — we never introspect it on
/// the read path; on write we accept it verbatim from the caller (the
/// caller has already run `cleanMetaFlowData` on the TS side).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaFlowDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    pub project_id: ObjectId,
    pub meta_id: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub json_version: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub flow_data: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint_uri: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation_errors: Option<Vec<ValidationError>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health_status: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub application_id: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_published_at: Option<DateTime<Utc>>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

// -----------------------------------------------------------------------
// Outgoing JSON shapes — these mirror the TS `MetaFlow` browser shape so
// existing UI components continue to render unchanged.
// -----------------------------------------------------------------------

/// Browser-facing flow record. Matches `WithId<MetaFlow>` in TS:
/// `_id` is a hex string, dates are ISO-8601 strings, ObjectId references
/// (e.g. `projectId`) are flattened to hex.
#[derive(Debug, Clone, Serialize)]
pub struct MetaFlowOut {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "metaId")]
    pub meta_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub json_version: Option<String>,
    pub categories: Vec<String>,
    pub flow_data: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint_uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_errors: Option<Vec<ValidationError>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_status: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application_id: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "lastPublishedAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_published_at: Option<DateTime<Utc>>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
}

impl From<MetaFlowDoc> for MetaFlowOut {
    fn from(d: MetaFlowDoc) -> Self {
        Self {
            id: d.id.to_hex(),
            name: d.name,
            project_id: d.project_id.to_hex(),
            meta_id: d.meta_id,
            status: d.status,
            json_version: d.json_version,
            categories: d.categories,
            flow_data: d.flow_data,
            endpoint_uri: d.endpoint_uri,
            validation_errors: d.validation_errors,
            health_status: d.health_status,
            preview: d.preview,
            application_id: d.application_id,
            last_published_at: d.last_published_at,
            created_at: d.created_at,
            updated_at: d.updated_at,
        }
    }
}

// -----------------------------------------------------------------------
// Action result envelope (mirrors TS `ActionResult<T>` shape).
// -----------------------------------------------------------------------

/// Generic action-result envelope.
///
/// `success: false` cases set `error`; success cases set `message` and may
/// echo `validation_errors` from Meta even on success (Meta returns them
/// inline on `/flows` and `/assets` POSTs).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult<T: Serialize = ()> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_errors: Option<Vec<ValidationError>>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

// We can't derive Default because Default for the generic flat-data
// option requires `T: Default`, which is overly restrictive — `()` and
// `PreviewOut` happen to need it but `CreateFlowOut` does not. Provide a
// custom impl that builds the "empty" envelope with `data = None`.
impl<T: Serialize> Default for ActionResult<T> {
    fn default() -> Self {
        Self {
            success: false,
            message: None,
            error: None,
            validation_errors: None,
            data: None,
        }
    }
}

impl<T: Serialize> ActionResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            ..Default::default()
        }
    }
    pub fn ok_msg(data: T, msg: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(msg.into()),
            data: Some(data),
            ..Default::default()
        }
    }
}

impl ActionResult<()> {
    pub fn just_msg(msg: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(msg.into()),
            ..Default::default()
        }
    }
    pub fn fail(err: impl Into<String>) -> Self {
        Self {
            success: false,
            error: Some(err.into()),
            ..Default::default()
        }
    }
    pub fn fail_with_validation(err: impl Into<String>, ve: Vec<ValidationError>) -> Self {
        Self {
            success: false,
            error: Some(err.into()),
            validation_errors: Some(ve),
            ..Default::default()
        }
    }
}

// -----------------------------------------------------------------------
// Request bodies
// -----------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFlowReq {
    pub name: String,
    pub categories: Vec<String>,
    #[serde(default)]
    pub flow_data: Option<Value>,
    #[serde(default)]
    pub endpoint_uri: Option<String>,
    #[serde(default)]
    pub clone_flow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFlowOut {
    pub flow_id: String,
    pub meta_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDraftReq {
    pub flow_data: Value,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadataReq {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub categories: Option<Vec<String>>,
    /// `Some(Some(...))` = set, `Some(None)` = clear (TS sends `null`),
    /// `None` = leave untouched.
    #[serde(default, deserialize_with = "double_option_str")]
    pub endpoint_uri: Option<Option<String>>,
    #[serde(default)]
    pub application_id: Option<String>,
}

fn double_option_str<'de, D>(de: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<Option<String>>::deserialize(de)
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewReq {
    #[serde(default)]
    pub invalidate: Option<bool>,
    #[serde(default)]
    pub flow_token: Option<String>,
    #[serde(default)]
    pub flow_action: Option<String>,
    #[serde(default)]
    pub flow_action_payload: Option<Value>,
    #[serde(default)]
    pub phone_number: Option<String>,
    #[serde(default)]
    pub interactive: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewOut {
    pub preview_url: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutcome {
    pub count: usize,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuery {
    /// Optional override — matches the TS `deleteMetaFlow(flowId, metaId?)`
    /// signature where the caller can supply a stale Meta id to clean up
    /// orphaned remote rows. Defaults to the stored `metaId`.
    #[serde(default)]
    pub meta_id: Option<String>,
}
