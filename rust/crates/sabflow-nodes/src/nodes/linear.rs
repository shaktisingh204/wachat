//! Linear node — issue tracking via the Linear GraphQL API
//! (`https://api.linear.app/graphql`).
//!
//! Authentication uses a personal API key stored on a `linearApi` credential
//! under `data["apiKey"]`.  Linear is unusual: the `Authorization` header
//! takes the raw key with **no** `Bearer` prefix (keys begin with `lin_api_`).
//!
//! Every operation is dispatched as a GraphQL POST with body
//! `{ "query": <string>, "variables": <object> }`.  Responses are parsed as
//! JSON; non-2xx HTTP responses are surfaced as `NodeError::UpstreamError`.

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

pub struct LinearNode;

const API_URL: &str = "https://api.linear.app/graphql";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for LinearNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "linear",
            "Linear",
            "Linear issue tracking",
            NodeCategory::Developer,
        )
        .icon("layers")
        .color("#5E6AD2")
        .credentials(vec![CredentialBinding {
            name: "linearApi".into(),
            display_name: "Linear API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create Issue", "createIssue"),
                    opt("Get Issue", "getIssue"),
                    opt("Update Issue", "updateIssue"),
                    opt("Delete Issue", "deleteIssue"),
                    opt("List Issues", "listIssues"),
                    opt("List Teams", "listTeams"),
                    opt("List Projects", "listProjects"),
                ])
                .default(json!("createIssue"))
                .required(),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                .show_when("operation", &["createIssue", "listIssues"]),
            NodeProperty::new("issueId", "Issue ID", NodePropertyType::String)
                .show_when("operation", &["getIssue", "updateIssue", "deleteIssue"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["createIssue", "updateIssue"]),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["createIssue", "updateIssue"]),
            NodeProperty::new("stateId", "State ID", NodePropertyType::String)
                .show_when("operation", &["updateIssue"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["listIssues"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // ── credential ─────────────────────────────────────────────────────
        let cred_id = ctx.param_str(params, "credentialId")?;
        let api_key = ctx
            .credential(&cred_id)?
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "createIssue" => {
                let team_id = sub_required(ctx, params, "teamId")?;
                let title = sub_required(ctx, params, "title")?;
                let description = ctx
                    .param_str_opt(params, "description")
                    .map(|s| ctx.substitute(&s))
                    .unwrap_or_default();

                let mut input = Map::new();
                input.insert("teamId".into(), json!(team_id));
                input.insert("title".into(), json!(title));
                if !description.is_empty() {
                    input.insert("description".into(), json!(description));
                }

                let query = "mutation IssueCreate($input: IssueCreateInput!) { \
                    issueCreate(input: $input) { \
                        success \
                        issue { id title description state { id name } } \
                    } \
                }";
                let variables = json!({ "input": Value::Object(input) });
                graphql(ctx, &api_key, query, variables).await
            }

            "getIssue" => {
                let issue_id = sub_required(ctx, params, "issueId")?;
                let query = "query GetIssue($id: String!) { \
                    issue(id: $id) { \
                        id title description \
                        state { id name } \
                        assignee { id name } \
                    } \
                }";
                let variables = json!({ "id": issue_id });
                graphql(ctx, &api_key, query, variables).await
            }

            "updateIssue" => {
                let issue_id = sub_required(ctx, params, "issueId")?;
                let mut input = Map::new();
                if let Some(t) = ctx.param_str_opt(params, "title") {
                    let t = ctx.substitute(&t);
                    if !t.is_empty() {
                        input.insert("title".into(), json!(t));
                    }
                }
                if let Some(d) = ctx.param_str_opt(params, "description") {
                    let d = ctx.substitute(&d);
                    if !d.is_empty() {
                        input.insert("description".into(), json!(d));
                    }
                }
                if let Some(s) = ctx.param_str_opt(params, "stateId") {
                    let s = ctx.substitute(&s);
                    if !s.is_empty() {
                        input.insert("stateId".into(), json!(s));
                    }
                }

                let query = "mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { \
                    issueUpdate(id: $id, input: $input) { \
                        success \
                        issue { id title description state { id name } } \
                    } \
                }";
                let variables = json!({
                    "id": issue_id,
                    "input": Value::Object(input),
                });
                graphql(ctx, &api_key, query, variables).await
            }

            "deleteIssue" => {
                let issue_id = sub_required(ctx, params, "issueId")?;
                let query = "mutation IssueDelete($id: String!) { \
                    issueDelete(id: $id) { success } \
                }";
                let variables = json!({ "id": issue_id });
                graphql(ctx, &api_key, query, variables).await
            }

            "listIssues" => {
                let first = ctx.param_f64(params, "limit").unwrap_or(50.0) as i64;
                let first = if first <= 0 { 50 } else { first };
                let team_id = ctx
                    .param_str_opt(params, "teamId")
                    .map(|s| ctx.substitute(&s))
                    .filter(|s| !s.is_empty());

                let (query, variables) = if let Some(tid) = team_id {
                    let q = "query ListIssues($first: Int!, $teamId: ID!) { \
                        issues(first: $first, filter: { team: { id: { eq: $teamId } } }) { \
                            nodes { id title state { id name } } \
                        } \
                    }";
                    (q, json!({ "first": first, "teamId": tid }))
                } else {
                    let q = "query ListIssues($first: Int!) { \
                        issues(first: $first) { \
                            nodes { id title state { id name } } \
                        } \
                    }";
                    (q, json!({ "first": first }))
                };
                graphql(ctx, &api_key, query, variables).await
            }

            "listTeams" => {
                let query = "query ListTeams { teams { nodes { id name } } }";
                graphql(ctx, &api_key, query, json!({})).await
            }

            "listProjects" => {
                let query = "query ListProjects { projects { nodes { id name } } }";
                graphql(ctx, &api_key, query, json!({})).await
            }

            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Fetch a required user-supplied string param and substitute `{{var}}`.
fn sub_required(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

/// POST a GraphQL `{query, variables}` body to the Linear API and unwrap the
/// response.  Non-2xx HTTP or a populated `errors` array is reported as an
/// `UpstreamError`.
async fn graphql(
    ctx: &ExecutionContext,
    api_key: &str,
    query: &str,
    variables: Value,
) -> NodeResult<NodeOutput> {
    let body = json!({
        "query": query,
        "variables": variables,
    });

    let res = ctx
        .http
        .post(API_URL)
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let status = res.status();
    let bytes = res.bytes().await?;
    let parsed: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: match &parsed {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            },
        });
    }

    // GraphQL-level errors are reported with HTTP 200; surface them too.
    if let Some(errs) = parsed.get("errors").and_then(|v| v.as_array()) {
        if !errs.is_empty() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: Value::Array(errs.clone()).to_string(),
            });
        }
    }

    Ok(NodeOutput::single(vec![parsed]))
}
