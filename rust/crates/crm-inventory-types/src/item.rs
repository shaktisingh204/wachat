//! §3.1 Items / Products.
//!
//! Mongo collection: `crm_products`. The struct flattens the
//! `crm-core` cross-cutting fragments (`Identity`, `Audit`) so the
//! document root carries the §0 ownership / audit fields directly.
//!
//! An `Item` is the master catalogue record for anything the tenant
//! sells, services or kits — physical goods, billable services and
//! bundles all live here, discriminated by [`ItemType`]. Inventory
//! tracking flags (`track_inventory`, `track_batches`, `track_serials`,
//! `track_expiry`) determine which downstream §3.2 / §3.3 collections
//! the item participates in; a pure service typically has all of them
//! `false`.
//!
//! Image fields are SabFile references — `Vec<ObjectId>` for the
//! gallery and `Option<ObjectId>` for the thumbnail, matching the
//! tenant-wide rule that file media never carries free-form URLs.

use bson::oid::ObjectId;
use crm_core::{Audit, CustomFields, Identity, Tags};
use crm_sales_types::TaxPreference;
use serde::{Deserialize, Serialize};

/// What the catalogue entry represents.
///
/// `Goods` is a stockable physical item; `Service` is a billable but
/// non-stockable line (consulting hours, AMC); `Bundle` is a kit whose
/// component items are tracked separately (the bundle aggregates pricing
/// and presentation but does not itself hold stock).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    #[default]
    Goods,
    Service,
    Bundle,
}

/// Alternate unit of measure with conversion back to the canonical
/// `unit` on the parent item. Example: parent `unit = "BOX"`,
/// `AltUnit { unit: "PCS", conversion_factor: 24.0 }` ⇒ 1 BOX = 24 PCS.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AltUnit {
    pub unit: String,
    /// How many of the canonical `Item::unit` one of this alt unit
    /// equals. Stored as `f64` so fractional conversions (1 KG = 2.205
    /// LB) round-trip cleanly.
    pub conversion_factor: f64,
}

/// Free-form key/value spec row (e.g. "RAM" → "16 GB"). Kept opaque
/// because spec sheets are tenant-defined; structured filters live on
/// `custom_fields` instead.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Specification {
    pub key: String,
    pub value: String,
}

/// Per-warehouse opening stock seed. Captured at item creation when
/// migrating an existing catalogue in; the value is consumed once and
/// is not the live stock figure (live counts live in §3.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpeningStockEntry {
    pub warehouse_id: ObjectId,
    pub qty: f64,
    /// Optional valuation override. If absent the migration job uses
    /// `Item::purchase_price` as the unit cost.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
}

/// Physical extents. `unit` is free-text (`"mm"`, `"cm"`, `"in"`, …)
/// — there is no enum because tenants commonly mix metric and imperial
/// inside the same catalogue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dimensions {
    pub length: f64,
    pub width: f64,
    pub height: f64,
    pub unit: String,
}

/// Per-item user-defined attribute pair. This is distinct from
/// `crm-core::CustomFields`: `CustomAttribute` is intended for
/// catalogue-display attributes (color/size/material variants surfaced
/// to the storefront), while `custom_fields` is the project-wide
/// metadata bag.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAttribute {
    pub key: String,
    pub value: String,
}

/// Helper: default value for `Item::active` so migrations of legacy
/// docs without an explicit `active` field deserialize as `true`.
fn true_default() -> bool {
    true
}

/// Helper: skip-serialize predicate for `Item::active` so the default
/// `true` round-trips silently and only an explicit `false` is written
/// to Mongo.
fn is_true(b: &bool) -> bool {
    *b
}

