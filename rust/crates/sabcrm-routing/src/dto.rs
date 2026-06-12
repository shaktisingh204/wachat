//! Wire-format DTOs for the SabCRM assignment-routing HTTP surface.
//!
//! Mirrors the persisted `sabcrm_routing_rules` document shape (see the crate
//! docs). List / single responses are typed as `serde_json::Value` — the
//! stored document is returned verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`), matching the sibling
//! `sabcrm-approvals` wire convention.
//!
//! [`RuleCondition`] reuses the **workflow condition model** — the same
//! `{ field, operator, value }` triple and operator vocabulary the SabCRM
//! workflow runtime evaluates (`src/lib/sabcrm/runtime.ts` `evalCondition`):
//! `eq` / `ne` / `in` / `nin` / `contains` / `notContains` / `gt` / `gte` /
//! `lt` / `lte` / `isEmpty` / `isNotEmpty` (plus the `==` / `!=` / `equals` /
//! `notEquals` / `notIn` aliases). Evaluation here is against the record's
//! flat `data` map rather than a workflow context.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// Typed rule shape
// ===========================================================================

/// What fires a routing rule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum RuleTrigger {
    /// A record was created through the SabCRM record surface.
    #[serde(rename = "record.created")]
    RecordCreated,
    /// A form submission was converted into a record.
    #[serde(rename = "form.submission")]
    FormSubmission,
}

/// How an assignee is picked from `assignees`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RuleStrategy {
    /// Rotate through `assignees` in order (cursor: `lastAssignedIndex`,
    /// persisted atomically).
    RoundRobin,
    /// Pick the assignee currently holding the fewest records on this object
    /// (counted by `data.<assignField>` in `sabcrm_records`).
    LeastAssigned,
    /// Always the first entry of `assignees`.
    Fixed,
}

/// One `{ field, operator, value }` condition — the workflow condition model
/// (same operators as the workflow `filter` / `if_else` steps, incl.
/// `eq` / `ne` / `in` / `contains`). `field` is a dotted path into the
/// record's `data` map.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RuleCondition {
    /// Dotted path read from the record `data` (e.g. `source`, `company.size`).
    pub field: String,
    /// Operator slug — see the module docs for the vocabulary. Defaults `eq`.
    #[serde(default = "default_operator")]
    pub operator: String,
    /// RHS the field value is compared against. Membership operators accept
    /// an array or a CSV string.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub value: Option<Value>,
}

fn default_operator() -> String {
    "eq".to_owned()
}

/// The default field assignment writes to (`data.owner`).
pub fn default_assign_field() -> String {
    "owner".to_owned()
}

fn default_true() -> bool {
    true
}

// ===========================================================================
// CRUD inputs
// ===========================================================================

/// `GET /` query params — list the routing rules for one project, optionally
/// narrowed by object slug / trigger / active flag, in priority order.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Narrow to one funnel object slug (e.g. `"leads"`).
    #[serde(default)]
    pub object_slug: Option<String>,
    /// Narrow to one trigger (`record.created` / `form.submission`).
    #[serde(default)]
    pub trigger: Option<String>,
    /// Narrow to active (`true`) / inactive (`false`) rules.
    #[serde(default)]
    pub active: Option<bool>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a routing rule. Server-set: `_id`,
