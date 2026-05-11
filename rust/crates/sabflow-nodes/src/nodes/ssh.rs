//! SSH node.
//!
//! Descriptor is complete (operation, command, credential bindings) so the
//! frontend can render the settings panel and a workflow can be authored
//! against it. The runtime is intentionally stubbed — a real implementation
//! requires the heavyweight `russh` or `ssh2` dependency tree which we
//! don't want to compile into the default workspace yet.

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

pub struct SshNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SshNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "ssh",
            "SSH",
            "Execute SSH commands",
            NodeCategory::Developer,
        )
        .icon("terminal")
        .color("#000000")
        .credentials(vec![CredentialBinding {
            name: "sshApi".into(),
            display_name: "SSH".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Execute Command", "executeCommand"),
                    opt("Upload File", "uploadFile"),
                    opt("Download File", "downloadFile"),
                ])
                .default(json!("executeCommand"))
                .required(),
            NodeProperty::new("command", "Command", NodePropertyType::String)
                .placeholder("uptime")
                .show_when("operation", &["executeCommand"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented(
            "SSH requires russh/ssh2 runtime — TODO".into(),
        ))
    }
}
