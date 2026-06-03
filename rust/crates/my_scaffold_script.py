import os
import shutil

crates = [
    {
        "name": "sabsense-analytics",
        "entity": "AnalyticsEvent",
        "collection": "sabsense_analytics_events",
        "mount": "/v1/sabsense/analytics",
        "description": "SabSense - Analytics Events CRUD.",
        "fields": [
            ("event_type", "String", "String", "pub event_type: String,", "pub event_type: String,"),
            ("url", "Option<String>", "Option<String>", "pub url: Option<String>,", "#[serde(default)]\npub url: Option<String>,")
        ],
        "default_field_values": "event_type: input.event_type,\nurl: input.url,",
        "update_field_values": "if let Some(v) = patch.event_type {\n        set.insert(\"eventType\", v);\n    }\n    if let Some(v) = patch.url {\n        set.insert(\"url\", v);\n    }"
    },
    {
        "name": "sabsense-fraud-detection",
        "entity": "FraudReport",
        "collection": "sabsense_fraud_reports",
        "mount": "/v1/sabsense/fraud-detection",
        "description": "SabSense - Fraud Detection Reports CRUD.",
        "fields": [
            ("ip_address", "String", "String", "pub ip_address: String,", "pub ip_address: String,"),
            ("risk_score", "i32", "Option<i32>", "pub risk_score: i32,", "#[serde(default)]\npub risk_score: Option<i32>,")
        ],
        "default_field_values": "ip_address: input.ip_address,\nrisk_score: input.risk_score.unwrap_or(0),",
        "update_field_values": "if let Some(v) = patch.ip_address {\n        set.insert(\"ipAddress\", v);\n    }\n    if let Some(v) = patch.risk_score {\n        set.insert(\"riskScore\", v);\n    }"
    },
    {
        "name": "sabsense-viewability",
        "entity": "ViewabilityRecord",
        "collection": "sabsense_viewability_records",
        "mount": "/v1/sabsense/viewability",
        "description": "SabSense - Viewability Records CRUD.",
        "fields": [
            ("element_id", "String", "String", "pub element_id: String,", "pub element_id: String,"),
            ("view_time_ms", "i32", "Option<i32>", "pub view_time_ms: i32,", "#[serde(default)]\npub view_time_ms: Option<i32>,")
        ],
        "default_field_values": "element_id: input.element_id,\nview_time_ms: input.view_time_ms.unwrap_or(0),",
        "update_field_values": "if let Some(v) = patch.element_id {\n        set.insert(\"elementId\", v);\n    }\n    if let Some(v) = patch.view_time_ms {\n        set.insert(\"viewTimeMs\", v);\n    }"
    },
    {
        "name": "sabsense-consent-mgmt",
        "entity": "ConsentRecord",
        "collection": "sabsense_consent_records",
        "mount": "/v1/sabsense/consent-mgmt",
        "description": "SabSense - Consent Management Records CRUD.",
        "fields": [
            ("consent_given", "bool", "Option<bool>", "pub consent_given: bool,", "#[serde(default)]\npub consent_given: Option<bool>,"),
            ("policy_version", "String", "String", "pub policy_version: String,", "pub policy_version: String,")
        ],
        "default_field_values": "consent_given: input.consent_given.unwrap_or(false),\npolicy_version: input.policy_version,",
        "update_field_values": "if let Some(v) = patch.consent_given {\n        set.insert(\"consentGiven\", v);\n    }\n    if let Some(v) = patch.policy_version {\n        set.insert(\"policyVersion\", v);\n    }"
    },
    {
        "name": "sabsense-brand-safety",
        "entity": "BrandSafetyReport",
        "collection": "sabsense_brand_safety_reports",
        "mount": "/v1/sabsense/brand-safety",
        "description": "SabSense - Brand Safety Reports CRUD.",
        "fields": [
            ("url", "String", "String", "pub url: String,", "pub url: String,"),
            ("safety_score", "i32", "Option<i32>", "pub safety_score: i32,", "#[serde(default)]\npub safety_score: Option<i32>,")
        ],
        "default_field_values": "url: input.url,\nsafety_score: input.safety_score.unwrap_or(0),",
        "update_field_values": "if let Some(v) = patch.url {\n        set.insert(\"url\", v);\n    }\n    if let Some(v) = patch.safety_score {\n        set.insert(\"safetyScore\", v);\n    }"
    }
]

