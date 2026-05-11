//! Shopify node.
//!
//! Implements product, order, customer, inventory, and collection operations
//! against the Shopify Admin REST API (2024-07).  Authenticates with the
//! `shopifyApi` credential which carries the `shopDomain` (e.g.
//! `my-store.myshopify.com`) and `accessToken` (an Admin API access token).

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ShopifyNode;

const SHOPIFY_API_VERSION: &str = "2024-07";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ShopifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "shopify",
            "Shopify",
            "Shopify e-commerce — products, orders, customers, inventory, collections",
            NodeCategory::Finance,
        )
        .icon("shopping-bag")
        .color("#96BF47")
        .credentials(vec![CredentialBinding {
            name: "shopifyApi".into(),
            display_name: "Shopify Admin API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Product", "product"),
                    opt("Order", "order"),
                    opt("Customer", "customer"),
                    opt("Inventory", "inventory"),
                    opt("Collection", "collection"),
                ])
                .default(json!("product"))
                .required(),
            // ----- per-resource operation pickers -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("create"))
                .show_when("resource", &["product", "customer"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Update", "update"),
                    opt("Cancel", "cancel"),
                    opt("Close", "close"),
                ])
                .default(json!("create"))
                .show_when("resource", &["order"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get Level", "getLevel"),
                    opt("Adjust Level", "adjustLevel"),
                ])
                .default(json!("getLevel"))
                .show_when("resource", &["inventory"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get"), opt("List", "list")])
                .default(json!("list"))
                .show_when("resource", &["collection"])
                .required(),
            // ----- product fields -----
            NodeProperty::new("productId", "Product ID", NodePropertyType::String)
                .show_when("resource", &["product"])
                .show_when("operation", &["get", "update", "delete"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("resource", &["product"])
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("bodyHtml", "Body HTML", NodePropertyType::String)
                .show_when("resource", &["product"])
                .show_when("operation", &["create", "update"])
                .description("Product description in HTML"),
            NodeProperty::new("vendor", "Vendor", NodePropertyType::String)
                .show_when("resource", &["product"])
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("variants", "Variants (JSON array)", NodePropertyType::Json)
                .show_when("resource", &["product"])
                .show_when("operation", &["create", "update"])
                .description("Optional JSON array of variants, e.g. [{\"price\":\"19.99\"}]"),
            // ----- order fields -----
            NodeProperty::new("orderId", "Order ID", NodePropertyType::String)
                .show_when("resource", &["order"])
                .show_when("operation", &["get", "update", "cancel", "close"]),
            NodeProperty::new("orderFields", "Order Fields (JSON)", NodePropertyType::Json)
                .show_when("resource", &["order"])
                .show_when("operation", &["create", "update"])
                .description(
                    "Raw fields merged into the `order` body (line_items, email, etc.)",
                ),
            // ----- customer fields -----
            NodeProperty::new("customerId", "Customer ID", NodePropertyType::String)
                .show_when("resource", &["customer"])
                .show_when("operation", &["get", "update", "delete"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .show_when("resource", &["customer"])
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("resource", &["customer"])
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("lastName", "Last Name", NodePropertyType::String)
                .show_when("resource", &["customer"])
                .show_when("operation", &["create", "update"]),
            // ----- inventory fields -----
            NodeProperty::new(
                "inventoryItemId",
                "Inventory Item ID",
                NodePropertyType::String,
            )
            .show_when("resource", &["inventory"])
            .show_when("operation", &["getLevel", "adjustLevel"])
            .required(),
            NodeProperty::new("locationId", "Location ID", NodePropertyType::String)
                .show_when("resource", &["inventory"])
                .show_when("operation", &["getLevel", "adjustLevel"])
                .required(),
            NodeProperty::new(
                "availableAdjustment",
                "Available Adjustment",
                NodePropertyType::Number,
            )
            .show_when("resource", &["inventory"])
            .show_when("operation", &["adjustLevel"])
            .description("Positive or negative integer to adjust on-hand quantity"),
            // ----- collection fields -----
            NodeProperty::new("collectionId", "Collection ID", NodePropertyType::String)
                .show_when("resource", &["collection"])
                .show_when("operation", &["get"]),
            // ----- shared list controls -----
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["list"])
                .description("Max results per page (Shopify max 250)"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let shop_domain = cred
            .data
            .get("shopDomain")
            .ok_or_else(|| NodeError::MissingParameter("shopDomain".into()))?
            .trim()
            .trim_end_matches('/')
            .to_string();
        let access_token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        if shop_domain.is_empty() {
            return Err(NodeError::MissingParameter("shopDomain".into()));
        }

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "product".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- product -----
            ("product", "create") => {
                let mut product = Map::new();
                insert_opt_str(ctx, params, "title", &mut product, "title");
                insert_opt_str(ctx, params, "bodyHtml", &mut product, "body_html");
                insert_opt_str(ctx, params, "vendor", &mut product, "vendor");
                if let Some(v) = json_param(ctx, params, "variants") {
                    product.insert("variants".to_string(), v);
                }
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/products.json",
                    json!({ "product": Value::Object(product) }),
                )
                .await?
            }
            ("product", "get") => {
                let id = ctx.param_str(params, "productId")?;
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/products/{id}.json"),
                    &[],
                )
                .await?
            }
            ("product", "list") => {
                let limit = limit_value(ctx, params);
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/products.json",
                    &[("limit", limit.as_str())],
                )
                .await?
            }
            ("product", "update") => {
                let id = ctx.param_str(params, "productId")?;
                let mut product = Map::new();
                product.insert("id".to_string(), parse_id(&id));
                insert_opt_str(ctx, params, "title", &mut product, "title");
                insert_opt_str(ctx, params, "bodyHtml", &mut product, "body_html");
                insert_opt_str(ctx, params, "vendor", &mut product, "vendor");
                if let Some(v) = json_param(ctx, params, "variants") {
                    product.insert("variants".to_string(), v);
                }
                put(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/products/{id}.json"),
                    json!({ "product": Value::Object(product) }),
                )
                .await?
            }
            ("product", "delete") => {
                let id = ctx.param_str(params, "productId")?;
                delete(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/products/{id}.json"),
                )
                .await?
            }

            // ----- order -----
            ("order", "create") => {
                let mut order = match json_param(ctx, params, "orderFields") {
                    Some(Value::Object(m)) => m,
                    _ => Map::new(),
                };
                // Defensive: in case the user wrapped it in `{ "order": {...} }`.
                if let Some(Value::Object(inner)) = order.remove("order") {
                    order = inner;
                }
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/orders.json",
                    json!({ "order": Value::Object(order) }),
                )
                .await?
            }
            ("order", "get") => {
                let id = ctx.param_str(params, "orderId")?;
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/orders/{id}.json"),
                    &[],
                )
                .await?
            }
            ("order", "list") => {
                let limit = limit_value(ctx, params);
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/orders.json",
                    &[("limit", limit.as_str())],
                )
                .await?
            }
            ("order", "update") => {
                let id = ctx.param_str(params, "orderId")?;
                let mut order = match json_param(ctx, params, "orderFields") {
                    Some(Value::Object(m)) => m,
                    _ => Map::new(),
                };
                if let Some(Value::Object(inner)) = order.remove("order") {
                    order = inner;
                }
                order.insert("id".to_string(), parse_id(&id));
                put(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/orders/{id}.json"),
                    json!({ "order": Value::Object(order) }),
                )
                .await?
            }
            ("order", "cancel") => {
                let id = ctx.param_str(params, "orderId")?;
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/orders/{id}/cancel.json"),
                    Value::Object(Map::new()),
                )
                .await?
            }
            ("order", "close") => {
                let id = ctx.param_str(params, "orderId")?;
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/orders/{id}/close.json"),
                    Value::Object(Map::new()),
                )
                .await?
            }

            // ----- customer -----
            ("customer", "create") => {
                let mut customer = Map::new();
                insert_opt_str(ctx, params, "email", &mut customer, "email");
                insert_opt_str(ctx, params, "firstName", &mut customer, "first_name");
                insert_opt_str(ctx, params, "lastName", &mut customer, "last_name");
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/customers.json",
                    json!({ "customer": Value::Object(customer) }),
                )
                .await?
            }
            ("customer", "get") => {
                let id = ctx.param_str(params, "customerId")?;
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/customers/{id}.json"),
                    &[],
                )
                .await?
            }
            ("customer", "list") => {
                let limit = limit_value(ctx, params);
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/customers.json",
                    &[("limit", limit.as_str())],
                )
                .await?
            }
            ("customer", "update") => {
                let id = ctx.param_str(params, "customerId")?;
                let mut customer = Map::new();
                customer.insert("id".to_string(), parse_id(&id));
                insert_opt_str(ctx, params, "email", &mut customer, "email");
                insert_opt_str(ctx, params, "firstName", &mut customer, "first_name");
                insert_opt_str(ctx, params, "lastName", &mut customer, "last_name");
                put(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/customers/{id}.json"),
                    json!({ "customer": Value::Object(customer) }),
                )
                .await?
            }
            ("customer", "delete") => {
                let id = ctx.param_str(params, "customerId")?;
                delete(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/customers/{id}.json"),
                )
                .await?
            }

            // ----- inventory -----
            ("inventory", "getLevel") => {
                let inventory_item_id = ctx.param_str(params, "inventoryItemId")?;
                let location_id = ctx.param_str(params, "locationId")?;
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/inventory_levels.json",
                    &[
                        ("inventory_item_ids", inventory_item_id.as_str()),
                        ("location_ids", location_id.as_str()),
                    ],
                )
                .await?
            }
            ("inventory", "adjustLevel") => {
                let inventory_item_id = ctx.param_str(params, "inventoryItemId")?;
                let location_id = ctx.param_str(params, "locationId")?;
                let adjustment = ctx
                    .param_f64(params, "availableAdjustment")
                    .ok_or_else(|| NodeError::MissingParameter("availableAdjustment".into()))?;
                post(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/inventory_levels/adjust.json",
                    json!({
                        "inventory_item_id": parse_id(&inventory_item_id),
                        "location_id": parse_id(&location_id),
                        "available_adjustment": adjustment.trunc() as i64,
                    }),
                )
                .await?
            }

            // ----- collection -----
            ("collection", "get") => {
                let id = ctx.param_str(params, "collectionId")?;
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    &format!("/custom_collections/{id}.json"),
                    &[],
                )
                .await?
            }
            ("collection", "list") => {
                let limit = limit_value(ctx, params);
                get(
                    ctx,
                    &shop_domain,
                    &access_token,
                    "/custom_collections.json",
                    &[("limit", limit.as_str())],
                )
                .await?
            }

            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

