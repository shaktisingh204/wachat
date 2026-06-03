//! §3.2 Warehouses.
//!
//! Mongo collection: `crm_warehouses`. A warehouse is the physical (or
//! virtual) bucket every stock-on-hand row in §3 attaches to. The struct
//! flattens the standard `crm-core` cross-cutting fragments (`Identity`,
//! `Audit`) so the Mongo document root carries the §0 ownership / audit
//! fields directly.
//!
//! ## Modeling notes
//!
//! - `WarehouseType` covers the five flavours called out in §3.2:
//!   `main`, `branch`, `franchise`, `third_party_logistics`, `virtual`.
//!   The spec slug for a 3PL is `3pl`, but Rust enum variants can't
//!   start with a digit and the round-trip JSON value just needs to be
//!   stable; we therefore serialize the variant via the standard
//!   `snake_case` rule (`third_party_logistics`) for clean
//!   round-tripping with the TS shape.
//! - `Capacity` is a `{ value, unit }` pair where `unit` is free-text —
//!   different warehouses measure space differently (`"units"`,
//!   `"sqft"`, `"cbm"`, …); enforcing a closed enum here would force
//!   migrations every time ops invents a new measure.
//! - `manager_id` is an FK into the user collection (the assigned
//!   warehouse manager); `manager_phone` is captured separately because
//!   a manager's contact phone for warehouse comms is sometimes a
//!   warehouse-specific extension rather than the user's profile phone.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity, Tags};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

/// Kind of warehouse — drives availability rules (e.g. `Virtual` is
/// a logical bucket for in-transit / consigned goods, never physically
/// counted) and downstream UX filters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarehouseType {
    #[default]
    Main,
    Branch,
    Franchise,
    /// Third-party logistics provider. Spec slug is `3pl`; we serialize
    /// as `third_party_logistics` for valid Rust + readable JSON.
    ThirdPartyLogistics,
    Virtual,
}

/// Free-form storage capacity (`unit` is a free-text label —
/// `"units"`, `"sqft"`, `"cbm"`, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capacity {
    pub value: f64,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warehouse {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- core identity ----------------------------------------- */
    /// ★ required — display name ("Mumbai Central", "Pune Hub").
    pub name: String,
    /// ★ required — short unique code used in stock-document line refs
    /// ("MUM-CEN", "PUN-HUB"). Project-scoped uniqueness is enforced at
    /// the action layer, not the type layer.
    pub code: String,

    /* ----- classification ---------------------------------------- */
    #[serde(default)]
    pub r#type: WarehouseType,

    /* ----- location + tax --------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Address>,
    /// India-specific GSTIN for the warehouse's registered address.
    /// Drives place-of-supply on outward stock transfers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,

    /* ----- people ------------------------------------------------ */
    /// FK into the user collection — the assigned warehouse manager.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,
    /// Contact phone for warehouse-specific comms (may differ from the
    /// manager's profile phone — e.g. a desk extension).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_phone: Option<String>,

    /* ----- physical attributes ----------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity: Option<Capacity>,
    /// True if the warehouse has temperature/humidity control (cold
    /// chain, pharma, perishables). Drives item-warehouse compatibility
    /// checks at stock-transfer time.
    #[serde(default, skip_serializing_if = "is_false")]
    pub climate_controlled: bool,

    /* ----- workflow flags ---------------------------------------- */
    /// Soft-disable: inactive warehouses still appear in historical
    /// reports but can't be selected as a destination on new docs.
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub active: bool,
    /// If set, this warehouse is auto-selected on new stock documents
    /// for the parent project. Exactly one warehouse per project should
    /// carry this flag (enforced at the action layer).
    #[serde(default, skip_serializing_if = "is_false")]
    pub default_for_project: bool,

    /* ----- tags -------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
}

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let wh = Warehouse {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit {
                created_at: now,
                updated_at: now,
                created_by: None,
                updated_by: None,
            },
            name: "Mumbai Central".to_string(),
            code: "MUM-CEN".to_string(),
            r#type: WarehouseType::ThirdPartyLogistics,
            address: Some(Address::default()),
            gstin: Some("27AABCU9603R1ZM".to_string()),
            manager_id: Some(ObjectId::new()),
            manager_phone: Some("+91-9999999999".to_string()),
            capacity: Some(Capacity {
                value: 12_500.0,
                unit: "sqft".to_string(),
            }),
            climate_controlled: true,
            active: true,
            default_for_project: false,
            tags: Tags::from_iter(["primary", "metro"]),
        };

        let json = serde_json::to_value(&wh).unwrap();

        // Flattened §0 fragments at root.
        assert!(json.get("_id").is_some(), "_id at root");
        assert!(json.get("projectId").is_some(), "projectId at root");
        assert!(json.get("userId").is_some(), "userId at root");
        assert!(json.get("createdAt").is_some(), "createdAt at root");
        assert!(json.get("updatedAt").is_some(), "updatedAt at root");

        // No nested fragment keys leaked.
        assert!(json.get("identity").is_none(), "identity must not nest");
        assert!(json.get("audit").is_none(), "audit must not nest");

        // Entity fields camelCased.
        assert_eq!(
            json.get("name").and_then(|v| v.as_str()),
            Some("Mumbai Central")
        );
        assert_eq!(json.get("code").and_then(|v| v.as_str()), Some("MUM-CEN"));
        assert!(json.get("managerId").is_some());
        assert!(json.get("managerPhone").is_some());
        assert_eq!(
            json.get("climateControlled").and_then(|v| v.as_bool()),
            Some(true),
        );
        assert!(
            json.get("defaultForProject").is_none(),
            "false bool skipped"
        );

        // Enum serialization: snake_case multi-word variant.
        assert_eq!(
            json.get("type").and_then(|v| v.as_str()),
            Some("third_party_logistics"),
        );

        // Capacity round-trips as { value, unit }.
        let cap = json.get("capacity").expect("capacity present");
        assert_eq!(cap.get("value").and_then(|v| v.as_f64()), Some(12_500.0));
        assert_eq!(cap.get("unit").and_then(|v| v.as_str()), Some("sqft"));

        // Round-trip back into the struct.
        let back: Warehouse = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Mumbai Central");
        assert_eq!(back.r#type, WarehouseType::ThirdPartyLogistics);
        assert_eq!(back.tags.len(), 2);
        assert!(back.climate_controlled);
        assert!(back.active);
    }
}
