//! AWS CloudWatch node — publish metric data and put log events.
//!
//! Two surfaces share this node:
//!   - "putMetricData" uses the CloudWatch Query API (service `monitoring`).
//!   - "putLogEvents" / "describeLogStreams" use the CloudWatch Logs JSON API
//!     (service `logs`, content-type `application/x-amz-json-1.1`).
//!
//! No `aws-sdk-cloudwatch` or `aws-sdk-cloudwatchlogs` dep. Credential schema:
//! `awsApi`.

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
    nodes::{
        aws_sigv4::{AwsCreds, SignParams, sign_request},
        aws_sns::send_query,
    },
};

pub struct AwsCloudWatchNode;

#[async_trait]
impl Node for AwsCloudWatchNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsCloudWatch",
            "AWS CloudWatch",
            "Publish CloudWatch metrics and log events",
            NodeCategory::Analytics,
        )
        .icon("activity")
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
                .options(vec![
                    NodePropertyOption {
                        name: "Put Metric Data".into(),
                        value: json!("putMetricData"),
                        description: Some("Send a single metric datum".into()),
                    },
                    NodePropertyOption {
                        name: "Put Log Event".into(),
                        value: json!("putLogEvent"),
                        description: Some("Append one log event to a stream".into()),
                    },
                    NodePropertyOption {
                        name: "Describe Log Streams".into(),
                        value: json!("describeLogStreams"),
                        description: Some("List streams under a log group".into()),
                    },
                ])
                .default(json!("putMetricData"))
                .required(),
            // putMetricData
            NodeProperty::new("namespace", "Namespace", NodePropertyType::String)
                .placeholder("SabFlow/MyApp")
                .show_when("operation", &["putMetricData"])
                .required(),
            NodeProperty::new("metricName", "Metric Name", NodePropertyType::String)
                .show_when("operation", &["putMetricData"])
                .required(),
            NodeProperty::new("metricValue", "Value", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["putMetricData"])
                .required(),
            NodeProperty::new("metricUnit", "Unit", NodePropertyType::String)
                .description("e.g. Count, Seconds, Bytes (default None)")
                .show_when("operation", &["putMetricData"]),
            // putLogEvent / describeLogStreams
            NodeProperty::new("logGroupName", "Log Group", NodePropertyType::String)
                .show_when("operation", &["putLogEvent", "describeLogStreams"])
                .required(),
            NodeProperty::new("logStreamName", "Log Stream", NodePropertyType::String)
                .show_when("operation", &["putLogEvent"])
                .required(),
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .show_when("operation", &["putLogEvent"])
                .required(),
            NodeProperty::new("sequenceToken", "Sequence Token", NodePropertyType::String)
                .description("Required when stream already has events (PutLogEvents quirk)")
                .show_when("operation", &["putLogEvent"]),
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
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "putMetricData" => {
                let namespace = ctx.param_str(params, "namespace")?;
                let metric_name = ctx.param_str(params, "metricName")?;
                let value = ctx.param_f64(params, "metricValue").unwrap_or(1.0);
                let unit = ctx.param_str_opt(params, "metricUnit").filter(|s| !s.is_empty());
                let mut form: Vec<(String, String)> = vec![
                    ("Action".into(), "PutMetricData".into()),
                    ("Version".into(), "2010-08-01".into()),
                    ("Namespace".into(), namespace),
                    ("MetricData.member.1.MetricName".into(), metric_name),
                    ("MetricData.member.1.Value".into(), format!("{value}")),
                ];
                if let Some(u) = unit {
                    form.push(("MetricData.member.1.Unit".into(), u));
                }
                send_query(ctx, &creds, "monitoring", form).await
            }
            "putLogEvent" => {
                let log_group = ctx.param_str(params, "logGroupName")?;
                let log_stream = ctx.param_str(params, "logStreamName")?;
                let message = ctx.param_str(params, "message")?;
                let sequence_token = ctx
                    .param_str_opt(params, "sequenceToken")
                    .filter(|s| !s.is_empty());
                let now_ms = Utc::now().timestamp_millis();
                let mut body = serde_json::Map::new();
                body.insert("logGroupName".into(), json!(log_group));
                body.insert("logStreamName".into(), json!(log_stream));
                body.insert(
                    "logEvents".into(),
                    json!([{ "timestamp": now_ms, "message": message }]),
                );
                if let Some(tok) = sequence_token {
                    body.insert("sequenceToken".into(), json!(tok));
                }
                logs_call(ctx, &creds, "Logs_20140328.PutLogEvents", Value::Object(body)).await
            }
            "describeLogStreams" => {
                let log_group = ctx.param_str(params, "logGroupName")?;
                logs_call(
                    ctx,
                    &creds,
                    "Logs_20140328.DescribeLogStreams",
                    json!({ "logGroupName": log_group }),
                )
                .await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// POST a CloudWatch Logs JSON request (service `logs`, AWS JSON 1.1).
async fn logs_call(
    ctx: &mut ExecutionContext,
    creds: &AwsCreds,
    target: &str,
    body: Value,
) -> NodeResult<NodeOutput> {
    let url: reqwest::Url = format!("https://logs.{}.amazonaws.com/", creds.region)
        .parse()
        .map_err(|e| NodeError::Other(format!("AWS CloudWatch Logs: bad URL: {e}")))?;
    let body_bytes = serde_json::to_vec(&body)?;
    let mut headers = HeaderMap::new();
    headers.insert(
        "content-type",
        HeaderValue::from_static("application/x-amz-json-1.1"),
    );
    headers.insert(
        "x-amz-target",
        HeaderValue::from_str(target)
            .map_err(|e| NodeError::Other(format!("AWS CloudWatch Logs: {e}")))?,
    );

    let req = sign_request(SignParams {
        method: Method::POST,
        url,
        extra_headers: headers,
        body: body_bytes,
        region: &creds.region,
        service: "logs",
        access_key_id: &creds.access_key_id,
        secret_access_key: &creds.secret_access_key,
        session_token: creds.session_token.as_deref(),
        now: Utc::now(),
    })?;
    let resp = ctx.http.execute(req).await?;
    let status = resp.status();
    let text = resp.text().await?;
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
    Ok(NodeOutput::single(vec![parsed]))
}
