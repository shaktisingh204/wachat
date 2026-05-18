//! SFTP node — `n8n-nodes-base.sftp`.
//!
//! Mirrors the FTP node but speaks SFTP over SSH instead of the legacy FTP
//! control/data channels. The descriptor is fully wired so the SabFlow
//! editor can render this node, but `execute` currently returns a typed
//! `NodeError::NotImplemented("sftp.not_yet_supported")` per the C.3 stub
//! policy.
//!
//! TODO(sabflow): pull in `russh-sftp` (preferred — already-Tokio, no C deps)
//! or `ssh2` as a workspace dep and implement the operations below.

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

pub struct SftpNode;

fn opt(name: &str, value: &str, description: Option<&str>) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: description.map(|s| s.to_string()),
    }
}

#[async_trait]
impl Node for SftpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sftp",
            "SFTP",
            "Transfer files via SFTP (SSH)",
            NodeCategory::Storage,
        )
        .icon("server")
        .color("#64748b")
        .credentials(vec![CredentialBinding {
            name: "sftp".into(),
            display_name: "SFTP".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt(
                        "List Directory",
                        "list",
                        Some("List the contents of a remote directory"),
                    ),
                    opt(
                        "Download",
                        "download",
                        Some("Download a remote file into a binary item"),
                    ),
                    opt(
                        "Upload",
                        "upload",
                        Some("Upload an item's binary entry to the server"),
                    ),
                    opt("Delete", "delete", Some("Delete a remote file")),
                    opt("Rename", "rename", Some("Rename or move a remote file")),
                    opt("Create Directory", "mkdir", Some("Create a remote directory")),
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .placeholder("/uploads/report.pdf")
                .description("Path on the remote server")
                .show_when(
                    "operation",
                    &["list", "download", "upload", "delete", "mkdir"],
                )
                .required(),
            NodeProperty::new(
                "binaryPropertyName",
                "Binary Property Name",
                NodePropertyType::String,
            )
            .default(json!("data"))
            .description("Key on the item's `binary` map (used by download / upload)")
            .show_when("operation", &["download", "upload"]),
            NodeProperty::new("fromPath", "From Path", NodePropertyType::String)
                .placeholder("/uploads/old-name.pdf")
                .show_when("operation", &["rename"])
                .required(),
            NodeProperty::new("toPath", "To Path", NodePropertyType::String)
                .placeholder("/uploads/new-name.pdf")
                .show_when("operation", &["rename"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): wire `russh-sftp` (or `ssh2`) as a workspace dep and
        // dispatch on the selected operation. The descriptor above is the
        // committed surface; execution is intentionally blocked.
        Err(NodeError::NotImplemented("sftp.not_yet_supported".into()))
    }
}
