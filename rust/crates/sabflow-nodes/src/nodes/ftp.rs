//! FTP / SFTP node.
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! TODO(sabflow): pull in `async-ftp` (for plain FTP) and `russh-sftp` (for
//! SFTP over SSH) and implement the operations below. They are deferred for
//! now because they require additional workspace dependencies and the
//! workspace already pulls in a sizeable async runtime; we want to land the
//! UI registration first so users can see the node in the picker.

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

pub struct FtpNode;

#[async_trait]
impl Node for FtpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "ftp",
            "FTP",
            "Transfer files via FTP or SFTP",
            NodeCategory::Storage,
        )
        .icon("server")
        .color("#94a3b8")
        .credentials(vec![CredentialBinding {
            name: "ftpApi".into(),
            display_name: "FTP / SFTP".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "List Directory".into(),
                        value: json!("listDirectory"),
                        description: Some("List the contents of a remote directory".into()),
                    },
                    NodePropertyOption {
                        name: "Download File".into(),
                        value: json!("download"),
                        description: Some("Download a remote file (returns base64)".into()),
                    },
                    NodePropertyOption {
                        name: "Upload File".into(),
                        value: json!("upload"),
                        description: Some("Upload a file (content is base64)".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a remote file".into()),
                    },
                    NodePropertyOption {
                        name: "Create Directory".into(),
                        value: json!("createDirectory"),
                        description: Some("Create a remote directory".into()),
                    },
                    NodePropertyOption {
                        name: "Rename".into(),
                        value: json!("rename"),
                        description: Some("Rename or move a remote file".into()),
                    },
                ])
                .default(json!("listDirectory"))
                .required(),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .placeholder("/uploads/report.pdf")
                .description("Path on the remote server")
                .show_when(
                    "operation",
                    &[
                        "listDirectory",
                        "download",
                        "upload",
                        "delete",
                        "createDirectory",
                    ],
                )
                .required(),
            NodeProperty::new("content", "Content (base64)", NodePropertyType::String)
                .description("File contents encoded as base64")
                .show_when("operation", &["upload"])
                .required(),
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
        // TODO(sabflow): wire `async-ftp` (FTP) and `russh-sftp` (SFTP) and
        // dispatch on the credential's `protocol` field. Until then the
        // descriptor is complete so users can configure the node, but
        // execution is intentionally blocked.
        Err(NodeError::NotImplemented(
            "FTP requires async-ftp runtime — TODO".to_string(),
        ))
    }
}
