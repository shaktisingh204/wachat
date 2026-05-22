//! Node descriptors — declarative metadata each node exposes so the engine
//! can dispatch correctly and the frontend can render a generic settings UI.

use serde::{Deserialize, Serialize};

/// Top-level category buckets surfaced in the block picker.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum NodeCategory {
    Trigger,
    Action,
    Logic,
    Transform,
    Ai,
    Communication,
    Productivity,
    Crm,
    Marketing,
    Developer,
    Database,
    Storage,
    Analytics,
    Files,
    Sales,
    Finance,
    Hr,
    Misc,
}

/// Form-field types the frontend knows how to render.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NodePropertyType {
    String,
    Number,
    Boolean,
    Options,
    MultiOptions,
    Json,
    Code,
    Expression,
    Credential,
    Collection,
    DateTime,
    Color,
    Hidden,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodePropertyOption {
    pub name: String,
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeProperty {
    pub name: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub property_type: NodePropertyType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<NodePropertyOption>,
    /// Visibility predicate: this property only shows when the named property
    /// equals one of the listed values.  Encoded as `{ "operation": ["create", "update"] }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_options: Option<serde_json::Value>,
    #[serde(default)]
    pub required: bool,
    /// For Collection / MultiOptions properties — the sub-property schema.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<NodeProperty>,
}

impl NodeProperty {
    pub fn new(name: &str, display_name: &str, ty: NodePropertyType) -> Self {
        Self {
            name: name.to_string(),
            display_name: display_name.to_string(),
            property_type: ty,
            default: None,
            description: None,
            placeholder: None,
            options: vec![],
            display_options: None,
            required: false,
            children: vec![],
        }
    }
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
    pub fn default<V: Into<serde_json::Value>>(mut self, v: V) -> Self {
        self.default = Some(v.into());
        self
    }
    pub fn description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
    pub fn placeholder(mut self, p: &str) -> Self {
        self.placeholder = Some(p.to_string());
        self
    }
    pub fn options(mut self, opts: Vec<NodePropertyOption>) -> Self {
        self.options = opts;
        self
    }
    pub fn show_when(mut self, key: &str, vals: &[&str]) -> Self {
        let arr: Vec<serde_json::Value> = vals
            .iter()
            .map(|v| serde_json::Value::String((*v).to_string()))
            .collect();
        let map: serde_json::Map<String, serde_json::Value> =
            std::iter::once((key.to_string(), serde_json::Value::Array(arr))).collect();
        self.display_options = Some(serde_json::Value::Object(map));
        self
    }
}

/// Credentials a node supports. Each entry references a credential type
/// the user has configured in /dashboard/sabflow/connections.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialBinding {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub required: bool,
}

/// Public descriptor of a node — both runtime and UI consume this.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDescriptor {
    /// Stable identifier (e.g. "httpRequest", "slack", "openAi").
    pub name: String,
    /// Human label shown in the picker.
    pub display_name: String,
    /// Short tagline.
    pub description: String,
    /// Top-level grouping.
    pub category: NodeCategory,
    /// Semantic version of the node implementation.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Default-icon hint (Lucide icon name or asset path).
    #[serde(default)]
    pub icon: String,
    /// Tile color (CSS).
    #[serde(default)]
    pub color: String,
    /// Whether this node is a trigger (kicks off a flow).
    #[serde(default)]
    pub is_trigger: bool,
    /// Whether this node receives a connection (false for triggers).
    #[serde(default = "default_inputs_one")]
    pub inputs: u32,
    /// Number of output ports.
    #[serde(default = "default_outputs_one")]
    pub outputs: u32,
    /// Optional named output labels (Switch uses these for case pins).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub output_names: Vec<String>,
    /// Credentials this node can use.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub credentials: Vec<CredentialBinding>,
    /// Configurable properties displayed in the settings panel.
    pub properties: Vec<NodeProperty>,
    /// When true, the node is registered but its runtime returns NotImplemented.
    /// The frontend can still render it (greyed out) so users know it exists.
    #[serde(default)]
    pub stub: bool,
}

fn default_version() -> u32 {
    1
}
fn default_inputs_one() -> u32 {
    1
}
fn default_outputs_one() -> u32 {
    1
}

impl NodeDescriptor {
    pub fn new(name: &str, display_name: &str, description: &str, category: NodeCategory) -> Self {
        Self {
            name: name.to_string(),
            display_name: display_name.to_string(),
            description: description.to_string(),
            category,
            version: 1,
            icon: String::new(),
            color: String::new(),
            is_trigger: false,
            inputs: 1,
            outputs: 1,
            output_names: vec![],
            credentials: vec![],
            properties: vec![],
            stub: false,
        }
    }
    pub fn trigger(mut self) -> Self {
        self.is_trigger = true;
        self.inputs = 0;
        self
    }
    pub fn outputs(mut self, n: u32) -> Self {
        self.outputs = n;
        self
    }
    pub fn output_names(mut self, names: &[&str]) -> Self {
        self.output_names = names.iter().map(|s| (*s).to_string()).collect();
        self
    }
    pub fn icon(mut self, icon: &str) -> Self {
        self.icon = icon.to_string();
        self
    }
    pub fn color(mut self, color: &str) -> Self {
        self.color = color.to_string();
        self
    }
    pub fn credentials(mut self, c: Vec<CredentialBinding>) -> Self {
        self.credentials = c;
        self
    }
    pub fn properties(mut self, p: Vec<NodeProperty>) -> Self {
        self.properties = p;
        self
    }
    pub fn stub(mut self) -> Self {
        self.stub = true;
        self
    }
}
