//! Product-catalog operations against Meta's Graph API.
//!
//! Mirrors the legacy server actions in `catalog.actions.ts`
//! (originally re-exported via `meta-suite.actions.ts`):
//!   * `getCatalogs` — list owned product catalogs for the project's
//!     business.
//!   * `getProductsForCatalog` — paginated product fetch (50) with
//!     optional client-side `search_term` filter on `name` /
//!     `retailer_id`.
//!   * `addProductToCatalog` — POST a single product (price scaled to
//!     cents, defaults applied).
//!   * `deleteProductFromCatalog` — DELETE by product (Meta) id.
//!   * `syncCatalogs` — verify Meta-side catalogs are reachable.
//!   * `updateProductInCatalog` — PATCH-style POST of partial fields on
//!     an existing product node (price scaled to cents when present).
//!   * `listProductSets` — list product sets under a catalog.
//!   * `createProductSet` — POST a new product set with a Meta filter.
//!   * `deleteProductSet` — DELETE a product set by id.
//!   * `getTaggedMediaForProduct` — list IG/FB tagged media for a
//!     product node.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use wachat_meta_client::MetaClient;
use wachat_types::Project;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub product_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    #[serde(default)]
    pub retailer_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub image_url: String,
    #[serde(default)]
    pub price: String,
    #[serde(default)]
    pub currency: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CatalogList {
    pub catalogs: Vec<Catalog>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductList {
    pub products: Vec<Product>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddProductBody {
    pub retailer_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    /// Display-currency major units (e.g. "100" => 100 USD).
    /// Scaled by 100 to cents before posting to Meta.
    #[serde(default)]
    pub price: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AckMessage {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteAck {
    pub success: bool,
}

fn token_for(project: &Project) -> Result<&str> {
    project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))
}

/// Fetch the project's `businessId` (preferring the column, falling back
/// to a Meta lookup against the WABA). Mirrors the legacy fallback path.
async fn resolve_business_id(meta: &MetaClient, project: &Project) -> Result<String> {
    if let Some(b) = project.business_id.as_deref() {
        return Ok(b.to_owned());
    }
    let waba = project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))?;
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct Resp {
        business: Option<BusinessRef>,
    }
    #[derive(Deserialize)]
    struct BusinessRef {
        id: String,
    }
    let path = format!("{waba}?fields=business");
    let resp: Resp = meta.get_json(&path, token).await?;
    resp.business.map(|b| b.id).ok_or_else(|| {
        ApiError::BadRequest(
            "Business ID not found for this project. Please ensure your WABA is linked to a Business Manager.".to_owned(),
        )
    })
}

pub async fn list_catalogs(meta: &MetaClient, project: &Project) -> Result<CatalogList> {
    let business_id = resolve_business_id(meta, project).await?;
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct Resp {
        #[serde(default)]
        data: Vec<Catalog>,
    }
    let path = format!("{business_id}/owned_product_catalogs");
    let resp: Resp = meta.get_json(&path, token).await?;
    Ok(CatalogList {
        catalogs: resp.data,
    })
}

pub async fn list_products(
    meta: &MetaClient,
    project: &Project,
    catalog_id: &str,
    search_term: Option<&str>,
) -> Result<ProductList> {
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct Resp {
        #[serde(default)]
        data: Vec<Product>,
    }
    let path = format!(
        "{catalog_id}/products?fields=id,retailer_id,name,image_url,price,currency&limit=50"
    );
    let resp: Resp = meta.get_json(&path, token).await?;
    let mut products = resp.data;

    if let Some(term) = search_term {
        let lower = term.to_lowercase();
        if !lower.is_empty() {
            products.retain(|p| {
                p.name.to_lowercase().contains(&lower)
                    || p.retailer_id.to_lowercase().contains(&lower)
            });
        }
    }

    Ok(ProductList { products })
}

pub async fn add_product(
    meta: &MetaClient,
    project: &Project,
    catalog_id: &str,
    body: AddProductBody,
) -> Result<AckMessage> {
    let token = token_for(project)?;

    let price_cents: i64 = body
        .price
        .as_deref()
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(100)
        .saturating_mul(100);

    let payload = json!({
        "retailer_id": body.retailer_id,
        "name": body.name.clone(),
        "description": body.description.unwrap_or_else(|| body.name.clone()),
        "url": body.url.unwrap_or_else(|| "https://example.com".to_owned()),
        "image_url": body.image_url.unwrap_or_default(),
        "price": price_cents,
        "currency": body.currency.unwrap_or_else(|| "USD".to_owned()),
        "availability": "in stock",
        "condition": "new",
    });

    let path = format!("{catalog_id}/products");
    let _: Value = meta.post_json(&path, token, &payload).await?;
    Ok(AckMessage {
        success: true,
        message: "Product added successfully".to_owned(),
    })
}

