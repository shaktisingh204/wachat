import os

base_dir = "/Users/harshkhandelwal/Downloads/sabnode/rust/crates"

targets = [
    {
        "folder": "sabsense-bidding",
        "package": "sabsense-bidding",
        "lib": "sabsense_bidding",
        "collection": "sabsense_bidding",
        "type": "SabsenseBidding",
        "single": "bidding",
        "plural": "biddings",
        "Single": "Bidding",
        "Plural": "Biddings"
    },
    {
        "folder": "sabsense-direct-deals",
        "package": "sabsense-direct-deals",
        "lib": "sabsense_direct_deals",
        "collection": "sabsense_direct_deals",
        "type": "SabsenseDirectDeal",
        "single": "direct_deal",
        "plural": "direct_deals",
        "Single": "DirectDeal",
        "Plural": "DirectDeals"
    },
    {
        "folder": "sabsense-floor-pricing",
        "package": "sabsense-floor-pricing",
        "lib": "sabsense_floor_pricing",
        "collection": "sabsense_floor_pricing",
        "type": "SabsenseFloorPricing",
        "single": "floor_pricing",
        "plural": "floor_pricings",
        "Single": "FloorPricing",
        "Plural": "FloorPricings"
    },
    {
        "folder": "sabsense-yield-mgmt",
        "package": "sabsense-yield-mgmt",
        "lib": "sabsense_yield_mgmt",
        "collection": "sabsense_yield_mgmts",
        "type": "SabsenseYieldMgmt",
        "single": "yield_mgmt",
        "plural": "yield_mgmts",
        "Single": "YieldMgmt",
        "Plural": "YieldMgmts"
    },
    {
        "folder": "sabsense-native-ads",
        "package": "sabsense-native-ads",
        "lib": "sabsense_native_ads",
        "collection": "sabsense_native_ads",
        "type": "SabsenseNativeAd",
        "single": "native_ad",
        "plural": "native_ads",
        "Single": "NativeAd",
        "Plural": "NativeAds"
    }
]

cargo_toml_tpl = """[package]
name = "{package}"
version = "0.1.0"
edition = "2024"
description = "SabSense — {single} CRUD."
license = "UNLICENSED"
publish = false

[lib]
name = "{lib}"
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

lib_rs_tpl = """//! # {package}
//!
//! HTTP surface for SabSense {Plural}.
//! Backs the `{collection}` Mongo collection. Mounted under
//! `/v1/sabsense/{plural}`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
"""

router_rs_tpl = """//! Mountable router. Mount under `/v1/sabsense/{plural}`.

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
        .route("/", get(handlers::list_{plural}).post(handlers::create_{single}))
        .route(
            "/{{{single}Id}}",
            get(handlers::get_{single})
                .patch(handlers::update_{single})
                .delete(handlers::delete_{single}),
        )
}}
"""

types_rs_tpl = """//! On-disk shape of a `{collection}` document.

use bson::{{DateTime as BsonDateTime, oid::ObjectId}};
use serde::{{Deserialize, Serialize}};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct {type} {{
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// `"draft"` | `"active"` | `"archived"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}}

fn default_status() -> String {{
    "draft".to_owned()
}}
"""

dto_rs_tpl = """//! Request DTOs for {package}.

use serde::{{Deserialize, Serialize}};
use crate::types::{type};

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
pub struct Create{Single}Input {{
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Update{Single}Input {{
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Create{Single}Response {{
    pub id: String,
    pub entity: {type},
}}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Delete{Single}Response {{
    pub deleted: bool,
}}
"""

handlers_rs_tpl = """//! HTTP handlers for SabSense {Plural}.

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
    Create{Single}Input, Create{Single}Response, Delete{Single}Response, ListQuery, Update{Single}Input,
}};
use crate::types::{type};

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

fn {single}_from_create(input: Create{Single}Input, user_id: ObjectId) -> Result<{type}> {{
    if input.name.trim().is_empty() {{
        return Err(ApiError::Validation("name is required".to_owned()));
    }}
    
    Ok({type} {{
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }})
}}

fn build_update_doc(patch: Update{Single}Input) -> Document {{
    let mut set = doc! {{ "updatedAt": BsonDateTime::from_chrono(Utc::now()) }};
    if let Some(v) = patch.name {{
        set.insert("name", v);
    }}
    if let Some(v) = patch.description {{
        set.insert("description", v);
    }}
    if let Some(v) = patch.status {{
        set.insert("status", v);
    }}
    doc! {{ "$set": set }}
}}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {{
    pub items: Vec<{type}>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_{plural}(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {{
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {{
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {{
            filter.insert("$or", arr.clone());
        }}
    }}
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! {{ "createdAt": -1 }})
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<{type}>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("{collection}.find")))?;
    let mut rows: Vec<{type}> = cursor
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

#[instrument(skip_all, fields(user_id = %user.user_id, {single}_id = %{single}_id))]
pub async fn get_{single}(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path({single}_id): Path<String>,
) -> Result<Json<{type}>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&{single}_id)?;
    let coll = mongo.collection::<{type}>(COLL);
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
pub async fn create_{single}(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<Create{Single}Input>,
) -> Result<Json<Create{Single}Response>> {{
    let user_id = user_oid(&user)?;
    let mut entity = {single}_from_create(input, user_id)?;
    let coll = mongo.collection::<{type}>(COLL);
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
    Ok(Json(Create{Single}Response {{
        id: new_id.to_hex(),
        entity,
    }}))
}}

#[instrument(skip_all, fields(user_id = %user.user_id, {single}_id = %{single}_id))]
pub async fn update_{single}(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path({single}_id): Path<String>,
    Json(patch): Json<Update{Single}Input>,
) -> Result<Json<{type}>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&{single}_id)?;
    let coll = mongo.collection::<{type}>(COLL);
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

#[instrument(skip_all, fields(user_id = %user.user_id, {single}_id = %{single}_id))]
pub async fn delete_{single}(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path({single}_id): Path<String>,
) -> Result<Json<Delete{Single}Response>> {{
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&{single}_id)?;
    let coll = mongo.collection::<{type}>(COLL);
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
    Ok(Json(Delete{Single}Response {{
        deleted: result.matched_count > 0,
    }}))
}}
"""

for t in targets:
    crate_dir = os.path.join(base_dir, t["folder"])
    src_dir = os.path.join(crate_dir, "src")
    os.makedirs(src_dir, exist_ok=True)
    
    with open(os.path.join(crate_dir, "Cargo.toml"), "w") as f:
        f.write(cargo_toml_tpl.format(**t))
        
    with open(os.path.join(src_dir, "lib.rs"), "w") as f:
        f.write(lib_rs_tpl.format(**t))
        
    with open(os.path.join(src_dir, "router.rs"), "w") as f:
        f.write(router_rs_tpl.format(**t))
        
    with open(os.path.join(src_dir, "types.rs"), "w") as f:
        f.write(types_rs_tpl.format(**t))
        
    with open(os.path.join(src_dir, "dto.rs"), "w") as f:
        f.write(dto_rs_tpl.format(**t))
        
    with open(os.path.join(src_dir, "handlers.rs"), "w") as f:
        f.write(handlers_rs_tpl.format(**t))

print("Scaffolding complete.")