/// CRM Item / Product master record. Stored in `crm_products`.
///
/// The struct flattens cross-cutting `crm-core` fragments so callers
/// using the BSON serializer get the §0 fields at the document root —
/// no nested wrapper, matching the TS shape. Money fields are `f64`
/// to mirror the TS `Number` JSON shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    /* ----- crm-core fragments (flattened to document root) -------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- type + identification --------------------------------- */
    #[serde(default)]
    pub item_type: ItemType,

    pub name: String,
    pub sku: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub barcode: Option<String>,
    /// Parent item id when this row is a variant (size/color/…).
    /// `None` for standalone items and for the parent of a variant
    /// family.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_of: Option<ObjectId>,

    /* ----- tax codes --------------------------------------------- */
    /// HSN (goods) or SAC (services) code for India GST. Free-text so
    /// the tenant can move codes between revisions without a schema
    /// migration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hsn_sac: Option<String>,
    /// GST rate as a percentage (e.g. `18.0` for 18%).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gst_rate: Option<f32>,
    /// Cess as a percentage stacked on top of GST (e.g. luxury cars).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cess: Option<f32>,

    /* ----- units of measure --------------------------------------- */
    /// Canonical unit. Free-text — tenants ship custom units beyond
    /// the defaults (`"PCS"`, `"KG"`, `"L"`, `"HRS"`, …).
    pub unit: String,
    /// Alternate units with conversion factors back to `unit`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub alt_units: Vec<AltUnit>,
    /// Sub-unit label for split sales (e.g. parent `unit = "DOZEN"`,
    /// `sub_unit = "PCS"`). Free-text; conversions for sub-units are
    /// expressed via `alt_units`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_unit: Option<String>,

    /* ----- branding + classification ----------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand: Option<String>,
    /// Multi-select category ids (FK into the project's category
    /// collection). An item may sit in several categories.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub category: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    /// Manufacturer Part Number — the OEM's own SKU.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mpn: Option<String>,
    /// ISO 3166-1 alpha-2 / alpha-3 / free-text country label —
    /// validation happens at the form layer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country_of_origin: Option<String>,

    /* ----- copy --------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub short_description: Option<String>,
    /// Bullet-point feature list rendered on the storefront.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub features: Vec<String>,
    /// Structured spec rows.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub specifications: Vec<Specification>,

    /* ----- selling price ----------------------------------------- */
    pub selling_price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selling_currency: Option<String>,
    /// Maximum Retail Price (India). Optional — non-MRP markets just
    /// leave this blank.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mrp: Option<f64>,
    /// Default discount percentage applied to `selling_price` at the
    /// line level.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wholesale_price: Option<f64>,
    /// `true` when `selling_price` already includes tax. Default
    /// `false` so plain non-tax-inclusive prices serialize without
    /// the field.
    #[serde(default, skip_serializing_if = "is_false")]
    pub tax_inclusive: bool,

    /* ----- purchase price ---------------------------------------- */
    pub purchase_price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub purchase_currency: Option<String>,
    /// Preferred-vendor list (FK ids into `crm_vendors`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub vendor: Vec<ObjectId>,
    /// Lead time in days from purchase order to receipt.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_time: Option<u32>,

    /* ----- inventory thresholds ---------------------------------- */
    /// Stock level at which a reorder is triggered.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reorder_point: Option<f64>,
    /// Quantity to reorder when `reorder_point` is crossed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reorder_qty: Option<f64>,
    /// Hard ceiling — used by reports + warnings, not enforced.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_stock: Option<f64>,

    /* ----- tracking flags ---------------------------------------- */
    /// Master toggle. If `false` (typical for services) all the other
    /// `track_*` flags are ignored.
    #[serde(default, skip_serializing_if = "is_false")]
    pub track_inventory: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub track_batches: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub track_serials: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub track_expiry: bool,

    /* ----- opening stock ----------------------------------------- */
    /// Per-warehouse seeds, applied once during migration.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub opening_stock: Vec<OpeningStockEntry>,
    /// Aggregate valuation across all warehouses at migration time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_stock_value: Option<f64>,

    /* ----- media (SabFiles refs) --------------------------------- */
    /// Full image set — every entry is a SabFile id. The first entry
    /// is treated as the hero on storefronts that don't read
    /// `thumbnail` separately.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub image: Vec<ObjectId>,
    /// Compact representation for list / grid views.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<ObjectId>,
    /// Storefront gallery (may overlap with `image` — UIs choose).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gallery: Vec<ObjectId>,

    /* ----- physical attributes ----------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<Dimensions>,
    /// Weight in the tenant's preferred mass unit (free-text label
    /// captured separately or via `custom_fields`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub material: Option<String>,
    /// Storefront-facing attribute pairs (color/size/material variants
    /// surfaced to the buyer). Project-wide metadata uses
    /// `custom_fields` instead.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub custom_attributes: Vec<CustomAttribute>,

    /* ----- tax + accounting -------------------------------------- */
    #[serde(default)]
    pub tax_preference: TaxPreference,
    /// Chart-of-accounts FK for revenue postings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_account: Option<ObjectId>,
    /// Chart-of-accounts FK for purchase postings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub purchase_account: Option<ObjectId>,
    /// Chart-of-accounts FK for stock asset postings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stock_account: Option<ObjectId>,
    /// Chart-of-accounts FK for cost-of-goods-sold postings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cogs_account: Option<ObjectId>,

    /* ----- lifecycle --------------------------------------------- */
    /// Whether the item is selectable on new docs. Defaults to `true`
    /// and only the `false` state is persisted (the helper
    /// `is_true` skip-serializes the default).
    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub active: bool,

    /* ----- bag-of-data fragments --------------------------------- */
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
    #[serde(default, skip_serializing_if = "CustomFields::is_empty")]
    pub custom_fields: CustomFields,
}

