//! `EntityKey` — enumeration of every linkable entity. Mirrors the TS
//! union in `src/lib/lookup-registry.ts` (currently 18 entries) and the
//! §13.1 master catalogue (broader target — additional entries will be
//! appended here as the registry expands).
//!
//! Keep this in lock-step with the TS `ENTITY_KEYS` array — every
//! variant added here must also be added there (or vice versa) so the
//! `entity_ref` custom-field type and the EntityPicker chip metadata
//! agree across the language boundary.

use serde::{Deserialize, Serialize};

/// Every entity kind the unified lookup endpoint can serve. Values
/// serialize lowercase or camelCase to match the TS string-union (e.g.
/// `"client"`, `"bankAccount"`, `"taxRate"`); using `rename_all =
/// "camelCase"` keeps the wire format byte-compatible with the
/// existing TS clients.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EntityKey {
    /* ---- canonical 18 (from src/lib/lookup-registry.ts) ---------- */
    /// Chart-of-accounts node (`crm_chart_of_accounts`).
    Account,
    /// Payment / bank account (`crm_payment_accounts`).
    BankAccount,
    /// Multi-branch location.
    Branch,
    /// Product category (`crm_product_categories`).
    Category,
    /// CRM Account (the company/client record on `crm_accounts`).
    Client,
    /// Static currency list — no DB; serves the 12 ISO codes.
    Currency,
    /// HR department (`crm_departments`).
    Department,
    /// HR designation (`crm_designations`).
    Designation,
    /// HR Employee (`crm_employees`).
    Employee,
    /// CRM Product / Item (`crm_products`).
    Item,
    /// Sales pipeline (today embedded on `users.crmPipelines`).
    Pipeline,
    /// CRM Project (`crm_projects`).
    Project,
    /// Pipeline stage (today embedded on `users.crmPipelines[].stages`).
    /// Composite id `pipelineId:stageId` when serialized as a value.
    Stage,
    /// Cross-entity tag (collection TBD).
    Tag,
    /// Tax rate (`crm_taxes`).
    TaxRate,
    /// Platform user (`users`).
    User,
    /// CRM Vendor (`crm_vendors`).
    Vendor,
    /// Stock location (`crm_warehouses`).
    Warehouse,
    /* ---- §13.1 expansion targets (not yet in TS registry) -------- */
    /// CRM Lead (`crm_leads`) — §13.1 catalogue, not yet wired in TS.
    Lead,
    /// CRM Contact (`crm_contacts`).
    Contact,
    /// Sales Deal.
    Deal,
    /// Cost center (multi-branch / cost-center plumbing).
    CostCenter,
    /// Document / message template.
    Template,
    /// Lead source value (free-form across tenants).
    Source,
    /// Free-form status code.
    Status,
    /// HSN/SAC code.
    Hsn,
    /// Pincode lookup.
    Pincode,
    /// State (sub-national).
    State,
    /// Country.
    Country,
    /// Fixed asset.
    Asset,
    /// Help-desk ticket.
    Ticket,
    /// Sales invoice.
    Invoice,
    /// Sales quotation.
    Quotation,
    /// Sales order.
    SalesOrder,
    /// Purchase order.
    PurchaseOrder,
    /// Vendor bill.
    Bill,
    /// Payment receipt.
    Receipt,
    /// Discount coupon.
    Coupon,
    /// Subscription plan.
    Plan,
    /// Active subscription.
    Subscription,
    /// Work shift definition.
    Shift,
    /// Holiday calendar entry.
    Holiday,
    /// Product brand (`crm_brands`) — tenant-grown.
    Brand,
    /// Unit of measure — static enum (PCS / KG / L / HRS / ...).
    Unit,
    /// Industry classification — static enum.
    Industry,
    /// Location lookup (TODO: future composition of country / state /
    /// city or dedicated `crm_locations` collection).
    Location,
    /// Vendor classification — static enum (goods / services / both).
    VendorType,
}

impl EntityKey {
    /// Round-trip wire string (mirrors the TS string-union value).
    pub fn as_str(self) -> &'static str {
        // Keep manual to avoid a serde_json round-trip in hot paths.
        match self {
            Self::Account => "account",
            Self::BankAccount => "bankAccount",
            Self::Branch => "branch",
            Self::Category => "category",
            Self::Client => "client",
            Self::Currency => "currency",
            Self::Department => "department",
            Self::Designation => "designation",
            Self::Employee => "employee",
            Self::Item => "item",
            Self::Pipeline => "pipeline",
            Self::Project => "project",
            Self::Stage => "stage",
            Self::Tag => "tag",
            Self::TaxRate => "taxRate",
            Self::User => "user",
            Self::Vendor => "vendor",
            Self::Warehouse => "warehouse",
            Self::Lead => "lead",
            Self::Contact => "contact",
            Self::Deal => "deal",
            Self::CostCenter => "costCenter",
            Self::Template => "template",
            Self::Source => "source",
            Self::Status => "status",
            Self::Hsn => "hsn",
            Self::Pincode => "pincode",
            Self::State => "state",
            Self::Country => "country",
            Self::Asset => "asset",
            Self::Ticket => "ticket",
            Self::Invoice => "invoice",
            Self::Quotation => "quotation",
            Self::SalesOrder => "salesOrder",
            Self::PurchaseOrder => "purchaseOrder",
            Self::Bill => "bill",
            Self::Receipt => "receipt",
            Self::Coupon => "coupon",
            Self::Plan => "plan",
            Self::Subscription => "subscription",
            Self::Shift => "shift",
            Self::Holiday => "holiday",
            Self::Brand => "brand",
            Self::Unit => "unit",
            Self::Industry => "industry",
            Self::Location => "location",
            Self::VendorType => "vendorType",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_through_serde_json() {
        for key in [
            EntityKey::Account,
            EntityKey::BankAccount,
            EntityKey::TaxRate,
            EntityKey::SalesOrder,
            EntityKey::PurchaseOrder,
            EntityKey::CostCenter,
        ] {
            let json = serde_json::to_string(&key).unwrap();
            let back: EntityKey = serde_json::from_str(&json).unwrap();
            assert_eq!(back, key, "round-trip failed for {key:?}");
            // and `as_str` matches the JSON string form (sans quotes).
            let trimmed = json.trim_matches('"');
            assert_eq!(trimmed, key.as_str());
        }
    }

    #[test]
    fn camel_case_serialization() {
        assert_eq!(
            serde_json::to_string(&EntityKey::BankAccount).unwrap(),
            "\"bankAccount\""
        );
        assert_eq!(
            serde_json::to_string(&EntityKey::TaxRate).unwrap(),
            "\"taxRate\""
        );
        assert_eq!(
            serde_json::to_string(&EntityKey::SalesOrder).unwrap(),
            "\"salesOrder\""
        );
    }
}