/// Build a fully-qualified Shopify Admin API URL for `path` (must start with `/`).
fn build_url(shop_domain: &str, path: &str) -> String {
    format!("https://{shop_domain}/admin/api/{SHOPIFY_API_VERSION}{path}")
}

/// Insert a string param into the target map after `{{var}}` substitution if
/// it's present and non-empty.
fn insert_opt_str(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
    map: &mut Map<String, Value>,
    field: &str,
) {
    if let Some(v) = ctx.param_str_opt(params, key) {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            map.insert(field.to_string(), Value::String(trimmed.to_string()));
        }
    }
}

/// Read a JSON-typed property.  Accepts either an actual JSON value or a
/// string that parses as JSON (after `{{var}}` substitution).
fn json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let substituted = ctx.substitute(s);
            let trimmed = substituted.trim();
            if trimmed.is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(trimmed).ok()
        }
        other => Some(other.clone()),
    }
}

/// Shopify uses numeric IDs.  Accept either a number or a string and return
/// a JSON number when possible, falling back to the original string form.
fn parse_id(id: &str) -> Value {
    if let Ok(n) = id.parse::<i64>() {
        return json!(n);
    }
    json!(id)
}

/// Stringify the list `limit` param (Shopify default page size we use: 50).
fn limit_value(ctx: &ExecutionContext, params: &Value) -> String {
    let n = ctx.param_f64(params, "limit").unwrap_or(50.0);
    format!("{}", n.trunc() as i64)
}

