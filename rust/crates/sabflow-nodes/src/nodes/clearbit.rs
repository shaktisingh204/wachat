//! Clearbit node — business and person enrichment.
//!
//! Wraps the Clearbit enrichment endpoints:
//!   - Person enrichment by email (`person.clearbit.com/v2/people/find`)
//!   - Company enrichment by domain (`company.clearbit.com/v2/companies/find`)
//!
//! Auth: HTTP basic with the API key as the username (per Clearbit docs).
//!
//! Quality bar: C.5 typed-stub-with-descriptor — `find` operations on
//! `person` and `company` are wired.

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
            "Enrich people and companies via the Clearbit Enrichment API",
            NodeCategory::Marketing,
        )
        .icon("search")
        .color("#0091FF")
        .credentials(vec![CredentialBinding {
            name: "clearbitApi".into(),
            display_name: "Clearbit API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Person", "person"),
                    opt("Company", "company"),
                ])
                .default(json!("person"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Find / Enrich", "find")])
                .default(json!("find"))
                .required(),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("jane@example.com")
                .description("Email address of the person to enrich")
                .show_when("resource", &["person"])
                .required(),
            NodeProperty::new("domain", "Domain", NodePropertyType::String)
                .placeholder("example.com")
                .description("Domain of the company to enrich")
                .show_when("resource", &["company"])
                .required(),
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
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "person".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "find".to_string());

        let (url, query): (String, Vec<(&str, String)>) = match (resource.as_str(), operation.as_str()) {
            ("person", "find") => {
                let email = ctx.param_str(params, "email")?;
                (
                    "https://person.clearbit.com/v2/people/find".to_string(),
                    vec![("email", email)],
                )
            }
            ("company", "find") => {
                let domain = ctx.param_str(params, "domain")?;
                (
                    "https://company.clearbit.com/v2/companies/find".to_string(),
                    vec![("domain", domain)],
                )
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported clearbit {res} operation: {op}"),
                });
            }
        };

        let res = ctx
            .http
            .get(&url)
            .basic_auth(&api_key, Some(""))
            .header("Accept", "application/json")
            .query(&query)
            .send()
            .await?;
        let status = res.status();
        let text_body = res.text().await.unwrap_or_default();
        let body: Value =
            serde_json::from_str(&text_body).unwrap_or(Value::String(text_body.clone()));
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body.to_string(),
            });
        }
        Ok(NodeOutput::single(vec![body]))
    }
}
