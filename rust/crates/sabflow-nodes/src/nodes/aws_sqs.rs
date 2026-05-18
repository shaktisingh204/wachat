//! AWS SQS node — send, receive, and delete messages from a queue.
//!
//! Uses the SQS Query API with SigV4 (no `aws-sdk-sqs` dep). Credential
//! schema: `awsApi`.

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
    nodes::{aws_sigv4::AwsCreds, aws_sns::send_query},
};

pub struct AwsSqsNode;

#[async_trait]
impl Node for AwsSqsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsSqs",
            "AWS SQS",
            "Send, receive, and delete messages on Amazon SQS",
            NodeCategory::Developer,
        )
        .icon("inbox")
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
                        name: "Send Message".into(),
                        value: json!("sendMessage"),
                        description: Some("Enqueue a message".into()),
                    },
                    NodePropertyOption {
                        name: "Receive Messages".into(),
                        value: json!("receiveMessage"),
                        description: Some("Long-poll for messages".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Message".into(),
                        value: json!("deleteMessage"),
                        description: Some("Acknowledge a message".into()),
                    },
                    NodePropertyOption {
                        name: "Get Queue Attributes".into(),
                        value: json!("getQueueAttributes"),
                        description: Some("Read queue metadata".into()),
                    },
                ])
                .default(json!("sendMessage"))
                .required(),
            NodeProperty::new("queueUrl", "Queue URL", NodePropertyType::String)
                .placeholder("https://sqs.us-east-1.amazonaws.com/123456789012/my-queue")
                .required(),
            NodeProperty::new("messageBody", "Message Body", NodePropertyType::String)
                .show_when("operation", &["sendMessage"])
                .required(),
            NodeProperty::new("delaySeconds", "Delay (seconds)", NodePropertyType::Number)
                .description("Delivery delay 0–900s (default 0)")
                .default(json!(0))
                .show_when("operation", &["sendMessage"]),
            NodeProperty::new(
                "maxNumberOfMessages",
                "Max Messages",
                NodePropertyType::Number,
            )
            .description("1–10 messages per call (default 1)")
            .default(json!(1))
            .show_when("operation", &["receiveMessage"]),
            NodeProperty::new("waitTimeSeconds", "Wait Time (seconds)", NodePropertyType::Number)
                .description("Long-poll timeout 0–20s (default 0 = short poll)")
                .default(json!(0))
                .show_when("operation", &["receiveMessage"]),
            NodeProperty::new("receiptHandle", "Receipt Handle", NodePropertyType::String)
                .show_when("operation", &["deleteMessage"])
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
        let creds = AwsCreds::from_credential(ctx.credential(&cred_id)?)?;
        let operation = ctx.param_str(params, "operation")?;
        let queue_url = ctx.param_str(params, "queueUrl")?;

        let mut form: Vec<(String, String)> = Vec::new();
        form.push(("Version".into(), "2012-11-05".into()));
        form.push(("QueueUrl".into(), queue_url));

        match operation.as_str() {
            "sendMessage" => {
                form.push(("Action".into(), "SendMessage".into()));
                form.push(("MessageBody".into(), ctx.param_str(params, "messageBody")?));
                if let Some(d) = ctx.param_f64(params, "delaySeconds") {
                    form.push(("DelaySeconds".into(), (d as i64).to_string()));
                }
            }
            "receiveMessage" => {
                form.push(("Action".into(), "ReceiveMessage".into()));
                let max = ctx
                    .param_f64(params, "maxNumberOfMessages")
                    .map(|n| n as i64)
                    .unwrap_or(1)
                    .clamp(1, 10);
                form.push(("MaxNumberOfMessages".into(), max.to_string()));
                if let Some(w) = ctx.param_f64(params, "waitTimeSeconds") {
                    form.push(("WaitTimeSeconds".into(), (w as i64).clamp(0, 20).to_string()));
                }
            }
            "deleteMessage" => {
                form.push(("Action".into(), "DeleteMessage".into()));
                form.push(("ReceiptHandle".into(), ctx.param_str(params, "receiptHandle")?));
            }
            "getQueueAttributes" => {
                form.push(("Action".into(), "GetQueueAttributes".into()));
                form.push(("AttributeName.1".into(), "All".into()));
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        }

        send_query(ctx, &creds, "sqs", form).await
    }
}