pub async fn delete_product(
    meta: &MetaClient,
    project: &Project,
    product_id: &str,
) -> Result<DeleteAck> {
    let token = token_for(project)?;
    meta.delete(product_id, token).await?;
    Ok(DeleteAck { success: true })
}

/// Verifies Meta-side catalogs can be fetched. Mirrors the legacy
/// `syncCatalogs` which simply re-runs `getCatalogs` and reports success.
/// Returning a database write hook is left for a future caller.
pub async fn sync_catalogs(meta: &MetaClient, project: &Project) -> Result<AckMessage> {
    let _ = list_catalogs(meta, project).await?;
    Ok(AckMessage {
        success: true,
        message: "Catalogs synced successfully".to_owned(),
    })
}

/// Partial update of a Meta product node. All body fields are optional;
/// at least one must be present (mirrors the legacy
/// `updateProductInCatalog` which errored on an empty payload).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    /// Display-currency major units (string, scaled by 100 to cents).
    #[serde(default)]
    pub price: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub availability: Option<String>,
    #[serde(default)]
    pub condition: Option<String>,
}

pub async fn update_product(
    meta: &MetaClient,
    project: &Project,
    product_id: &str,
    body: UpdateProductBody,
) -> Result<AckMessage> {
    let token = token_for(project)?;

    let mut payload = serde_json::Map::new();
    if let Some(v) = body.name {
        payload.insert("name".to_owned(), Value::String(v));
    }
    if let Some(v) = body.description {
        payload.insert("description".to_owned(), Value::String(v));
    }
    if let Some(v) = body.url {
        payload.insert("url".to_owned(), Value::String(v));
    }
    if let Some(v) = body.image_url {
        payload.insert("image_url".to_owned(), Value::String(v));
    }
    if let Some(v) = body.price.as_deref() {
        if let Ok(major) = v.parse::<i64>() {
            payload.insert("price".to_owned(), Value::from(major.saturating_mul(100)));
        }
    }
    if let Some(v) = body.currency {
        payload.insert("currency".to_owned(), Value::String(v));
    }
    if let Some(v) = body.availability {
        payload.insert("availability".to_owned(), Value::String(v));
    }
    if let Some(v) = body.condition {
        payload.insert("condition".to_owned(), Value::String(v));
    }

    if payload.is_empty() {
        return Err(ApiError::BadRequest("No fields to update".to_owned()));
    }

    let body_value = Value::Object(payload);
    let _: Value = meta.post_json(product_id, token, &body_value).await?;
    Ok(AckMessage {
        success: true,
        message: "Product updated successfully".to_owned(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSet {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductSetList {
    pub product_sets: Vec<ProductSet>,
}

pub async fn list_product_sets(
    meta: &MetaClient,
    project: &Project,
    catalog_id: &str,
) -> Result<ProductSetList> {
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct Resp {
        #[serde(default)]
        data: Vec<ProductSet>,
    }
    let path = format!("{catalog_id}/product_sets");
    let resp: Resp = meta.get_json(&path, token).await?;
    Ok(ProductSetList {
        product_sets: resp.data,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductSetBody {
    pub name: String,
    /// Raw Meta filter string. Defaults to a permissive filter when
    /// omitted, matching the legacy form-data behavior.
    #[serde(default)]
    pub filter: Option<String>,
}

pub async fn create_product_set(
    meta: &MetaClient,
    project: &Project,
    catalog_id: &str,
    body: CreateProductSetBody,
) -> Result<AckMessage> {
    let token = token_for(project)?;

    let filter = body
        .filter
        .unwrap_or_else(|| "{\"retailer_id\":{\"i_contains\":\"\"}}".to_owned());

    let payload = json!({
        "name": body.name,
        "filter": filter,
    });

    let path = format!("{catalog_id}/product_sets");
    let _: Value = meta.post_json(&path, token, &payload).await?;
    Ok(AckMessage {
        success: true,
        message: "Product set created".to_owned(),
    })
}

pub async fn delete_product_set(
    meta: &MetaClient,
    project: &Project,
    product_set_id: &str,
) -> Result<DeleteAck> {
    let token = token_for(project)?;
    meta.delete(product_set_id, token).await?;
    Ok(DeleteAck { success: true })
}

#[derive(Debug, Clone, Serialize)]
pub struct TaggedMediaList {
    pub media: Vec<Value>,
}

pub async fn get_tagged_media(
    meta: &MetaClient,
    project: &Project,
    product_id: &str,
) -> Result<TaggedMediaList> {
    let token = token_for(project)?;

    #[derive(Deserialize)]
    struct Resp {
        #[serde(default)]
        data: Vec<Value>,
    }
    let path = format!("{product_id}/tagged_media");
    let resp: Resp = meta.get_json(&path, token).await?;
    Ok(TaggedMediaList { media: resp.data })
}