/// `lastAssignedIndex` (0), `createdAt`, `updatedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human label — required, non-empty.
    pub name: String,
    /// Funnel object slug this rule targets (e.g. `"leads"`).
    pub object_slug: String,
    /// What fires the rule. Defaults to `record.created`.
    #[serde(default)]
    pub trigger: Option<RuleTrigger>,
    /// Conditions ANDed against the record `data`. Defaults to `[]`
    /// (an unconditional rule — matches every record).
    #[serde(default)]
    pub conditions: Option<Vec<RuleCondition>>,
    /// Assignee-picking strategy. Defaults to `round_robin`.
    #[serde(default)]
    pub strategy: Option<RuleStrategy>,
    /// Member user-ids assignment rotates over — required, non-empty.
    pub assignees: Vec<String>,
    /// Record `data.<key>` the assignee is written to. Defaults to `owner`.
    #[serde(default)]
    pub assign_field: Option<String>,
    /// Whether the rule participates in evaluation. Defaults to `true`.
    #[serde(default = "default_true")]
    pub active: bool,
    /// Priority order — lower runs first. Defaults to `0`.
    #[serde(default)]
    pub position: Option<i64>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id` / `lastAssignedIndex`) is `$set` verbatim;
/// `updatedAt` is always bumped. Typed fields are validated when present.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// `POST /evaluate` body — apply the first matching active rule to one record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Funnel object slug the record belongs to (e.g. `"leads"`).
    pub object_slug: String,
    /// Hex `_id` of the record to route (in `sabcrm_records`).
    pub record_id: String,
    /// Which trigger's rules to consider. Defaults to `record.created`.
    #[serde(default)]
    pub trigger: Option<RuleTrigger>,
}

// ===========================================================================
// Responses
// ===========================================================================

/// Response body for `GET /` — the project's rules in priority order.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub rules: Vec<Value>,
}

/// Response body for `GET /{id}` / `POST /` / `PATCH /{id}` — a single raw
/// rule document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RuleResponse {
    #[schema(value_type = Object)]
    pub rule: Value,
}

/// Response body for `POST /evaluate`. `matched: false` (everything else
/// absent) means no active rule's conditions accepted the record — the record
/// is left untouched.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateResponse {
    /// Whether a rule matched and an assignment was written.
    pub matched: bool,
    /// Hex id of the applied rule.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
    /// Name of the applied rule.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_name: Option<String>,
    /// Member user-id that was assigned.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    /// Record `data.<key>` the assignee was written to.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assign_field: Option<String>,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// tests — serde defaults + trigger/strategy slugs stay stable
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Trigger slugs round-trip verbatim (dotted, not snake_case).
    #[test]
    fn trigger_slugs_round_trip() {
        let cases = [
            ("record.created", RuleTrigger::RecordCreated),
            ("form.submission", RuleTrigger::FormSubmission),
        ];
        for (slug, expected) in cases {
            let t: RuleTrigger = serde_json::from_value(json!(slug)).expect("parse");
            assert_eq!(t, expected);
            assert_eq!(serde_json::to_value(&t).expect("ser"), json!(slug));
        }
    }

    /// Strategy slugs are snake_case and round-trip.
    #[test]
    fn strategy_slugs_round_trip() {
        let cases = [
            ("round_robin", RuleStrategy::RoundRobin),
            ("least_assigned", RuleStrategy::LeastAssigned),
            ("fixed", RuleStrategy::Fixed),
        ];
        for (slug, expected) in cases {
            let s: RuleStrategy = serde_json::from_value(json!(slug)).expect("parse");
            assert_eq!(s, expected);
            assert_eq!(serde_json::to_value(&s).expect("ser"), json!(slug));
        }
    }

    /// Create-input defaults: trigger `record.created`, strategy
    /// `round_robin`, assignField `owner`, active `true`, position `0`,
    /// conditions `[]` — the persisted shape the evaluator depends on.
    #[test]
    fn create_input_defaults() {
        let input: CreateRuleInput = serde_json::from_value(json!({
            "projectId": "p1",
            "name": "Inbound leads",
            "objectSlug": "leads",
            "assignees": ["u1", "u2"]
        }))
        .expect("parse");
        assert!(input.trigger.is_none(), "trigger defaults at the handler");
        assert!(input.strategy.is_none(), "strategy defaults at the handler");
        assert!(input.assign_field.is_none(), "assignField defaults at the handler");
        assert!(input.active, "active must default to true");
        assert!(input.position.is_none());
        assert!(input.conditions.is_none());
        assert_eq!(default_assign_field(), "owner");
    }

    /// A condition without an operator defaults to `eq`; `value` is optional.
    #[test]
    fn condition_defaults() {
        let c: RuleCondition =
            serde_json::from_value(json!({ "field": "source" })).expect("parse");
        assert_eq!(c.operator, "eq");
        assert!(c.value.is_none());
    }

    /// Conditions round-trip camelCase with the workflow operator set.
    #[test]
    fn condition_round_trips() {
        let c: RuleCondition = serde_json::from_value(json!({
            "field": "source",
            "operator": "in",
            "value": ["web", "ads"]
        }))
        .expect("parse");
        assert_eq!(c.operator, "in");
        assert_eq!(c.value, Some(json!(["web", "ads"])));
        let back = serde_json::to_value(&c).expect("ser");
        assert_eq!(
            back,
            json!({ "field": "source", "operator": "in", "value": ["web", "ads"] })
        );
    }
}
