//! Wire-format DTOs for the SabChat → SabFlow bridge.
//!
//! Two distinct families live here:
//!
//! 1. **Node descriptors** ([`NodeDescriptor`] + friends) — the JSON
//!    blob SabFlow's executor reads at boot (or via `GET /nodes`) to
//!    register the SabChat triggers and actions. The shape is a
//!    deliberately minimal subset of the `sabflow-nodes` crate's
//!    descriptor — we do **not** import that crate (per the slice
//!    contract) and instead publish our own serde-shaped DTO. The
//!    `category` / `propertyType` discriminants match the strings
//!    SabFlow's executor recognises (`"trigger"`, `"action"`, …).
//!
//! 2. **Action bodies** ([`SendMessageBody`], [`AddLabelBody`], …) —
//!    the request payloads SabFlow's executor POSTs when it fires an
//!    action node. Every body is `rename_all = "camelCase"` so JSON
//!    from the executor round-trips cleanly into Rust.
//!
//! Tenancy is **never** carried on the wire — it is always derived from
//! the calling JWT (`auth.tenant_id`). The executor is expected to mint
//! a service JWT scoped to the workflow's tenant before calling us.

use sabchat_types::{ConversationPriority, ConversationStatus};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// NodeDescriptor — published shape for SabFlow's executor / UI
// ===========================================================================

/// Top-level node bucket. Matches the SabFlow executor's known
/// categories on the wire (`"trigger"` / `"action"`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum NodeCategory {
    /// Event-driven entry point — SabFlow subscribes to these via
    /// webhook / polling and starts a workflow run on each emission.
    Trigger,
    /// Imperative side-effect node — SabFlow's executor POSTs to the
    /// matching action endpoint to fire it.
    Action,
}

/// Form-field types the SabFlow UI knows how to render. We deliberately
/// expose only the subset the SabChat nodes actually use today — every
/// other property type lives in `sabflow-nodes` and is invisible to the
/// bridge.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum NodePropertyType {
    /// Free-form single-line string.
    String,
    /// Long-form / multi-line string (rendered as a textarea).
    Text,
    /// Enum-of-strings — must be paired with a non-empty
    /// [`NodeProperty::options`] list.
    Options,
    /// Boolean toggle.
    Boolean,
    /// Opaque JSON object — the UI exposes a code editor.
    Json,
    /// Hex `ObjectId` reference — the UI may decorate this with a
    /// picker but accepts a plain string on the wire.
    Id,
}

/// One option in an [`NodePropertyType::Options`] dropdown.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NodePropertyOption {
    /// Stable wire value (e.g. `"open"`).
    pub value: String,
    /// Human label shown in the UI (e.g. `"Open"`).
    pub label: String,
}

impl NodePropertyOption {
    pub fn new(value: &str, label: &str) -> Self {
        Self {
            value: value.to_owned(),
            label: label.to_owned(),
        }
    }
}

/// One settings-panel property exposed by a node.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NodeProperty {
    /// Stable name — matches the action body's JSON key.
    pub name: String,
    /// Human label shown in the settings panel.
    pub display_name: String,
    #[serde(rename = "type")]
    pub property_type: NodePropertyType,
    #[serde(default)]
    pub required: bool,
    /// Short helper string rendered under the input.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Placeholder shown for empty inputs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    /// Available choices when `property_type == Options`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<NodePropertyOption>,
}

impl NodeProperty {
    pub fn new(name: &str, display_name: &str, ty: NodePropertyType) -> Self {
        Self {
            name: name.to_owned(),
            display_name: display_name.to_owned(),
            property_type: ty,
            required: false,
            description: None,
            placeholder: None,
            options: Vec::new(),
        }
    }
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
    pub fn description(mut self, d: &str) -> Self {
        self.description = Some(d.to_owned());
        self
    }
    pub fn placeholder(mut self, p: &str) -> Self {
        self.placeholder = Some(p.to_owned());
        self
    }
    pub fn options(mut self, opts: Vec<NodePropertyOption>) -> Self {
        self.options = opts;
        self
    }
}

/// One published node — either a SabChat trigger or a SabChat action.
///
/// The shape is intentionally stable: SabFlow's executor reads this at
/// boot and binds the descriptor's `name` to either a webhook listener
/// (when `is_trigger == true`) or to one of the `actionPath` HTTP
/// endpoints (when `is_trigger == false`).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NodeDescriptor {
    /// Stable identifier (e.g. `"sabchat.action.send_message"`).
    pub name: String,
    /// Human label shown in the picker.
    pub display_name: String,
    /// Short tagline shown under the label.
    pub description: String,
    /// Top-level grouping.
    pub category: NodeCategory,
    /// Semantic version of the node implementation.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Icon name (Lucide / Phosphor).
    #[serde(default)]
    pub icon: String,
    /// Tile color (CSS).
    #[serde(default)]
    pub color: String,
    /// `true` for trigger nodes — these have no input port.
    #[serde(default)]
    pub is_trigger: bool,
    /// Event name the trigger emits — only meaningful when
    /// `is_trigger == true`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    /// HTTP method + path SabFlow's executor calls — only meaningful
    /// when `is_trigger == false`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_method: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_path: Option<String>,
    /// Configurable properties displayed in the settings panel.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub properties: Vec<NodeProperty>,
    /// Sample event payload — surfaced in the UI so workflow authors
    /// can reference output fields without firing the trigger first.
    /// Only meaningful for triggers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample: Option<Value>,
}

fn default_version() -> u32 {
    1
}