cargo_toml_template = """[package]
name = "{name}"
version = "0.1.0"
edition = "2024"
description = "{description}"
license = "UNLICENSED"
publish = false

[lib]
name = "{lib_name}"
path = "src/lib.rs"

[dependencies]
serde = {{ version = "1", features = ["derive"] }}
serde_json = "1"
bson = {{ version = "2", features = ["chrono-0_4"] }}
chrono = {{ version = "0.4", default-features = false, features = ["clock", "serde"] }}
mongodb = "3.2"
futures = "0.3"
tokio = {{ version = "1", features = ["rt-multi-thread", "macros"] }}
axum = {{ version = "0.8", default-features = false, features = ["json", "http1", "query"] }}
tracing = "0.1"
anyhow = "1.0"

crm-common = {{ path = "../crm-common" }}
sabnode-auth = {{ path = "../auth" }}
sabnode-common = {{ path = "../common" }}
sabnode-db = {{ path = "../db" }}

[lints]
workspace = true
"""

lib_rs_template = """//! # {name}
//!
//! {description}
//! Mountable router. Mount under `{mount}`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
"""

router_rs_template = """//! Mountable router. Mount under `{mount}`.

use std::sync::Arc;

use axum::{{Router, extract::FromRef, routing::get}};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{{
    Router::new()
        .route("/", get(handlers::list_items).post(handlers::create_item))
        .route(
            "/:id",
            get(handlers::get_item)
                .patch(handlers::update_item)
                .delete(handlers::delete_item),
        )
}}
"""

types_rs_template = """//! On-disk shape of a `{collection}` document.

use bson::{{DateTime as BsonDateTime, oid::ObjectId}};
use serde::{{Deserialize, Serialize}};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct {entity} {{
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

{fields}

    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}}

fn default_status() -> String {{
    "active".to_owned()
}}
"""

dto_rs_template = """//! Request DTOs for {name}.

use serde::{{Deserialize, Serialize}};
use crate::types::{entity};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {{
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {{
{create_fields}
    #[serde(default)]
    pub status: Option<String>,
}}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {{
{update_fields}
    #[serde(default)]
    pub status: Option<String>,
}}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemResponse {{
    pub id: String,
    pub entity: {entity},
}}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemResponse {{
    pub deleted: bool,
}}
"""

