//! WhatsApp widget settings persistence.
//!
//! Ports `saveWidgetSettings` from `src/app/actions/widget.actions.ts` —
//! a single Mongo `updateOne` that writes the widget configuration object
//! onto the project document under `widgetSettings`.

use bson::{Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

const PROJECTS_COLL: &str = "projects";

/// Body for `POST /v1/wachat/config/projects/:id/widget-settings`.
///
/// Mirrors `WhatsAppWidgetSettings` from `src/lib/definitions.ts`. All
/// fields are required because the legacy server action read them all
/// out of `FormData` unconditionally — the call site is the widget
/// generator form, which always submits the full set.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSettings {
    pub phone_number: String,
    pub prefilled_message: String,
    pub position: String,
    pub button_color: String,
    pub header_title: String,
    pub header_subtitle: String,
    pub header_avatar_url: String,
    pub welcome_message: String,
    pub cta_text: String,
    pub border_radius: i32,
    pub padding: i32,
    pub text_color: String,
    pub button_text_color: String,
}

pub async fn save(
    mongo: &MongoHandle,
    project_id: &ObjectId,
    settings: &WidgetSettings,
) -> Result<()> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let bson_settings =
        bson::to_bson(settings).map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    coll.update_one(
        doc! { "_id": project_id },
        doc! { "$set": { "widgetSettings": bson_settings } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(())
}
