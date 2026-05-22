//! GraphQL node.
//!
//! POSTs a GraphQL query (with optional variables and operation name) to a
//! configured endpoint and returns the `data` field. Authentication headers
//! come from the `graphQlApi` credential — its `endpointUrl` is used as the
//! default endpoint and its `headers` field (a JSON object) is merged into
//! the outgoing request. The node-level `endpoint` property overrides the
//! credential's endpoint when set.

use async_trait::async_trait;
use serde_json::{Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct GraphqlNode;

#[async_trait]
impl Node for GraphqlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "graphQL",
            "GraphQL",
            "Send GraphQL queries",
            NodeCategory::Developer,
        )
        .icon("share-2")
        .color("#E10098")
        .credentials(vec![CredentialBinding {
            name: "graphQlApi".into(),
            display_name: "GraphQL API".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("Optional — supplies endpoint and auth headers"),
            NodeProperty::new("endpoint", "Endpoint URL", NodePropertyType::String)
                .placeholder("https://api.example.com/graphql")
                .description("Overrides the credential endpoint when set"),
            NodeProperty::new("query", "Query", NodePropertyType::Code)
                .placeholder("query { viewer { id name } }")
                .required(),
            NodeProperty::new("variables", "Variables", NodePropertyType::Json)
                .description("Optional JSON object of GraphQL variables"),
            NodeProperty::new("operationName", "Operation Name", NodePropertyType::String)
                .description("Optional — used when the query contains multiple operations"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Optional credential — supplies endpoint + headers.
        let cred_opt = ctx
            .param_str_opt(params, "credentialId")
            .and_then(|id| if id.is_empty() { None } else { Some(id) });

        let (cred_endpoint, cred_headers): (Option<String>, Option<Value>) = match cred_opt {
            Some(id) => {
                let cred = ctx.credential(&id)?;
                let endpoint = cred.data.get("endpointUrl").cloned();
                let headers = cred.data.get("headers").and_then(|s| {
                    let trimmed = s.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        serde_json::from_str::<Value>(trimmed).ok()
                    }
                });
                (endpoint, headers)
            }
            None => (None, None),
        };

        // Endpoint resolution: explicit property wins, fall back to credential.
        let endpoint_param = ctx
            .param_str_opt(params, "endpoint")
            .filter(|s| !s.is_empty());
        let endpoint = endpoint_param
            .or(cred_endpoint)
            .ok_or_else(|| NodeError::MissingParameter("endpoint".into()))?;
        if endpoint.is_empty() {
            return Err(NodeError::MissingParameter("endpoint".into()));
        }

        // Query is required.
        let query = ctx.param_str(params, "query")?;
        if query.trim().is_empty() {
            return Err(NodeError::MissingParameter("query".into()));
        }

        // Variables — accept either a native JSON object or a string holding JSON.
        let variables: Option<Value> = match params.get("variables") {
            None | Some(Value::Null) => None,
            Some(Value::String(s)) => {
                let s = ctx.substitute(s);
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(serde_json::from_str::<Value>(trimmed).map_err(|e| {
                        NodeError::InvalidParameter {
                            name: "variables".into(),
                            reason: format!("invalid JSON: {e}"),
                        }
                    })?)
                }
            }
            Some(other) => Some(substitute_value(ctx, other.clone())),
        };

        let operation_name = ctx
            .param_str_opt(params, "operationName")
            .filter(|s| !s.is_empty());

        // Build the GraphQL request body.
        let mut body = Map::new();
        body.insert("query".into(), Value::String(query));
        if let Some(v) = variables {
            body.insert("variables".into(), v);
        }
        if let Some(op) = operation_name {
            body.insert("operationName".into(), Value::String(op));
        }

        // Build the HTTP request, merging credential headers.
        let mut req = ctx.http.post(&endpoint).json(&Value::Object(body));
        if let Some(Value::Object(map)) = cred_headers {
            for (k, v) in map.iter() {
                let value_str = match v {
                    Value::String(s) => ctx.substitute(s),
                    Value::Null => String::new(),
                    other => other.to_string(),
                };
                req = req.header(k.as_str(), value_str);
            }
        }

        let res = req.send().await?;
        let status = res.status();
        let response_body: Value = res.json().await.unwrap_or(Value::Null);

        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: response_body.to_string(),
            });
        }

        // GraphQL transports a 200 even on logical errors — surface `errors` if present.
        if let Some(Value::Array(errs)) = response_body.get("errors") {
            if !errs.is_empty() {
                return Err(NodeError::UpstreamError {
                    status: status.as_u16(),
                    body: Value::Array(errs.clone()).to_string(),
                });
            }
        }

        let data = response_body.get("data").cloned().unwrap_or(Value::Null);

        Ok(NodeOutput::single(vec![data]))
    }
}

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}