impl NodeDescriptor {
    /// Construct a trigger descriptor. `event` is the canonical event
    /// name SabFlow's executor binds against.
    pub fn trigger(name: &str, display_name: &str, description: &str, event: &str) -> Self {
        Self {
            name: name.to_owned(),
            display_name: display_name.to_owned(),
            description: description.to_owned(),
            category: NodeCategory::Trigger,
            version: 1,
            icon: String::new(),
            color: String::new(),
            is_trigger: true,
            event: Some(event.to_owned()),
            action_method: None,
            action_path: None,
            properties: Vec::new(),
            sample: None,
        }
    }

    /// Construct an action descriptor. `method` + `path` are the HTTP
    /// entry point SabFlow's executor POSTs to when it fires this node.
    pub fn action(
        name: &str,
        display_name: &str,
        description: &str,
        method: &str,
        path: &str,
    ) -> Self {
        Self {
            name: name.to_owned(),
            display_name: display_name.to_owned(),
            description: description.to_owned(),
            category: NodeCategory::Action,
            version: 1,
            icon: String::new(),
            color: String::new(),
            is_trigger: false,
            event: None,
            action_method: Some(method.to_owned()),
            action_path: Some(path.to_owned()),
            properties: Vec::new(),
            sample: None,
        }
    }

    pub fn icon(mut self, icon: &str) -> Self {
        self.icon = icon.to_owned();
        self
    }
    pub fn color(mut self, color: &str) -> Self {
        self.color = color.to_owned();
        self
    }
    pub fn properties(mut self, p: Vec<NodeProperty>) -> Self {
        self.properties = p;
        self
    }
    pub fn sample(mut self, sample: Value) -> Self {
        self.sample = Some(sample);
        self
    }
}

// ===========================================================================
// `GET /nodes`
// ===========================================================================

/// Response body for `GET /v1/sabchat/sabflow/nodes`. The executor reads
/// this on boot; the UI reads it whenever the block picker opens.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NodesResponse {
    pub nodes: Vec<NodeDescriptor>,
}

// ===========================================================================
// Action bodies
// ===========================================================================

/// Body for `POST /actions/send-message` — append a bot/agent message
/// to a conversation. `private == true` posts a private note.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageBody {
    /// Target conversation (hex `ObjectId`). Must belong to the calling
    /// tenant.
    pub conversation_id: String,
    /// Plain-text body. Carousels / cards / etc. are intentionally not
    /// modelled in the SabFlow MVP — the executor fires the message as
    /// a plain `text` block.
    pub text: String,
    /// `true` writes the message as a private note (agent-only).
    /// Defaults to `false`.
    #[serde(default)]
    pub private: bool,
}

/// Body for `POST /actions/add-label`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddLabelBody {
    pub conversation_id: String,
    pub label: String,
}

/// Body for `POST /actions/set-status`. The conversation lifecycle
/// status to apply. Transition side-effects mirror
/// `sabchat-conversations` (`resolved` stamps `resolvedAt`, `open`
/// clears `resolvedAt` + `snoozeUntil`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetStatusBody {
    pub conversation_id: String,
    pub status: ConversationStatus,
}

/// Body for `POST /actions/set-priority`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetPriorityBody {
    pub conversation_id: String,
    pub priority: ConversationPriority,
}

/// Body for `POST /actions/set-assignee`. `assignee_id == None` (or an
/// empty string) clears the current assignment.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetAssigneeBody {
    pub conversation_id: String,
    #[serde(default)]
    pub assignee_id: Option<String>,
}

/// Body for `POST /actions/run-macro`. `vars` is passed through to the
/// macro's `{{var}}` interpolation bag (request vars override the
/// conversation's `customAttrs`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunMacroBody {
    pub conversation_id: String,
    pub macro_id: String,
    #[serde(default)]
    pub vars: Option<Value>,
}

// ===========================================================================
// Action responses
// ===========================================================================

/// Stripped-down envelope returned by every `/actions/*` endpoint. The
/// executor only cares about success / failure — the action result
/// surfaces via the audit log + the conversation's updated state, which
/// downstream nodes can re-read.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActionAck {
    pub ok: bool,
    /// Optional opaque id (e.g. the new message's `_id`) — populated by
    /// endpoints that create a new document so the executor can pass
    /// the id into a follow-up node.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

impl ActionAck {
    pub fn ok() -> Self {
        Self { ok: true, id: None }
    }
    pub fn with_id(id: String) -> Self {
        Self {
            ok: true,
            id: Some(id),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn descriptor_trigger_serialises_with_event() {
        let d = NodeDescriptor::trigger(
            "sabchat.conversation.created",
            "Conversation created",
            "Fires when a new SabChat conversation is opened.",
            "sabchat.conversation.created",
        );
        let v = serde_json::to_value(&d).unwrap();
        assert_eq!(v["category"], "trigger");
        assert_eq!(v["isTrigger"], true);
        assert_eq!(v["event"], "sabchat.conversation.created");
        assert!(v.get("actionPath").is_none());
    }

    #[test]
    fn descriptor_action_serialises_with_path() {
        let d = NodeDescriptor::action(
            "sabchat.action.send_message",
            "Send SabChat message",
            "Append a message to a SabChat conversation.",
            "POST",
            "/v1/sabchat/sabflow/actions/send-message",
        );
        let v = serde_json::to_value(&d).unwrap();
        assert_eq!(v["category"], "action");
        assert_eq!(v["actionMethod"], "POST");
        assert_eq!(v["actionPath"], "/v1/sabchat/sabflow/actions/send-message",);
        assert!(v.get("event").is_none());
    }

    #[test]
    fn options_round_trip() {
        let p = NodeProperty::new("status", "Status", NodePropertyType::Options)
            .required()
            .options(vec![
                NodePropertyOption::new("open", "Open"),
                NodePropertyOption::new("resolved", "Resolved"),
            ]);
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["type"], "options");
        assert_eq!(v["required"], true);
        assert_eq!(v["options"][0]["value"], "open");
    }
}