/// Skip-serialize helper for `bool` fields whose default is `false`.
/// Mirrors the `crm-core` convention for default-false flags.
fn is_false(b: &bool) -> bool {
    !*b
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_item() -> Item {
        Item {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            item_type: ItemType::Goods,
            name: "Mechanical Keyboard — TKL".into(),
            sku: "KB-TKL-001".into(),
            barcode: Some("8901234567890".into()),
            variant_of: None,
            hsn_sac: Some("8471".into()),
            gst_rate: Some(18.0),
            cess: None,
            unit: "PCS".into(),
            alt_units: vec![AltUnit {
                unit: "BOX".into(),
                conversion_factor: 12.0,
            }],
            sub_unit: None,
            brand: Some("AuroraType".into()),
            category: vec![ObjectId::new()],
            manufacturer: Some("AuroraType Co.".into()),
            mpn: Some("AT-TKL-RGB".into()),
            country_of_origin: Some("IN".into()),
            description: Some("Tenkeyless mechanical keyboard with RGB.".into()),
            short_description: Some("TKL mech keyboard".into()),
            features: vec!["Hot-swap".into(), "RGB".into()],
            specifications: vec![Specification {
                key: "Switch".into(),
                value: "Cherry MX Brown".into(),
            }],
            selling_price: 8999.0,
            selling_currency: Some("INR".into()),
            mrp: Some(9999.0),
            discount_pct: Some(10.0),
            wholesale_price: Some(7500.0),
            tax_inclusive: false,
            purchase_price: 5800.0,
            purchase_currency: Some("INR".into()),
            vendor: vec![ObjectId::new()],
            lead_time: Some(14),
            reorder_point: Some(20.0),
            reorder_qty: Some(50.0),
            max_stock: Some(500.0),
            track_inventory: true,
            track_batches: false,
            track_serials: true,
            track_expiry: false,
            opening_stock: vec![OpeningStockEntry {
                warehouse_id: ObjectId::new(),
                qty: 100.0,
                value: Some(580_000.0),
            }],
            opening_stock_value: Some(580_000.0),
            image: vec![ObjectId::new()],
            thumbnail: Some(ObjectId::new()),
            gallery: vec![],
            dimensions: Some(Dimensions {
                length: 360.0,
                width: 135.0,
                height: 35.0,
                unit: "mm".into(),
            }),
            weight: Some(0.92),
            volume: None,
            color: Some("Black".into()),
            size: Some("TKL".into()),
            material: Some("ABS".into()),
            custom_attributes: vec![CustomAttribute {
                key: "Layout".into(),
                value: "ANSI".into(),
            }],
            tax_preference: TaxPreference::Taxable,
            sales_account: Some(ObjectId::new()),
            purchase_account: Some(ObjectId::new()),
            stock_account: Some(ObjectId::new()),
            cogs_account: Some(ObjectId::new()),
            active: true,
            tags: Tags::from_iter(["new", "rgb"]),
            custom_fields: CustomFields::default(),
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let item = sample_item();
        let json = serde_json::to_value(&item).unwrap();

        // Identity + Audit must flatten to the document root, not nest.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("itemType").is_some());
        assert!(json.get("hsnSac").is_some());
        assert!(json.get("gstRate").is_some());
        assert!(json.get("altUnits").is_some());
        assert!(json.get("sellingPrice").is_some());
        assert!(json.get("purchasePrice").is_some());
        assert!(json.get("trackInventory").is_some());
        assert!(json.get("openingStock").is_some());
        assert!(json.get("openingStockValue").is_some());
        assert!(json.get("countryOfOrigin").is_some());
        assert!(json.get("salesAccount").is_some());
        assert!(json.get("cogsAccount").is_some());
        assert!(json.get("customAttributes").is_some());

        // ItemType serializes lowercase.
        assert_eq!(json.get("itemType").and_then(|v| v.as_str()), Some("goods"));

        // Default `active = true` is skip-serialized (helper `is_true`).
        assert!(
            json.get("active").is_none(),
            "default `active=true` must skip"
        );

        // Round-trip back through serde.
        let back: Item = serde_json::from_value(json).unwrap();
        assert_eq!(back.sku, item.sku);
        assert_eq!(back.item_type, item.item_type);
        assert_eq!(back.unit, item.unit);
        assert_eq!(back.selling_price, item.selling_price);
        assert!(back.active, "missing `active` must default back to true");
        assert_eq!(back.alt_units.len(), 1);
        assert_eq!(back.alt_units[0].conversion_factor, 12.0);
        assert_eq!(back.tags.len(), 2);
    }

    #[test]
    fn item_type_round_trips_lowercase() {
        for variant in [ItemType::Goods, ItemType::Service, ItemType::Bundle] {
            let s = serde_json::to_string(&variant).unwrap();
            assert!(
                s == "\"goods\"" || s == "\"service\"" || s == "\"bundle\"",
                "unexpected variant encoding: {s}"
            );
            let back: ItemType = serde_json::from_str(&s).unwrap();
            assert_eq!(back, variant);
        }
    }

    #[test]
    fn explicit_inactive_serializes() {
        let mut item = sample_item();
        item.active = false;
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json.get("active").and_then(|v| v.as_bool()), Some(false));
    }
}
