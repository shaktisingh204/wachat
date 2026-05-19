//! Multipart entrypoint for the QR-code Server Action.

use axum::{Json, extract::{Multipart, State}};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::Value;
use std::collections::HashMap;

use crate::{
    state::QrCodesState,
    store::{self, CreateBody, CreateResult},
};

async fn collect(mut mp: Multipart) -> Result<HashMap<String, String>> {
    let mut out = HashMap::new();
    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        if name.is_empty() {
            continue;
        }
        let value = field
            .text()
            .await
            .map_err(|e| ApiError::BadRequest(format!("field '{name}': {e}")))?;
        out.insert(name, value);
    }
    Ok(out)
}

pub async fn create_qr_code(
    user: AuthUser,
    State(s): State<QrCodesState>,
    multipart: Multipart,
) -> Result<Json<CreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let fields = collect(multipart).await?;

    let name = fields.get("name").cloned().unwrap_or_default();
    let data_type = fields.get("dataType").cloned().unwrap_or_default();
    let data_raw = fields.get("data").cloned().unwrap_or_default();
    let config_raw = fields.get("config").cloned().unwrap_or_default();
    let data: Value = serde_json::from_str(&data_raw).unwrap_or(Value::Null);
    let config: Value = serde_json::from_str(&config_raw).unwrap_or(Value::Null);
    let tag_ids: Vec<String> = fields
        .get("tagIds")
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    let is_dynamic = fields.get("isDynamic").map(|s| s == "on").unwrap_or(false);

    let body = CreateBody {
        name,
        data_type,
        data,
        config,
        tag_ids,
        is_dynamic,
        style: None,
        frame: None,
        logo_data_uri: None,
    };
    Ok(Json(store::create(&s.mongo, oid, body).await?))
}
