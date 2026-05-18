//! Clearbit node.
//!
//! Implements person, company, and combined enrichment lookups against the
//! Clearbit Enrichment / Discovery APIs:
//!
//! * Person:   `https://person.clearbit.com/v2/people/find`
//! * Company:  `https://company.clearbit.com/v2/companies/find`
//! * Combined: `https://person.clearbit.com/v2/combined/find`
//! * Discovery: `https://discovery.clearbit.com/v1/companies/search`
//!
//! Authenticates with the secret API key via Bearer auth.

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

pub struct ClearbitNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ClearbitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "clearbit",
            "Clearbit",
            "Enrich people and companies using the Clearbit APIs",
            NodeCategory::Marketing,
        )
        .icon("search")
        .color("#00B2A9")
        .credentials(vec![CredentialBinding {
            name: "clearbitApi".into(),
            display_name: "Clearbit API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Enrich Person", "personEnrich"),
                    opt("Enrich Company", "companyEnrich"),
                    opt("Combined (Person + Company)", "combined"),
                    opt("Company Discovery", "discovery"),
                ])
                .default(json!("personEnrich"))
                .required(),
            // person / combined
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["personEnrich", "combined"])
                .required(),
            // company
            NodeProperty::new("domain", "Domain", NodePropertyType::String)
                .placeholder("example.com")
                .show_when("operation", &["companyEnrich"])
                .required(),
            // discovery
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("category.industry:Software")
                .show_when("operation", &["discovery"])
                .required()
                .description("Clearbit Discovery query string"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(20))
                .show_when("operation", &["discovery"])
                .description("Page size (max 100)"),
            NodeProperty::new("page", "Page", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["discovery"]),
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "personEnrich" => {
                let email = ctx.param_str(params, "email")?;
                let url = format!("https://person.clearbit.com/v2/people/find?email={email}");
                send_get(ctx, &api_key, &url).await?
            }
            "companyEnrich" => {
                let domain = ctx.param_str(params, "domain")?;
                let url = format!("https://company.clearbit.com/v2/companies/find?domain={domain}");
                send_get(ctx, &api_key, &url).await?
            }
            "combined" => {
                let email = ctx.param_str(params, "email")?;
                let url = format!("https://person.clearbit.com/v2/combined/find?email={email}");
                send_get(ctx, &api_key, &url).await?
            }
            "discovery" => {
                let query = ctx.param_str(params, "query")?;
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n as i64)
                    .unwrap_or(20);
                let page = ctx
                    .param_f64(params, "page")
                    .map(|n| n as i64)
                    .unwrap_or(1);
                let url = format!(
                    "https://discovery.clearbit.com/v1/companies/search?query={query}&limit={limit}&page={page}"
                );
                send_get(ctx, &api_key, &url).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn send_get(ctx: &ExecutionContext, api_key: &str, url: &str) -> NodeResult<Value> {
    let req = ctx
        .http
        .get(url)
        .bearer_auth(api_key)
        .header("Accept", "application/json");
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
}