handlers_rs_template = """//! HTTP handlers for {name}.

use axum::{{
    Json,
    extract::{{Path, Query, State}},
}};
use bson::{{DateTime as BsonDateTime, Document, doc, oid::ObjectId}};
use chrono::Utc;
use crm_common::{{
    pagination::{{clamp_limit, skip_for}},
    search::build_q_filter,
    tenant::user_oid,
}};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{{ApiError, Result}};
use sabnode_db::{{bson_helpers::oid_from_str, mongo::MongoHandle}};
use tracing::instrument;

use crate::dto::{{
    CreateItemInput, CreateItemResponse, DeleteItemResponse, ListQuery, UpdateItemInput,
}};
use crate::types::{entity};

const COLL: &str = "{collection}";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {{
    let mut filter = doc! {{ "userId": user_id }};
    match status {{
        Some("all") | None => {{}}
        Some(s) => {{
            filter.insert("status", s);
        }}
    }}
    filter
}}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {{
    doc! {{ "_id": oid, "userId": user_id }}
}}

fn entity_from_create(input: CreateItemInput, user_id: ObjectId) -> Result<{entity}> {{
    Ok({entity} {{
        id: None,
        user_id,
{default_field_values}
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }})
}}

fn build_update_doc(patch: UpdateItemInput) -> Document {{
    let mut set = doc! {{ "updatedAt": BsonDateTime::from_chrono(Utc::now()) }};
{update_field_values}
    if let Some(v) = patch.status {{
        set.insert("status", v);
    }}
    doc! {{ "$set": set }}
}}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {{
    pub items: Vec<{entity}>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_items(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {{
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! {{ "createdAt": -1 }})
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<{entity}>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("{collection}.find")))?;
    let mut rows: Vec<{entity}> = cursor
        .try_collect()
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.collect"))
        }})?;
    let has_more = rows.len() as i64 > limit;
    if has_more {{
        rows.truncate(limit as usize);
    }}
    Ok(Json(ListResponse {{
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }}))
}}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<{entity}>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<{entity}>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.find_one"))
        }})?
        .ok_or_else(|| ApiError::NotFound("{collection}".to_owned()))?;
    Ok(Json(row))
}}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateItemInput>,
) -> Result<Json<CreateItemResponse>> {{
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<{entity}>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.insert"))
        }})?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateItemResponse {{
        id: new_id.to_hex(),
        entity,
    }}))
}}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateItemInput>,
) -> Result<Json<{entity}>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<{entity}>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.update"))
        }})?;
    if result.matched_count == 0 {{
        return Err(ApiError::NotFound("{collection}".to_owned()));
    }}
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.refetch"))
        }})?
        .ok_or_else(|| ApiError::NotFound("{collection}".to_owned()))?;
    Ok(Json(after))
}}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_item(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteItemResponse>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<{entity}>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {{ "$set": {{
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }}}},
        )
        .await
        .map_err(|e| {{
            ApiError::Internal(anyhow::Error::new(e).context("{collection}.archive"))
        }})?;
    Ok(Json(DeleteItemResponse {{
        deleted: result.matched_count > 0,
    }}))
}}
"""

base_dir = "/Users/harshkhandelwal/Downloads/sabnode/rust/crates"

for c in crates:
    crate_dir = os.path.join(base_dir, c["name"])
    src_dir = os.path.join(crate_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    lib_name = c["name"].replace("-", "_")

    cargo_content = cargo_toml_template.format(
        name=c["name"],
        description=c["description"],
        lib_name=lib_name
    )
    with open(os.path.join(crate_dir, "Cargo.toml"), "w") as f:
        f.write(cargo_content)

    lib_content = lib_rs_template.format(
        name=c["name"],
        description=c["description"],
        mount=c["mount"]
    )
    with open(os.path.join(src_dir, "lib.rs"), "w") as f:
        f.write(lib_content)

    router_content = router_rs_template.format(mount=c["mount"])
    with open(os.path.join(src_dir, "router.rs"), "w") as f:
        f.write(router_content)

    fields_str = "\n".join([f"    {field[3]}" for field in c["fields"]])
    types_content = types_rs_template.format(
        collection=c["collection"],
        entity=c["entity"],
        fields=fields_str
    )
    with open(os.path.join(src_dir, "types.rs"), "w") as f:
        f.write(types_content)

    create_fields_str = "\n".join([f"    {field[4]}" for field in c["fields"]])
    update_fields_str = "\n".join([f"    #[serde(default)]\n    pub {field[0]}: Option<{field[1].replace('Option<', '').replace('>', '')}>," for field in c["fields"]])
    
    dto_content = dto_rs_template.format(
        name=c["name"],
        entity=c["entity"],
        create_fields=create_fields_str,
        update_fields=update_fields_str
    )
    with open(os.path.join(src_dir, "dto.rs"), "w") as f:
        f.write(dto_content)

    handlers_content = handlers_rs_template.format(
        name=c["name"],
        entity=c["entity"],
        collection=c["collection"],
        default_field_values="        " + c["default_field_values"].replace("\n", "\n        "),
        update_field_values="    " + c["update_field_values"].replace("\n", "\n    ")
    )
    with open(os.path.join(src_dir, "handlers.rs"), "w") as f:
        f.write(handlers_content)

print("Scaffolded exactly 5 crates!!")
