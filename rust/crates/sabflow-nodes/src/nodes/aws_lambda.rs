//! AWS Lambda node — invoke a function and (optionally) return its response.
//!
//! Talks straight to `lambda.{region}.amazonaws.com` with SigV4 — no
//! `aws-sdk-lambda` dependency. Credential schema: `awsApi` with
//! `accessKeyId`, `secretAccessKey`, `region`, optional `sessionToken`.

use async_trait::async_trait;
use chrono::Utc;
use reqwest::{
    Method,
    header::{HeaderMap, HeaderValue},
};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
    nodes::aws_sigv4::{AwsCreds, SignParams, sign_request},
};

pub struct AwsLambdaNode;

#[async_trait]
impl Node for AwsLambdaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsLambda",
            "AWS Lambda",
            "Invoke an AWS Lambda function",
            NodeCategory::Developer,
        )
        .icon("zap")
        .color("#FF9900")
        .credentials(vec![CredentialBinding {
            name: "awsApi".into(),
            display_name: "AWS API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![NodePropertyOption {
                    name: "Invoke".into(),
                    value: json!("invoke"),
                    description: Some("Invoke a Lambda function".into()),
                }])
                .default(json!("invoke"))
                .required(),
            NodeProperty::new("functionName", "Function Name", NodePropertyType::String)
                .placeholder("my-function or arn:aws:lambda:...")
                .show_when("operation", &["invoke"])
                .required(),
            NodeProperty::new("invocationType", "Invocation Type", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "RequestResponse (sync)".into(),
                        value: json!("RequestResponse"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Event (async)".into(),
                        value: json!("Event"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "DryRun".into(),
                        value: json!("DryRun"),
                        description: None,
                    },
                ])
                .default(json!("RequestResponse"))
                .show_when("operation", &["invoke"]),
            NodeProperty::new("qualifier", "Qualifier (version / alias)", NodePropertyType::String)
                .show_when("operation", &["invoke"]),
            NodeProperty::new("payload", "Payload (JSON)", NodePropertyType::Json)
                .description("JSON payload passed to the function")
                .default(json!({}))
                .show_when("operation", &["invoke"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let creds = AwsCreds::from_credential(ctx.credential(&cred_id)?)?;

        let function_name = ctx.param_str(params, "functionName")?;
        let invocation_type = ctx
            .param_str_opt(params, "invocationType")
            .unwrap_or_else(|| "RequestResponse".to_string());
        let qualifier = ctx
            .param_str_opt(params, "qualifier")
            .filter(|s| !s.is_empty());
        let payload = params.get("payload").cloned().unwrap_or_else(|| json!({}));
        let body = serde_json::to_vec(&payload)?;

        let mut url = format!(
            "https://lambda.{region}.amazonaws.com/2015-03-31/functions/{fn_name}/invocations",
            region = creds.region,
            fn_name = function_name,
        );
        if let Some(q) = &qualifier {
            url.push_str(&format!("?Qualifier={q}"));
        }
        let url = url
            .parse::<reqwest::Url>()
            .map_err(|e| NodeError::Other(format!("AWS Lambda: bad URL: {e}")))?;

        let mut headers = HeaderMap::new();
        headers.insert("content-type", HeaderValue::from_static("application/json"));
        headers.insert(
            "x-amz-invocation-type",
            HeaderValue::from_str(&invocation_type)
                .map_err(|e| NodeError::Other(format!("AWS Lambda: {e}")))?,
        );

        let req = sign_request(SignParams {
            method: Method::POST,
            url,
            extra_headers: headers,
            body,
            region: &creds.region,
            service: "lambda",
            access_key_id: &creds.access_key_id,
            secret_access_key: &creds.secret_access_key,
            session_token: creds.session_token.as_deref(),
            now: Utc::now(),
        })?;

        let resp = ctx.http.execute(req).await?;
        let status = resp.status();
        let function_error = resp
            .headers()
            .get("x-amz-function-error")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let executed_version = resp
            .headers()
            .get("x-amz-executed-version")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let body_text = resp.text().await?;
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body_text,
            });
        }
        let parsed: Value = serde_json::from_str(&body_text).unwrap_or(Value::String(body_text));
        Ok(NodeOutput::single(vec![json!({
            "statusCode": status.as_u16(),
            "functionError": function_error,
            "executedVersion": executed_version,
            "payload": parsed,
        })]))
    }
}
