//! Stripe node.
//!
//! Implements payment, customer, subscription, product, price, payment intent,
//! and invoice operations against the Stripe REST API (https://api.stripe.com/v1).
//! Authenticates with a secret API key supplied via the `stripeApi` credential
//! (`secretKey` field, e.g. `sk_test_...` or `sk_live_...`).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct StripeNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const STRIPE_API_BASE: &str = "https://api.stripe.com/v1";

#[async_trait]
impl Node for StripeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "stripe",
            "Stripe",
            "Stripe payments, customers, subscriptions, products and invoices",
            NodeCategory::Finance,
        )
        .icon("credit-card")
        .color("#635BFF")
        .credentials(vec![CredentialBinding {
            name: "stripeApi".into(),
            display_name: "Stripe API Secret Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Customer", "customer"),
                    opt("Charge", "charge"),
                    opt("Subscription", "subscription"),
                    opt("Product", "product"),
                    opt("Price", "price"),
                    opt("Payment Intent", "paymentIntent"),
                    opt("Invoice", "invoice"),
                ])
                .default(json!("customer"))
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
                .show_when("resource", &["customer"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .show_when("resource", &["charge"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Cancel", "cancel"),
                ])
                .default(json!("create"))
                .show_when("resource", &["subscription"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .show_when("resource", &["product"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("create"))
                .show_when("resource", &["price"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Capture", "capture"),
                    opt("Cancel", "cancel"),
                ])
                .default(json!("create"))
                .show_when("resource", &["paymentIntent"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Send", "send"),
                    opt("Pay", "pay"),
                    opt("Void", "void"),
                ])
                .default(json!("create"))
                .show_when("resource", &["invoice"])
                .required(),
            // ----- shared object id input -----
            NodeProperty::new("objectId", "Object ID", NodePropertyType::String)
                .placeholder("e.g. cus_..., ch_..., sub_...")
                .show_when(
                    "operation",
                    &[
                        "get", "update", "delete", "cancel", "capture", "send", "pay", "void",
                    ],
                ),
            // ----- create fields -----
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["customer"]),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("amount", "Amount", NodePropertyType::Number)
                .show_when("operation", &["create"])
                .description("Amount in the smallest currency unit (e.g. cents)"),
            NodeProperty::new("currency", "Currency", NodePropertyType::String)
                .default(json!("usd"))
                .show_when("operation", &["create"]),
            NodeProperty::new("customerId", "Customer ID", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["charge", "subscription", "invoice"]),
            NodeProperty::new("paymentMethod", "Payment Method", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["charge", "paymentIntent"]),
            NodeProperty::new("priceId", "Price ID", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["subscription"]),
            NodeProperty::new("productId", "Product ID", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["price"]),
            NodeProperty::new("unitAmount", "Unit Amount", NodePropertyType::Number)
                .show_when("operation", &["create"])
                .show_when("resource", &["price"])
                .description("Unit amount in the smallest currency unit"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["list"]),
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
        let secret_key = cred
            .data
            .get("secretKey")
            .ok_or_else(|| NodeError::MissingParameter("secretKey".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "customer".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- customer -----
            ("customer", "create") => {
                let mut form: Vec<(String, String)> = Vec::new();
                push_opt_str(ctx, params, "email", &mut form, "email");
                push_opt_str(ctx, params, "name", &mut form, "name");
                push_opt_str(ctx, params, "description", &mut form, "description");
                post_form(ctx, &secret_key, "/customers", &form).await?
            }
            ("customer", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/customers/{id}"), &[]).await?
            }
            ("customer", "list") => {
                let limit = limit_value(ctx, params);
                get(ctx, &secret_key, "/customers", &[("limit", limit.as_str())]).await?
            }
            ("customer", "update") => {
                let id = ctx.param_str(params, "objectId")?;
                let mut form: Vec<(String, String)> = Vec::new();
                push_opt_str(ctx, params, "email", &mut form, "email");
                push_opt_str(ctx, params, "name", &mut form, "name");
                push_opt_str(ctx, params, "description", &mut form, "description");
                post_form(ctx, &secret_key, &format!("/customers/{id}"), &form).await?
            }
            ("customer", "delete") => {
                let id = ctx.param_str(params, "objectId")?;
                delete(ctx, &secret_key, &format!("/customers/{id}")).await?
            }

            // ----- charge -----
            ("charge", "create") => {
                let mut form: Vec<(String, String)> = Vec::new();
                push_opt_num(ctx, params, "amount", &mut form, "amount");
                push_opt_str(ctx, params, "currency", &mut form, "currency");
                push_opt_str(ctx, params, "customerId", &mut form, "customer");
                push_opt_str(ctx, params, "description", &mut form, "description");
                push_opt_str(ctx, params, "paymentMethod", &mut form, "source");
                post_form(ctx, &secret_key, "/charges", &form).await?
            }
            ("charge", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/charges/{id}"), &[]).await?
            }
            ("charge", "list") => {
                let limit = limit_value(ctx, params);
                get(ctx, &secret_key, "/charges", &[("limit", limit.as_str())]).await?
            }

            // ----- subscription -----
            ("subscription", "create") => {
                let customer = ctx.param_str(params, "customerId")?;
                let price_id = ctx.param_str(params, "priceId")?;
                let form: Vec<(String, String)> = vec![
                    ("customer".to_string(), customer),
                    ("items[0][price]".to_string(), price_id),
                ];
                post_form(ctx, &secret_key, "/subscriptions", &form).await?
            }
            ("subscription", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/subscriptions/{id}"), &[]).await?
            }
            ("subscription", "list") => {
                let limit = limit_value(ctx, params);
                get(
                    ctx,
                    &secret_key,
                    "/subscriptions",
                    &[("limit", limit.as_str())],
                )
                .await?
            }
            ("subscription", "cancel") => {
                let id = ctx.param_str(params, "objectId")?;
                delete(ctx, &secret_key, &format!("/subscriptions/{id}")).await?
            }

            // ----- product -----
            ("product", "create") => {
                let name = ctx.param_str(params, "name")?;
                let mut form: Vec<(String, String)> = vec![("name".to_string(), name)];
                push_opt_str(ctx, params, "description", &mut form, "description");
                post_form(ctx, &secret_key, "/products", &form).await?
            }
            ("product", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/products/{id}"), &[]).await?
            }
            ("product", "list") => {
                let limit = limit_value(ctx, params);
                get(ctx, &secret_key, "/products", &[("limit", limit.as_str())]).await?
            }

            // ----- price -----
            ("price", "create") => {
                let product = ctx.param_str(params, "productId")?;
                let unit_amount = ctx
                    .param_f64(params, "unitAmount")
                    .ok_or_else(|| NodeError::MissingParameter("unitAmount".into()))?;
                let mut form: Vec<(String, String)> = vec![
                    ("product".to_string(), product),
                    ("unit_amount".to_string(), format_amount(unit_amount)),
                ];
                let currency = ctx
                    .param_str_opt(params, "currency")
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "usd".to_string());
                form.push(("currency".to_string(), currency));
                post_form(ctx, &secret_key, "/prices", &form).await?
            }
            ("price", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/prices/{id}"), &[]).await?
            }
            ("price", "list") => {
                let limit = limit_value(ctx, params);
                get(ctx, &secret_key, "/prices", &[("limit", limit.as_str())]).await?
            }

            // ----- paymentIntent -----
            ("paymentIntent", "create") => {
                let mut form: Vec<(String, String)> = Vec::new();
                push_opt_num(ctx, params, "amount", &mut form, "amount");
                let currency = ctx
                    .param_str_opt(params, "currency")
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "usd".to_string());
                form.push(("currency".to_string(), currency));
                push_opt_str(ctx, params, "customerId", &mut form, "customer");
                push_opt_str(ctx, params, "paymentMethod", &mut form, "payment_method");
                post_form(ctx, &secret_key, "/payment_intents", &form).await?
            }
            ("paymentIntent", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/payment_intents/{id}"), &[]).await?
            }
            ("paymentIntent", "capture") => {
                let id = ctx.param_str(params, "objectId")?;
                post_form(
                    ctx,
                    &secret_key,
                    &format!("/payment_intents/{id}/capture"),
                    &[],
                )
                .await?
            }
            ("paymentIntent", "cancel") => {
                let id = ctx.param_str(params, "objectId")?;
                post_form(
                    ctx,
                    &secret_key,
                    &format!("/payment_intents/{id}/cancel"),
                    &[],
                )
                .await?
            }

            // ----- invoice -----
            ("invoice", "create") => {
                let customer = ctx.param_str(params, "customerId")?;
                let form: Vec<(String, String)> = vec![("customer".to_string(), customer)];
                post_form(ctx, &secret_key, "/invoices", &form).await?
            }
            ("invoice", "get") => {
                let id = ctx.param_str(params, "objectId")?;
                get(ctx, &secret_key, &format!("/invoices/{id}"), &[]).await?
            }
            ("invoice", "list") => {
                let limit = limit_value(ctx, params);
                get(ctx, &secret_key, "/invoices", &[("limit", limit.as_str())]).await?
            }
            ("invoice", "send") => {
                let id = ctx.param_str(params, "objectId")?;
                post_form(ctx, &secret_key, &format!("/invoices/{id}/send"), &[]).await?
            }
            ("invoice", "pay") => {
                let id = ctx.param_str(params, "objectId")?;
                post_form(ctx, &secret_key, &format!("/invoices/{id}/pay"), &[]).await?
            }
            ("invoice", "void") => {
                let id = ctx.param_str(params, "objectId")?;
                post_form(ctx, &secret_key, &format!("/invoices/{id}/void"), &[]).await?
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

/// Push a string param into the form body if it's present and non-empty.
fn push_opt_str(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
    form: &mut Vec<(String, String)>,
    field: &str,
) {
    if let Some(v) = ctx.param_str_opt(params, key) {
        if !v.trim().is_empty() {
            form.push((field.to_string(), v));
        }
    }
}

/// Push a numeric param into the form body if it's present (integer-formatted).
fn push_opt_num(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
    form: &mut Vec<(String, String)>,
    field: &str,
) {
    if let Some(n) = ctx.param_f64(params, key) {
        form.push((field.to_string(), format_amount(n)));
    }
}

/// Stripe's amounts are integers in the smallest currency unit. Truncate
/// any fractional digits the user may have provided.
fn format_amount(n: f64) -> String {
    format!("{}", n.trunc() as i64)
}

/// Read the `limit` param as a stringified integer, defaulting to 100.
fn limit_value(ctx: &ExecutionContext, params: &Value) -> String {
    let n = ctx.param_f64(params, "limit").unwrap_or(100.0);
    format!("{}", n.trunc() as i64)
}

/// POST a form-urlencoded body to `{STRIPE_API_BASE}{path}`.
async fn post_form(
    ctx: &ExecutionContext,
    secret_key: &str,
    path: &str,
    form: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{STRIPE_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .basic_auth(secret_key, Some(""))
        .form(form)
        .send()
        .await?;
    finalize_response(res).await
}

/// GET `{STRIPE_API_BASE}{path}` with optional query parameters.
async fn get(
    ctx: &ExecutionContext,
    secret_key: &str,
    path: &str,
    query: &[(&str, &str)],
) -> NodeResult<Value> {
    let url = format!("{STRIPE_API_BASE}{path}");
    let mut req = ctx.http.get(&url).basic_auth(secret_key, Some(""));
    if !query.is_empty() {
        req = req.query(query);
    }
    let res = req.send().await?;
    finalize_response(res).await
}

/// DELETE `{STRIPE_API_BASE}{path}`.
async fn delete(ctx: &ExecutionContext, secret_key: &str, path: &str) -> NodeResult<Value> {
    let url = format!("{STRIPE_API_BASE}{path}");
    let res = ctx
        .http
        .delete(&url)
        .basic_auth(secret_key, Some(""))
        .send()
        .await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}