async fn post(
    ctx: &ExecutionContext,
    shop_domain: &str,
    access_token: &str,
    path: &str,
    body: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .post(build_url(shop_domain, path))
        .header("X-Shopify-Access-Token", access_token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put(
    ctx: &ExecutionContext,
    shop_domain: &str,
    access_token: &str,
    path: &str,
    body: Value,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .put(build_url(shop_domain, path))
        .header("X-Shopify-Access-Token", access_token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get(
    ctx: &ExecutionContext,
    shop_domain: &str,
    access_token: &str,
    path: &str,
    query: &[(&str, &str)],
) -> NodeResult<Value> {
    let mut req = ctx
        .http
        .get(build_url(shop_domain, path))
        .header("X-Shopify-Access-Token", access_token)
        .header("Content-Type", "application/json");
    if !query.is_empty() {
        req = req.query(query);
    }
    let res = req.send().await?;
    finalize_response(res).await
}

async fn delete(
    ctx: &ExecutionContext,
    shop_domain: &str,
    access_token: &str,
    path: &str,
) -> NodeResult<Value> {
    let res = ctx
        .http
        .delete(build_url(shop_domain, path))
        .header("X-Shopify-Access-Token", access_token)
        .header("Content-Type", "application/json")
        .send()
        .await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}
