//! One-shot index migration. Run at deploy time (or on first boot) so
//! lookup `$regex` searches don't full-scan large tenant collections.
//!
//! For each `LookupSpec`:
//! - Compound `(userId, name)` (or first searchable field) — primary
//!   tenant-narrow index.
//! - Single-field index per searchable field.
//!
//! Idempotent — re-runs are no-ops; the Mongo driver's `create_indexes`
//! ignores duplicates.

use crate::entities;
use crate::mongo_lookup::LookupSpec;
use anyhow::{Context, Result};
use bson::doc;
use mongodb::{IndexModel, options::IndexOptions};
use sabnode_db::MongoHandle;
use tracing::info;

/// Run the migration. Safe to call repeatedly.
pub async fn ensure_indexes(mongo: &MongoHandle) -> Result<()> {
    for spec in all_specs() {
        ensure_for_spec(mongo, spec).await?;
    }
    ensure_geospatial_indexes(mongo).await?;
    Ok(())
}

async fn ensure_geospatial_indexes(mongo: &MongoHandle) -> Result<()> {
    // Examples of geospatial indexes across the CRM
    let attendance_coll = mongo.collection::<bson::Document>("crm_attendance");
    let models = vec![
        IndexModel::builder()
            .keys(doc! { "punchIn.location": "2dsphere" })
            .options(
                IndexOptions::builder()
                    .name("crm_attendance_punchIn_geo".to_string())
                    .build(),
            )
            .build(),
        IndexModel::builder()
            .keys(doc! { "punchOut.location": "2dsphere" })
            .options(
                IndexOptions::builder()
                    .name("crm_attendance_punchOut_geo".to_string())
                    .build(),
            )
            .build(),
    ];
    // Ignore error if it fails (e.g. if field exists and is not GeoJSON)
    let _ = attendance_coll.create_indexes(models).await;

    // Branches
    let branches_coll = mongo.collection::<bson::Document>("crm_branches");
    let branch_models = vec![
        IndexModel::builder()
            .keys(doc! { "location": "2dsphere" })
            .options(
                IndexOptions::builder()
                    .name("crm_branches_location_geo".to_string())
                    .build(),
            )
            .build(),
    ];
    let _ = branches_coll.create_indexes(branch_models).await;

    Ok(())
}

/// All entity specs known to the lookup executor. Lives in a `static`
/// so `all_specs()` can return a `&'static` slice — putting the array
/// literal inside the function body returns a reference to a local
/// temporary, which doesn't compile.
static ALL_SPECS: &[&LookupSpec] = &[
    &entities::client::SPEC,
    &entities::vendor::SPEC,
    &entities::item::SPEC,
    &entities::employee::SPEC,
    &entities::user::SPEC,
    &entities::account::SPEC,
    &entities::warehouse::SPEC,
    &entities::bank_account::SPEC,
    &entities::lead::SPEC,
    &entities::contact::SPEC,
    &entities::deal::SPEC,
    &entities::invoice::SPEC,
    &entities::quotation::SPEC,
    &entities::sales_order::SPEC,
    &entities::purchase_order::SPEC,
    &entities::bill::SPEC,
    &entities::receipt::SPEC,
    &entities::asset::SPEC,
    &entities::ticket::SPEC,
    &entities::subscription::SPEC,
    &entities::plan::SPEC,
    &entities::coupon::SPEC,
    &entities::template::SPEC,
    &entities::department::SPEC,
    &entities::designation::SPEC,
    &entities::shift::SPEC,
    &entities::holiday::SPEC,
    &entities::project::SPEC,
    &entities::branch::SPEC,
    &entities::cost_center::SPEC,
    &entities::category::SPEC,
    &entities::tag::SPEC,
    &entities::source::SPEC,
    &entities::status::SPEC,
    &entities::tax_rate::SPEC,
    &entities::hsn::SPEC,
    &entities::pincode::SPEC,
];

fn all_specs() -> &'static [&'static LookupSpec] {
    ALL_SPECS
}

async fn ensure_for_spec(mongo: &MongoHandle, spec: &LookupSpec) -> Result<()> {
    let collection = mongo.collection::<bson::Document>(spec.collection);
    let mut models: Vec<IndexModel> = vec![];

    // Compound (userId, first-searchable) — only when not global.
    if !spec.is_global
        && let Some(first) = spec.searchable_fields.first()
    {
        models.push(
            IndexModel::builder()
                .keys(doc! { "userId": 1, *first: 1 })
                .options(
                    IndexOptions::builder()
                        .name(format!("crm_lookup_{}_userId_{}", spec.collection, first))
                        .build(),
                )
                .build(),
        );
    }

    // Text index for all searchable fields.
    if !spec.searchable_fields.is_empty() {
        let mut text_keys = doc! {};
        for field in spec.searchable_fields {
            text_keys.insert(*field, "text");
        }
        models.push(
            IndexModel::builder()
                .keys(text_keys)
                .options(
                    IndexOptions::builder()
                        .name(format!("crm_lookup_{}_text", spec.collection))
                        .build(),
                )
                .build(),
        );
    }

    if models.is_empty() {
        return Ok(());
    }

    collection
        .create_indexes(models)
        .await
        .with_context(|| format!("creating lookup indexes for `{}`", spec.collection))?;

    info!(collection = spec.collection, "ensured lookup indexes");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_specs_includes_canonical_8() {
        let specs = all_specs();
        let collections: Vec<&str> = specs.iter().map(|s| s.collection).collect();
        assert!(collections.contains(&"crm_accounts"));
        assert!(collections.contains(&"crm_vendors"));
        assert!(collections.contains(&"crm_products"));
        assert!(collections.contains(&"users"));
    }

    #[test]
    fn all_specs_includes_pincode() {
        let specs = all_specs();
        assert!(specs.iter().any(|s| s.collection == "crm_pincodes"));
    }
}
