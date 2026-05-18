//! LDAP node (substitute for MongoDB in this phase — already implemented).
//!
//! Descriptor is fully wired so the SabFlow editor can render this node and
//! its settings panel, but `execute` currently returns `NotImplemented`.
//!
//! TODO(sabflow): pull in `ldap3` (the async LDAP client) and implement the
//! operations below. Deferred for this phase because:
//!   1. `ldap3` is not currently a workspace dependency, and the rule for
//!      this phase is "no new top-level deps".
//!   2. LDAP also needs proper STARTTLS / LDAPS handling tied to the
//!      workspace TLS story (rustls), which we want to wire once across
//!      every directory-service node.
//!
//! Until then the descriptor is complete so users can configure the node;
//! execution intentionally errors out.

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

pub struct LdapApiNode;

#[async_trait]
impl Node for LdapApiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "ldap",
            "LDAP",
            "Search, bind, add, modify, and delete LDAP directory entries",
            NodeCategory::Developer,
        )
        .icon("database")
        .color("#0072C6")
        .credentials(vec![CredentialBinding {
            name: "ldap".into(),
            display_name: "LDAP Server".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Search".into(),
                        value: json!("search"),
                        description: Some("Search the directory tree".into()),
                    },
                    NodePropertyOption {
                        name: "Compare".into(),
                        value: json!("compare"),
                        description: Some("Compare an attribute value".into()),
                    },
                    NodePropertyOption {
                        name: "Add".into(),
                        value: json!("add"),
                        description: Some("Add a new entry".into()),
                    },
                    NodePropertyOption {
                        name: "Modify".into(),
                        value: json!("modify"),
                        description: Some("Modify an existing entry".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete an entry by DN".into()),
                    },
                    NodePropertyOption {
                        name: "Rename".into(),
                        value: json!("rename"),
                        description: Some("Rename / move an entry (modDN)".into()),
                    },
                ])
                .default(json!("search"))
                .required(),
            NodeProperty::new("baseDn", "Base DN", NodePropertyType::String)
                .placeholder("ou=people,dc=example,dc=com")
                .show_when("operation", &["search"])
                .required(),
            NodeProperty::new("filter", "Search Filter", NodePropertyType::String)
                .placeholder("(uid=alice)")
                .default(json!("(objectClass=*)"))
                .show_when("operation", &["search"]),
            NodeProperty::new("scope", "Scope", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Base".into(),
                        value: json!("base"),
                        description: Some("Only the base entry".into()),
                    },
                    NodePropertyOption {
                        name: "One Level".into(),
                        value: json!("one"),
                        description: Some("Direct children of the base entry".into()),
                    },
                    NodePropertyOption {
                        name: "Subtree".into(),
                        value: json!("sub"),
                        description: Some("The base entry and all its descendants".into()),
                    },
                ])
                .default(json!("sub"))
                .show_when("operation", &["search"]),
            NodeProperty::new("attributes", "Attributes", NodePropertyType::String)
                .placeholder("cn,mail,uid")
                .description("Comma-separated attribute names — empty = all")
                .show_when("operation", &["search"]),
            NodeProperty::new("dn", "Entry DN", NodePropertyType::String)
                .placeholder("uid=alice,ou=people,dc=example,dc=com")
                .show_when("operation", &["compare", "add", "modify", "delete", "rename"])
                .required(),
            NodeProperty::new("attribute", "Attribute", NodePropertyType::String)
                .placeholder("mail")
                .show_when("operation", &["compare"]),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("alice@example.com")
                .show_when("operation", &["compare"]),
            NodeProperty::new("entry", "Entry Attributes", NodePropertyType::Json)
                .description("Object of attribute → value (or array of values)")
                .default(json!({}))
                .show_when("operation", &["add", "modify"]),
            NodeProperty::new("newDn", "New DN", NodePropertyType::String)
                .placeholder("uid=alice,ou=archived,dc=example,dc=com")
                .show_when("operation", &["rename"]),
        ])
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // TODO(sabflow): implement using `ldap3` once it's added to the
        // workspace. Until then surface a clear error so users can see the
        // node is registered but inactive.
        Err(NodeError::NotImplemented(
            "LDAP node requires the ldap3 driver (deferred — no new top-level deps in this phase)".to_string(),
        ))
    }
}
